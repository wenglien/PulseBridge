from __future__ import annotations
"""
Feature Pipeline – unified entry point for both XML-based and HealthKit-based analysis.

Usage (existing XML flow):
    result = await run_full_analysis(session_id, health_data, questionnaire)

Usage (HealthKit incremental flow):
    result = await run_feature_pipeline(session_id, records, user_id=...)
"""
import json
from typing import Optional

from models.analysis import AnalysisResult
from models.health_data import ECGReading, HealthData, HRVMetrics, SleepData, SleepStage
from models.questionnaire import QuestionnaireResponse
from core.ecg_analyzer import (
    analyze_ecg,
    analyze_hrv_risks,
    build_integrated_cardiac_assessment,
    compute_western_flags,
    summarize_ecg,
    summarize_hrv,
)
from core.tcm_scorer import score_constitutions
from core.red_flags import detect_red_flags
from core.claude_engine import stream_analysis, build_analysis_result_from_claude


# ── Public API ──────────────────────────────────────────────────────────────

async def run_full_analysis(
    session_id: str,
    health_data: HealthData,
    questionnaire: QuestionnaireResponse,
) -> AnalysisResult:
    """
    Full analysis pipeline used by the existing XML upload flow.
    Identical to what analysis.py does, extracted here for reuse.
    """
    ecg_alerts = analyze_ecg(health_data.ecg_readings)
    if health_data.hrv and health_data.hrv.sdnn > 0:
        ecg_alerts.extend(analyze_hrv_risks(health_data.hrv))

    # Red-flag guardrails — prepended so they surface at the top of the UI.
    red_flag_alerts = detect_red_flags(
        questionnaire, health_data.hrv, health_data.ecg_readings
    )
    ecg_alerts = red_flag_alerts + ecg_alerts

    ecg_analysis    = summarize_ecg(health_data.ecg_readings, ecg_alerts)
    hrv_analysis    = summarize_hrv(health_data.hrv, ecg_alerts, age=health_data.age)
    western_flags   = compute_western_flags(health_data.ecg_readings, health_data.hrv, ecg_alerts)
    integrated      = build_integrated_cardiac_assessment(ecg_analysis, hrv_analysis, ecg_alerts)
    # Ensure red flags are reflected in the integrated assessment.
    if red_flag_alerts:
        for alert in red_flag_alerts:
            if alert.title_zh not in integrated.red_flags:
                integrated.red_flags.insert(0, alert.title_zh)
        if any(a.risk_level == "critical" for a in red_flag_alerts):
            integrated.cardiac_risk_level = "critical"
            integrated.follow_up_priority = "immediate"
        elif integrated.cardiac_risk_level in {"low", "medium"}:
            integrated.cardiac_risk_level = "high"
            if integrated.follow_up_priority == "routine":
                integrated.follow_up_priority = "1_week"
    tcm_scores      = score_constitutions(health_data, questionnaire)

    full_response = ""
    async for chunk in stream_analysis(
        health_data, questionnaire, tcm_scores,
        ecg_alerts, ecg_analysis, hrv_analysis, integrated,
    ):
        full_response += chunk

    return build_analysis_result_from_claude(
        session_id, full_response, tcm_scores, ecg_alerts,
        western_flags, ecg_analysis, hrv_analysis, integrated,
    )


async def run_feature_pipeline(
    session_id: str,
    records: list[dict],
    *,
    user_id: Optional[str] = None,
    questionnaire: Optional[QuestionnaireResponse] = None,
) -> Optional[AnalysisResult]:
    """
    Incremental pipeline for HealthKit-pushed records.

    `records` is a list of dicts, each with at minimum:
        { "data_type": "hrv"|"ecg"|"sleep"|..., ...data fields... }

    Builds a HealthData object from the records, then runs the full analysis.
    Returns None if there is insufficient data to analyse.
    """
    health_data = _build_health_data(session_id, records)

    if questionnaire is None:
        questionnaire = QuestionnaireResponse(session_id=session_id)

    # Require at least HRV or ECG to proceed
    has_hrv = health_data.hrv and health_data.hrv.sdnn > 0
    has_ecg = bool(health_data.ecg_readings)
    if not has_hrv and not has_ecg:
        return None

    return await run_full_analysis(session_id, health_data, questionnaire)


# ── Internal builders ────────────────────────────────────────────────────────

def _build_health_data(session_id: str, records: list[dict]) -> HealthData:
    """
    Convert a flat list of normalized HK records into a HealthData model.
    Each record must have a "data_type" field.
    """
    ecg_readings: list[ECGReading] = []
    hrv_sdnn_values: list[float] = []
    rr_intervals: list[float] = []
    sleep_map: dict[str, dict] = {}
    heart_rates: list[float] = []
    resting_hrs: list[float] = []
    spo2_values: list[float] = []

    for rec in records:
        dt = rec.get("data_type", "")

        if dt == "ecg":
            ecg_readings.append(ECGReading(
                timestamp=rec.get("timestamp", ""),
                average_heart_rate=float(rec.get("average_heart_rate", 0)),
                classification=rec.get("classification", "notDetermined"),
                voltage_measurements=rec.get("voltage_measurements", []),
                lead_type=rec.get("lead_type", "AppleWatchSimilarToLeadI"),
            ))

        elif dt == "hrv":
            if "sdnn_ms" in rec:
                hrv_sdnn_values.append(float(rec["sdnn_ms"]))
            if "rr_intervals" in rec:
                rr_intervals.extend(rec["rr_intervals"])

        elif dt == "heart_rate":
            hr = float(rec.get("value", rec.get("bpm", 0)))
            if hr > 0:
                heart_rates.append(hr)

        elif dt == "resting_hr":
            rhr = float(rec.get("value", rec.get("bpm", 0)))
            if rhr > 0:
                resting_hrs.append(rhr)

        elif dt == "sleep":
            date = rec.get("date", rec.get("start_date", "")[:10])
            if date not in sleep_map:
                sleep_map[date] = {
                    "date": date,
                    "total": 0.0, "deep": 0.0, "rem": 0.0,
                    "core": 0.0, "awake": 0.0, "stages": [],
                }
            stage = rec.get("stage", "core")
            mins = float(rec.get("duration_minutes", 0))
            sleep_map[date]["total"] += mins
            sleep_map[date]["stages"].append({
                "start_date": rec.get("start_date", ""),
                "end_date": rec.get("end_date", ""),
                "stage": stage,
                "duration_minutes": mins,
            })
            if stage == "deep":
                sleep_map[date]["deep"] += mins
            elif stage == "rem":
                sleep_map[date]["rem"] += mins
            elif stage == "core":
                sleep_map[date]["core"] += mins
            elif stage == "awake":
                sleep_map[date]["awake"] += mins

        elif dt == "oxygen_saturation":
            v = float(rec.get("value", rec.get("spo2", 0)))
            if v > 0:
                spo2_values.append(v)

    # Build HRV model
    hrv: Optional[HRVMetrics] = None
    if rr_intervals:
        from core.hrv_analyzer import compute_hrv_metrics
        hrv_dict = compute_hrv_metrics(rr_intervals)
        if hrv_dict:
            hrv = HRVMetrics(**hrv_dict)
    elif hrv_sdnn_values:
        from core.hrv_analyzer import hrv_from_sdnn_records
        records_for_hrv = [{"value_ms": v} for v in hrv_sdnn_values]
        hrv_dict = hrv_from_sdnn_records(records_for_hrv)
        if hrv_dict:
            hrv = HRVMetrics(**hrv_dict)

    # Build sleep list
    sleep_list = []
    for d in sleep_map.values():
        total = d["total"]
        eff = max(0.0, min(1.0, (total - d["awake"]) / total)) if total > 0 else 0.0
        sleep_list.append(SleepData(
            date=d["date"],
            total_sleep_minutes=total,
            deep_sleep_minutes=d["deep"],
            rem_sleep_minutes=d["rem"],
            core_sleep_minutes=d["core"],
            awake_minutes=d["awake"],
            sleep_efficiency=eff,
            stages=[SleepStage(**s) for s in d["stages"]],
        ))

    resting_hr = sum(resting_hrs) / len(resting_hrs) if resting_hrs else (
        sum(heart_rates) / len(heart_rates) if heart_rates else 0.0
    )

    return HealthData(
        session_id=session_id,
        ecg_readings=ecg_readings,
        hrv=hrv,
        sleep=sleep_list,
        resting_heart_rate=round(resting_hr, 1),
    )
