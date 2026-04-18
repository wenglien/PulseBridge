from __future__ import annotations
"""
ECG and HRV risk analysis.
Generates risk alerts based on Apple Watch ECG classifications and HRV thresholds.
"""
import uuid
import numpy as np
from typing import Optional

from models.analysis import (
    ECGAnalysis,
    ECGHeartRateProfile,
    ECGRhythmSummary,
    ECGRiskAssessment,
    ECGSignalQuality,
    ECGWaveformFindings,
    HRVAnalysis,
    HRVAutonomicBalance,
    HRVFrequencyDomain,
    HRVReferenceRange,
    HRVRiskAssessment,
    HRVTimeDomain,
    IntegratedCardiacAssessment,
    RiskAlert,
    WesternFlags,
)
from models.health_data import ECGReading, HRVMetrics
from core.hrv_reference import get_reference, percentile_rank

# HRV clinical thresholds (short-term, 5-minute measurements)
HRV_THRESHOLDS = {
    "sdnn_critical": 15.0,
    "sdnn_high": 25.0,
    "sdnn_medium": 35.0,
    "rmssd_critical": 12.0,
    "rmssd_high": 18.0,
    "lf_hf_critical": 8.0,
    "lf_hf_high": 4.5,
    "pnn50_low": 2.0,
    "bradycardia_bpm": 40.0,
    "tachycardia_bpm": 120.0,
    "st_deviation_uv": 150.0,   # microvolts
}


def analyze_ecg(ecg_readings: list[ECGReading]) -> list[RiskAlert]:
    """Analyze ECG readings and return risk alerts."""
    alerts: list[RiskAlert] = []
    if not ecg_readings:
        return alerts

    # 1. AFib detection via Apple Watch classification
    afib_readings = [r for r in ecg_readings if r.classification == "atrialFibrillation"]
    if afib_readings:
        alerts.append(RiskAlert(
            id=str(uuid.uuid4())[:8],
            category="cardiac",
            risk_level="critical",
            title_zh="偵測到心房顫動（AFib）",
            title_en="Atrial Fibrillation Detected",
            description_zh=f"在 {len(afib_readings)} 次 ECG 記錄中偵測到心房顫動。心房顫動會增加中風和心臟衰竭的風險，請立即就醫評估。",
            recommendation="請立即前往心臟科或急診室評估，並告知醫師您的 Apple Watch ECG 記錄。",
            trigger_values={"afib_readings": len(afib_readings), "total_readings": len(ecg_readings)},
        ))

    # 2. Inconclusive ECG (multiple readings)
    inconclusive = [r for r in ecg_readings if "inconclusive" in r.classification.lower()]
    if len(inconclusive) >= 3:
        alerts.append(RiskAlert(
            id=str(uuid.uuid4())[:8],
            category="cardiac",
            risk_level="medium",
            title_zh="多次 ECG 結果不確定",
            title_en="Multiple Inconclusive ECG Readings",
            description_zh=f"有 {len(inconclusive)} 次 ECG 記錄結果不確定，可能因心率過低、噪音或其他原因。",
            recommendation="建議至心臟科進行標準12導程心電圖檢查。",
            trigger_values={"inconclusive_count": len(inconclusive)},
        ))

    # 3. Heart rate extremes
    # Prefer stored average_heart_rate; fall back to R-peak detection from voltages
    hr_values: list[float] = []
    for r in ecg_readings:
        if r.average_heart_rate > 0:
            hr_values.append(r.average_heart_rate)
        elif len(r.voltage_measurements) >= r.sample_rate_hz:
            _, computed_hr = detect_r_peaks_and_hr(r.voltage_measurements, r.sample_rate_hz)
            if computed_hr > 0:
                hr_values.append(computed_hr)
    if hr_values:
        avg_hr = np.mean(hr_values)
        min_hr = min(hr_values)
        max_hr = max(hr_values)

        if min_hr < HRV_THRESHOLDS["bradycardia_bpm"]:
            alerts.append(RiskAlert(
                id=str(uuid.uuid4())[:8],
                category="cardiac",
                risk_level="high",
                title_zh="心跳過緩",
                title_en="Bradycardia",
                description_zh=f"偵測到心率 {min_hr:.0f} bpm，低於正常下限（40 bpm）。可能需要評估心臟傳導系統。",
                recommendation="建議就醫評估，特別是如有頭暈、昏厥或疲勞症狀。",
                trigger_values={"min_hr": min_hr, "threshold": HRV_THRESHOLDS["bradycardia_bpm"]},
            ))
        elif avg_hr > HRV_THRESHOLDS["tachycardia_bpm"]:
            alerts.append(RiskAlert(
                id=str(uuid.uuid4())[:8],
                category="cardiac",
                risk_level="medium",
                title_zh="靜息心率偏高",
                title_en="Elevated Resting Heart Rate",
                description_zh=f"平均靜息心率 {avg_hr:.0f} bpm 偏高，可能與壓力、脫水、貧血或甲狀腺問題有關。",
                recommendation="建議減少咖啡因攝入、保持水分，若持續偏高請就醫檢查。",
                trigger_values={"avg_hr": round(avg_hr, 1), "threshold": HRV_THRESHOLDS["tachycardia_bpm"]},
            ))

    # 4. ST segment analysis (voltage deviation)
    st_alerts = _analyze_st_segments(ecg_readings)
    alerts.extend(st_alerts)

    return alerts


def detect_r_peaks_and_hr(
    voltages: list[float],
    sample_rate: int = 512,
) -> tuple[list[int], float]:
    """
    Simplified Pan-Tompkins R-peak detector.

    Returns (peak_indices, average_hr_bpm).
    Works on a single 30-second Apple Watch ECG trace (15 360 samples at 512 Hz).
    """
    if len(voltages) < sample_rate:           # need at least 1 second
        return [], 0.0

    sig = np.array(voltages, dtype=np.float64)

    # 1. Bandpass filter: keep 5–40 Hz (removes baseline wander + high-freq noise)
    #    Implemented via a simple difference (derivative) approach to avoid scipy dependency.
    #    For more accuracy scipy.signal.butter + filtfilt is preferred but optional.
    try:
        from scipy.signal import butter, filtfilt  # type: ignore
        nyq = sample_rate / 2.0
        lo, hi = 5.0 / nyq, min(40.0 / nyq, 0.99)
        b, a = butter(2, [lo, hi], btype="band")
        filtered = filtfilt(b, a, sig)
    except Exception:
        # Fallback: simple derivative-based differencing
        filtered = np.diff(sig, prepend=sig[0])

    # 2. Squaring to emphasise peaks
    squared = filtered ** 2

    # 3. Moving-window integration (150 ms window)
    win = max(1, int(0.15 * sample_rate))
    kernel = np.ones(win) / win
    integrated = np.convolve(squared, kernel, mode="same")

    # 4. Adaptive threshold (60% of max in the integrated signal)
    threshold = 0.6 * np.max(integrated)

    # 5. Find peaks with minimum refractory period of 200 ms
    refractory = int(0.20 * sample_rate)
    peaks: list[int] = []
    i = 0
    above = False
    local_max_val = 0.0
    local_max_idx = 0

    while i < len(integrated):
        if integrated[i] > threshold:
            if not above:
                above = True
                local_max_val = integrated[i]
                local_max_idx = i
            elif integrated[i] > local_max_val:
                local_max_val = integrated[i]
                local_max_idx = i
        else:
            if above:
                # Enforce refractory period
                if not peaks or (local_max_idx - peaks[-1]) >= refractory:
                    peaks.append(local_max_idx)
                above = False
        i += 1

    if len(peaks) < 2:
        return peaks, 0.0

    # 6. Compute average HR from RR intervals (discard physiologically impossible ones)
    rr_samples = np.diff(peaks)
    valid_rr = rr_samples[
        (rr_samples > int(0.33 * sample_rate)) &   # < 180 bpm
        (rr_samples < int(2.0  * sample_rate))      # > 30 bpm
    ]
    if len(valid_rr) == 0:
        return peaks, 0.0

    mean_rr_sec = float(np.mean(valid_rr)) / sample_rate
    avg_hr = round(60.0 / mean_rr_sec, 1)

    return peaks, avg_hr


def _analyze_st_segments(ecg_readings: list[ECGReading]) -> list[RiskAlert]:
    """Detect abnormal ST segment deviations in ECG voltage data."""
    alerts: list[RiskAlert] = []
    abnormal_count = 0

    for reading in ecg_readings:
        if len(reading.voltage_measurements) < 300:
            continue
        try:
            voltages = np.array(reading.voltage_measurements)
            # Baseline: first 50 samples (isoelectric line)
            baseline = float(np.mean(voltages[:50]))
            # ST segment: approximately 200–300ms after QRS (at 512 Hz → ~100–154 samples)
            st_region = voltages[200:260] if len(voltages) > 260 else voltages[-60:]
            st_mean = float(np.mean(st_region))
            st_deviation = abs(st_mean - baseline)
            if st_deviation > HRV_THRESHOLDS["st_deviation_uv"]:
                abnormal_count += 1
        except Exception:
            continue

    if abnormal_count > 0:
        alerts.append(RiskAlert(
            id=str(uuid.uuid4())[:8],
            category="cardiac",
            risk_level="high",
            title_zh="ECG ST 段異常",
            title_en="ECG ST Segment Abnormality",
            description_zh=f"在 {abnormal_count} 次 ECG 記錄中偵測到 ST 段偏移，可能提示心肌缺血或其他心臟問題。",
            recommendation="請儘快就醫進行完整心臟評估，包括運動壓力測試和心肌酶檢查。",
            trigger_values={"abnormal_readings": abnormal_count},
        ))
    return alerts


def summarize_ecg(ecg_readings: list[ECGReading], alerts: list[RiskAlert]) -> ECGAnalysis:
    """Build a data-oriented ECG summary from raw readings and alerts."""
    if not ecg_readings:
        return ECGAnalysis(
            signal_quality=ECGSignalQuality(),
            rhythm_summary=ECGRhythmSummary(),
            heart_rate_profile=ECGHeartRateProfile(),
            waveform_findings=ECGWaveformFindings(),
            ecg_risk_assessment=ECGRiskAssessment(
                risk_level="low",
                confidence="low",
                evidence=["無 ECG 數據"],
            ),
        )

    classifications: dict[str, int] = {}
    usable_readings = 0
    inconclusive_readings = 0
    afib_count = 0
    hr_values: list[float] = []
    st_deviations: list[float] = []

    for reading in ecg_readings:
        cls = reading.classification or "unknown"
        classifications[cls] = classifications.get(cls, 0) + 1
        if "inconclusive" in cls.lower() or cls == "notDetermined":
            inconclusive_readings += 1
        else:
            usable_readings += 1
        if cls == "atrialFibrillation":
            afib_count += 1

        # Collect heart rate (prefer stored value, fall back to R-peak detection)
        if reading.average_heart_rate > 0:
            hr_values.append(reading.average_heart_rate)
        elif len(reading.voltage_measurements) >= reading.sample_rate_hz:
            _, computed_hr = detect_r_peaks_and_hr(
                reading.voltage_measurements, reading.sample_rate_hz
            )
            if computed_hr > 0:
                hr_values.append(computed_hr)

        if len(reading.voltage_measurements) >= 300:
            try:
                voltages = np.array(reading.voltage_measurements)
                baseline = float(np.mean(voltages[:50]))
                st_region = voltages[200:260] if len(voltages) > 260 else voltages[-60:]
                st_deviations.append(abs(float(np.mean(st_region)) - baseline))
            except Exception:
                continue

    dominant_rhythm = max(classifications, key=classifications.get) if classifications else ""
    quality_score = usable_readings / len(ecg_readings) if ecg_readings else 0.0
    afib_burden_pct = (afib_count / len(ecg_readings)) * 100 if ecg_readings else 0.0

    if hr_values:
        mean_hr = float(np.mean(hr_values))
        median_hr = float(np.median(hr_values))
        min_hr = float(np.min(hr_values))
        max_hr = float(np.max(hr_values))
        hr_variability = float(np.std(hr_values))
    else:
        mean_hr = median_hr = min_hr = max_hr = hr_variability = 0.0

    risk_level = "low"
    confidence = "high" if len(ecg_readings) >= 5 else "medium"
    evidence: list[str] = []

    if afib_count > 0:
        risk_level = "critical"
        evidence.append(f"偵測到 {afib_count} 次 AFib 分類")
    else:
        evidence.append("未檢出 AFib")

    abnormal_st_count = sum(1 for value in st_deviations if value > HRV_THRESHOLDS["st_deviation_uv"])
    max_st_deviation = max(st_deviations) if st_deviations else 0.0
    if abnormal_st_count > 0:
        risk_level = "high" if risk_level != "critical" else risk_level
        evidence.append(f"{abnormal_st_count} 次 ECG 出現 ST 段偏移")
    else:
        evidence.append("未見顯著 ST 段偏移")

    if inconclusive_readings >= 3 and risk_level in {"low", "medium"}:
        risk_level = "medium"
        evidence.append(f"有 {inconclusive_readings} 次 ECG 結果不確定")

    if min_hr and min_hr < HRV_THRESHOLDS["bradycardia_bpm"]:
        risk_level = "high" if risk_level in {"low", "medium"} else risk_level
        evidence.append(f"最低心率 {min_hr:.0f} bpm，低於 {HRV_THRESHOLDS['bradycardia_bpm']:.0f} bpm")

    return ECGAnalysis(
        signal_quality=ECGSignalQuality(
            total_readings=len(ecg_readings),
            usable_readings=usable_readings,
            inconclusive_readings=inconclusive_readings,
            quality_score=round(quality_score, 2),
        ),
        rhythm_summary=ECGRhythmSummary(
            dominant_rhythm=dominant_rhythm,
            classification_distribution=classifications,
            afib_detected=afib_count > 0,
            afib_burden_pct=round(afib_burden_pct, 1),
        ),
        heart_rate_profile=ECGHeartRateProfile(
            mean_hr_bpm=round(mean_hr, 1),
            median_hr_bpm=round(median_hr, 1),
            min_hr_bpm=round(min_hr, 1),
            max_hr_bpm=round(max_hr, 1),
            hr_variability_across_ecg=round(hr_variability, 1),
        ),
        waveform_findings=ECGWaveformFindings(
            st_deviation_detected=abnormal_st_count > 0,
            st_abnormal_readings=abnormal_st_count,
            st_deviation_max_uv=round(max_st_deviation, 1),
        ),
        ecg_risk_assessment=ECGRiskAssessment(
            risk_level=risk_level,
            confidence=confidence,
            evidence=evidence,
        ),
    )


def analyze_hrv_risks(hrv: HRVMetrics) -> list[RiskAlert]:
    """Generate risk alerts from HRV metrics."""
    alerts: list[RiskAlert] = []

    # SDNN risk
    if hrv.sdnn > 0:
        if hrv.sdnn < HRV_THRESHOLDS["sdnn_critical"]:
            alerts.append(RiskAlert(
                id=str(uuid.uuid4())[:8],
                category="autonomic",
                risk_level="critical",
                title_zh="心率變異性嚴重過低",
                title_en="Critically Low HRV",
                description_zh=f"SDNN {hrv.sdnn:.1f}ms 遠低於正常值（>50ms），可能反映嚴重的自主神經功能障礙或心臟疾病。",
                recommendation="建議立即進行心臟科評估，包括24小時動態心電圖檢查。",
                trigger_values={"sdnn": hrv.sdnn, "threshold": HRV_THRESHOLDS["sdnn_critical"]},
            ))
        elif hrv.sdnn < HRV_THRESHOLDS["sdnn_high"]:
            alerts.append(RiskAlert(
                id=str(uuid.uuid4())[:8],
                category="autonomic",
                risk_level="high",
                title_zh="心率變異性偏低",
                title_en="Low HRV",
                description_zh=f"SDNN {hrv.sdnn:.1f}ms 偏低，顯示自主神經調節能力下降，與心血管風險增加相關。",
                recommendation="建議減壓、改善睡眠，並在兩週後重新評估 HRV。",
                trigger_values={"sdnn": hrv.sdnn, "threshold": HRV_THRESHOLDS["sdnn_high"]},
            ))
        elif hrv.sdnn < HRV_THRESHOLDS["sdnn_medium"]:
            alerts.append(RiskAlert(
                id=str(uuid.uuid4())[:8],
                category="autonomic",
                risk_level="medium",
                title_zh="心率變異性略低",
                title_en="Below-Average HRV",
                description_zh=f"SDNN {hrv.sdnn:.1f}ms 略低於理想範圍，可能反映慢性壓力或睡眠品質不佳。",
                recommendation="建議改善睡眠習慣、增加有氧運動，減少咖啡因和酒精攝入。",
                trigger_values={"sdnn": hrv.sdnn},
            ))

    # LF/HF ratio — sympathovagal balance
    if hrv.lf_hf_ratio > HRV_THRESHOLDS["lf_hf_critical"]:
        alerts.append(RiskAlert(
            id=str(uuid.uuid4())[:8],
            category="autonomic",
            risk_level="high",
            title_zh="交感神經過度活躍",
            title_en="Sympathetic Dominance",
            description_zh=f"LF/HF 比值 {hrv.lf_hf_ratio:.2f} 顯示交感神經系統嚴重過度主導，長期可能增加心血管疾病風險。",
            recommendation="積極減壓：冥想、腹式呼吸、規律運動，並評估是否有慢性壓力源。",
            trigger_values={"lf_hf_ratio": hrv.lf_hf_ratio, "threshold": HRV_THRESHOLDS["lf_hf_critical"]},
        ))
    elif hrv.lf_hf_ratio > HRV_THRESHOLDS["lf_hf_high"]:
        alerts.append(RiskAlert(
            id=str(uuid.uuid4())[:8],
            category="autonomic",
            risk_level="medium",
            title_zh="自律神經失衡",
            title_en="Autonomic Imbalance",
            description_zh=f"LF/HF 比值 {hrv.lf_hf_ratio:.2f} 偏高，顯示交感/副交感神經平衡偏向交感神經主導。",
            recommendation="建議增加放鬆活動，如瑜伽、冥想或泡澡。",
            trigger_values={"lf_hf_ratio": hrv.lf_hf_ratio},
        ))

    # Sleep apnea proxy
    if hrv.rmssd < HRV_THRESHOLDS["rmssd_high"] and hrv.pnn50 < HRV_THRESHOLDS["pnn50_low"]:
        alerts.append(RiskAlert(
            id=str(uuid.uuid4())[:8],
            category="sleep",
            risk_level="medium",
            title_zh="潛在睡眠呼吸中止風險",
            title_en="Sleep Apnea Risk Indicator",
            description_zh=f"RMSSD {hrv.rmssd:.1f}ms 偏低且 pNN50 {hrv.pnn50:.1f}% 過低，可能提示副交感神經活性不足，建議排除睡眠呼吸中止症。",
            recommendation="建議進行睡眠多項生理檢查（PSG）以排除睡眠呼吸中止症。",
            trigger_values={"rmssd": hrv.rmssd, "pnn50": hrv.pnn50},
        ))

    return alerts


def summarize_hrv(
    hrv: Optional[HRVMetrics],
    alerts: list[RiskAlert],
    age: Optional[int] = None,
) -> HRVAnalysis:
    """Build a data-oriented HRV summary."""
    if hrv is None or hrv.sdnn <= 0:
        return HRVAnalysis(
            time_domain=HRVTimeDomain(),
            frequency_domain=HRVFrequencyDomain(),
            autonomic_balance=HRVAutonomicBalance(),
            hrv_risk_assessment=HRVRiskAssessment(
                risk_level="low",
                confidence="low",
                evidence=["無有效 HRV 數據"],
            ),
            reference_range=HRVReferenceRange(**get_reference(age)),
        )

    evidence: list[str] = []
    risk_level = "low"

    if hrv.sdnn < HRV_THRESHOLDS["sdnn_critical"]:
        risk_level = "critical"
        evidence.append(f"SDNN {hrv.sdnn:.1f}ms，屬嚴重偏低")
    elif hrv.sdnn < HRV_THRESHOLDS["sdnn_high"]:
        risk_level = "high"
        evidence.append(f"SDNN {hrv.sdnn:.1f}ms，顯示整體 HRV 偏低")
    elif hrv.sdnn < HRV_THRESHOLDS["sdnn_medium"]:
        risk_level = "medium"
        evidence.append(f"SDNN {hrv.sdnn:.1f}ms，略低於理想範圍")
    else:
        evidence.append(f"SDNN {hrv.sdnn:.1f}ms，處於可接受範圍")

    if hrv.rmssd < HRV_THRESHOLDS["rmssd_critical"]:
        risk_level = "critical"
        evidence.append(f"RMSSD {hrv.rmssd:.1f}ms，副交感活性顯著不足")
    elif hrv.rmssd < HRV_THRESHOLDS["rmssd_high"] and risk_level in {"low", "medium"}:
        risk_level = "high"
        evidence.append(f"RMSSD {hrv.rmssd:.1f}ms，副交感活性偏低")
    elif hrv.rmssd < 25:
        evidence.append(f"RMSSD {hrv.rmssd:.1f}ms，恢復能力仍偏弱")

    if hrv.lf_hf_ratio > HRV_THRESHOLDS["lf_hf_critical"]:
        risk_level = "high" if risk_level != "critical" else risk_level
        evidence.append(f"LF/HF {hrv.lf_hf_ratio:.2f}，交感神經明顯主導")
    elif hrv.lf_hf_ratio > HRV_THRESHOLDS["lf_hf_high"] and risk_level in {"low", "medium"}:
        risk_level = "medium"
        evidence.append(f"LF/HF {hrv.lf_hf_ratio:.2f}，存在自律神經失衡")

    if hrv.pnn50 < HRV_THRESHOLDS["pnn50_low"]:
        evidence.append(f"pNN50 {hrv.pnn50:.1f}% 過低，短期心率調節能力不足")

    parasympathetic_activity: str = "normal"
    if hrv.rmssd < HRV_THRESHOLDS["rmssd_high"] or hrv.pnn50 < HRV_THRESHOLDS["pnn50_low"]:
        parasympathetic_activity = "low"
    elif hrv.rmssd >= 35 and hrv.pnn50 >= 8:
        parasympathetic_activity = "high"

    sympathetic_dominance = hrv.lf_hf_ratio > 3.0
    if hrv.sdnn < 25 or hrv.rmssd < 18:
        recovery_state = "poor"
    elif hrv.sdnn < 35 or hrv.rmssd < 25:
        recovery_state = "fair"
    else:
        recovery_state = "good"

    ref_data = get_reference(age)
    # Approximate user's percentile within the age bracket.
    from core.hrv_reference import _RANGES, _GENERAL_ADULT  # type: ignore[attr-defined]
    bracket_stats = _GENERAL_ADULT
    if age:
        for (lo, hi), vals in _RANGES:
            if lo <= age <= hi:
                bracket_stats = vals
                break
    ref_data["sdnn_percentile"] = percentile_rank(
        hrv.sdnn, bracket_stats["sdnn_mean"], bracket_stats["sdnn_sd"]
    )
    ref_data["rmssd_percentile"] = percentile_rank(
        hrv.rmssd, bracket_stats["rmssd_mean"], bracket_stats["rmssd_sd"]
    )
    evidence.append(
        f"相對 {ref_data['age_bracket']} 年齡層：SDNN 約第 {ref_data['sdnn_percentile']} 百分位"
    )

    return HRVAnalysis(
        time_domain=HRVTimeDomain(
            sdnn_ms=round(hrv.sdnn, 1),
            rmssd_ms=round(hrv.rmssd, 1),
            pnn50_pct=round(hrv.pnn50, 1),
            mean_rr_ms=round(hrv.mean_rr, 1),
        ),
        frequency_domain=HRVFrequencyDomain(
            lf_power=round(hrv.lf_power, 2),
            hf_power=round(hrv.hf_power, 2),
            lf_hf_ratio=round(hrv.lf_hf_ratio, 2),
        ),
        autonomic_balance=HRVAutonomicBalance(
            sympathetic_dominance=sympathetic_dominance,
            parasympathetic_activity=parasympathetic_activity,  # type: ignore[arg-type]
            overall_recovery_state=recovery_state,  # type: ignore[arg-type]
        ),
        hrv_risk_assessment=HRVRiskAssessment(
            risk_level=risk_level,
            confidence="high",
            evidence=evidence,
        ),
        reference_range=HRVReferenceRange(**ref_data),
    )


def compute_western_flags(
    ecg_readings: list[ECGReading],
    hrv: Optional[HRVMetrics],
    alerts: list[RiskAlert],
) -> WesternFlags:
    """Summarize key Western medicine risk flags."""
    alert_titles = {a.title_en for a in alerts}
    return WesternFlags(
        afib_detected=any(r.classification == "atrialFibrillation" for r in ecg_readings),
        hrv_concern=hrv is not None and hrv.sdnn > 0 and hrv.sdnn < HRV_THRESHOLDS["sdnn_medium"],
        sleep_apnea_risk="Sleep Apnea Risk Indicator" in alert_titles,
        autonomic_imbalance="Autonomic Imbalance" in alert_titles or "Sympathetic Dominance" in alert_titles,
        bradycardia="Bradycardia" in alert_titles,
        tachycardia="Elevated Resting Heart Rate" in alert_titles,
    )


def build_integrated_cardiac_assessment(
    ecg_analysis: ECGAnalysis,
    hrv_analysis: HRVAnalysis,
    alerts: list[RiskAlert],
) -> IntegratedCardiacAssessment:
    """Combine ECG and HRV findings into a single cardiac conclusion."""
    red_flags = [alert.title_zh for alert in alerts if alert.risk_level in {"critical", "high"}]
    ecg_risk = ecg_analysis.ecg_risk_assessment.risk_level
    hrv_risk = hrv_analysis.hrv_risk_assessment.risk_level
    risk_rank = {"low": 0, "medium": 1, "high": 2, "critical": 3}
    cardiac_risk_level = ecg_risk if risk_rank[ecg_risk] >= risk_rank[hrv_risk] else hrv_risk

    if ecg_analysis.rhythm_summary.afib_detected:
        conclusion = "ECG 已出現心律不整警訊，應優先就醫確認心房顫動與相關心血管風險。"
        follow_up = "immediate"
    elif cardiac_risk_level in {"high", "critical"} and hrv_analysis.autonomic_balance.sympathetic_dominance:
        conclusion = "目前以自律神經壓力過高與 HRV 顯著下降為主，心血管恢復能力偏弱，建議短期內追蹤。"
        follow_up = "1_week"
    elif cardiac_risk_level == "medium":
        conclusion = "目前未見明確致命性心律異常，但 HRV 或 ECG 部分指標已有偏離，建議兩週內持續追蹤。"
        follow_up = "2_weeks"
    else:
        conclusion = "目前 ECG 未見明確高危異常，整體風險偏低，建議例行監測與維持恢復品質。"
        follow_up = "routine"

    return IntegratedCardiacAssessment(
        primary_conclusion_zh=conclusion,
        cardiac_risk_level=cardiac_risk_level,  # type: ignore[arg-type]
        red_flags=red_flags,
        follow_up_priority=follow_up,  # type: ignore[arg-type]
    )
