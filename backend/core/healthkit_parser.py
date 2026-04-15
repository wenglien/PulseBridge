from __future__ import annotations
"""
HealthKit XML export parser.
Extracts ECG, HRV, sleep, heart rate, and activity data from Apple Health export.xml
"""
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional


SLEEP_STAGE_MAP = {
    "HKCategoryValueSleepAnalysisAsleepCore": "core",
    "HKCategoryValueSleepAnalysisAsleepDeep": "deep",
    "HKCategoryValueSleepAnalysisAsleepREM": "rem",
    "HKCategoryValueSleepAnalysisAwake": "awake",
    "HKCategoryValueSleepAnalysisInBed": "inBed",
    "HKCategoryValueSleepAnalysisAsleep": "asleep",
}


def parse_healthkit_xml(xml_bytes: bytes) -> dict:
    """Parse Apple HealthKit XML export and return structured data."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML: {e}")

    return {
        "ecg_readings": _parse_ecg(root),
        "rr_intervals": _extract_rr_intervals(root),
        "hrv_sdnn_records": _parse_hrv_sdnn(root),
        "sleep_records": _parse_sleep(root),
        "heart_rates": _parse_heart_rate(root),
        "resting_heart_rate": _parse_resting_hr(root),
        "active_energy": _parse_active_energy(root),
        "step_count": _parse_steps(root),
        "stress_records": _parse_mindful(root),
    }


def _parse_ecg(root) -> list[dict]:
    ecg_samples = []
    for ecg in root.findall(".//ECGSample"):
        voltage_el = ecg.find("VoltageMeasurements")
        voltages: list[float] = []
        if voltage_el is not None and voltage_el.text:
            try:
                voltages = [float(v) for v in voltage_el.text.split(",") if v.strip()]
            except ValueError:
                pass
        ecg_samples.append({
            "timestamp": ecg.attrib.get("startDate", ""),
            "average_heart_rate": float(ecg.attrib.get("averageHeartRate", 0) or 0),
            "classification": ecg.attrib.get("classification", "notDetermined"),
            "voltage_measurements": voltages,
            "lead_type": ecg.attrib.get("leadType", "AppleWatchSimilarToLeadI"),
        })
    return ecg_samples


def _extract_rr_intervals(root) -> list[float]:
    """Extract RR intervals (ms) from HRV metadata beats."""
    rr_intervals: list[float] = []
    for record in root.findall(
        ".//Record[@type='HKQuantityTypeIdentifierHeartRateVariabilitySDNN']"
    ):
        for hrv_list in record.findall("HeartRateVariabilityMetadataList"):
            beats = hrv_list.findall("InstantaneousBeatsPerMinute")
            prev_time = 0.0
            for beat in beats:
                t = float(beat.attrib.get("time", 0))
                if prev_time > 0:
                    rr_ms = (t - prev_time) * 1000
                    if 300 < rr_ms < 2000:  # physiological range filter
                        rr_intervals.append(rr_ms)
                prev_time = t
    return rr_intervals


def _parse_hrv_sdnn(root) -> list[dict]:
    records = []
    for record in root.findall(
        ".//Record[@type='HKQuantityTypeIdentifierHeartRateVariabilitySDNN']"
    ):
        try:
            records.append({
                "timestamp": record.attrib.get("startDate", ""),
                "value_ms": float(record.attrib.get("value", 0)),
            })
        except ValueError:
            pass
    return records


def _parse_sleep(root) -> list[dict]:
    sleep_records = []
    for record in root.findall(
        ".//Record[@type='HKCategoryTypeIdentifierSleepAnalysis']"
    ):
        stage_value = record.attrib.get("value", "")
        start = record.attrib.get("startDate", "")
        end = record.attrib.get("endDate", "")
        duration = _duration_minutes(start, end)
        sleep_records.append({
            "start_date": start,
            "end_date": end,
            "stage": SLEEP_STAGE_MAP.get(stage_value, "unknown"),
            "duration_minutes": duration,
        })
    return sleep_records


def _parse_heart_rate(root) -> list[dict]:
    records = []
    for record in root.findall(
        ".//Record[@type='HKQuantityTypeIdentifierHeartRate']"
    ):
        try:
            records.append({
                "timestamp": record.attrib.get("startDate", ""),
                "bpm": float(record.attrib.get("value", 0)),
            })
        except ValueError:
            pass
    return records


def _parse_resting_hr(root) -> float:
    values = []
    for record in root.findall(
        ".//Record[@type='HKQuantityTypeIdentifierRestingHeartRate']"
    ):
        try:
            values.append(float(record.attrib.get("value", 0)))
        except ValueError:
            pass
    return sum(values) / len(values) if values else 0.0


def _parse_active_energy(root) -> float:
    total = 0.0
    for record in root.findall(
        ".//Record[@type='HKQuantityTypeIdentifierActiveEnergyBurned']"
    ):
        try:
            total += float(record.attrib.get("value", 0))
        except ValueError:
            pass
    return total


def _parse_steps(root) -> int:
    total = 0
    for record in root.findall(
        ".//Record[@type='HKQuantityTypeIdentifierStepCount']"
    ):
        try:
            total += int(float(record.attrib.get("value", 0)))
        except ValueError:
            pass
    return total


def _parse_mindful(root) -> list[dict]:
    records = []
    for record in root.findall(
        ".//Record[@type='HKCategoryTypeIdentifierMindfulSession']"
    ):
        records.append({
            "start_date": record.attrib.get("startDate", ""),
            "end_date": record.attrib.get("endDate", ""),
        })
    return records


def _duration_minutes(start_str: str, end_str: str) -> float:
    """Compute duration in minutes between two ISO-like date strings."""
    try:
        fmt = "%Y-%m-%d %H:%M:%S %z"
        start = datetime.strptime(start_str.strip(), fmt)
        end = datetime.strptime(end_str.strip(), fmt)
        return (end - start).total_seconds() / 60.0
    except ValueError:
        try:
            fmt2 = "%Y-%m-%dT%H:%M:%S"
            start = datetime.strptime(start_str[:19], fmt2)
            end = datetime.strptime(end_str[:19], fmt2)
            return (end - start).total_seconds() / 60.0
        except ValueError:
            return 0.0


def aggregate_sleep_by_date(sleep_records: list[dict]) -> list[dict]:
    """Group sleep stages by calendar date and compute summaries."""
    by_date: dict[str, list[dict]] = defaultdict(list)
    for r in sleep_records:
        date_key = r["start_date"][:10] if r["start_date"] else "unknown"
        by_date[date_key].append(r)

    summaries = []
    for date, stages in sorted(by_date.items()):
        deep = sum(s["duration_minutes"] for s in stages if s["stage"] == "deep")
        rem = sum(s["duration_minutes"] for s in stages if s["stage"] == "rem")
        core = sum(s["duration_minutes"] for s in stages if s["stage"] == "core")
        awake = sum(s["duration_minutes"] for s in stages if s["stage"] == "awake")
        # "asleep" is older API fallback
        asleep_fallback = sum(s["duration_minutes"] for s in stages if s["stage"] == "asleep")
        total = deep + rem + core + asleep_fallback
        in_bed = total + awake
        efficiency = total / in_bed if in_bed > 0 else 0.0
        summaries.append({
            "date": date,
            "total_sleep_minutes": total,
            "deep_sleep_minutes": deep,
            "rem_sleep_minutes": rem,
            "core_sleep_minutes": core,
            "awake_minutes": awake,
            "sleep_efficiency": round(efficiency, 3),
            "stages": stages,
        })
    return summaries[-7:]  # return last 7 days
