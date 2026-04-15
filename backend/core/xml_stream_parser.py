from __future__ import annotations
"""
Memory-efficient streaming parser for Apple HealthKit XML exports.

Two-phase design:
  1. scan_file()      — fast byte-level regex scan (~5-15s for 400MB)
                        Returns date range + which data types exist.
  2. extract_records() — iterparse scan that only keeps matching records.
                        CPU runs in a thread pool (see route).

Supported user-facing keys → HealthKit type identifiers:
  hrv              HKQuantityTypeIdentifierHeartRateVariabilitySDNN
  heart_rate       HKQuantityTypeIdentifierHeartRate
  resting_hr       HKQuantityTypeIdentifierRestingHeartRate
  sleep            HKCategoryTypeIdentifierSleepAnalysis
  respiratory_rate HKQuantityTypeIdentifierRespiratoryRate
  oxygen_saturation HKQuantityTypeIdentifierOxygenSaturation
  wrist_temp       HKQuantityTypeIdentifierAppleSleepingWristTemperature
  vo2_max          HKQuantityTypeIdentifierVO2Max
  ecg              (ECGSample XML element)
"""
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime

# ---------------------------------------------------------------------------
# Data type mapping
# ---------------------------------------------------------------------------

DATA_TYPE_MAP: dict[str, str] = {
    "hrv":               "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
    "heart_rate":        "HKQuantityTypeIdentifierHeartRate",
    "resting_hr":        "HKQuantityTypeIdentifierRestingHeartRate",
    "sleep":             "HKCategoryTypeIdentifierSleepAnalysis",
    "respiratory_rate":  "HKQuantityTypeIdentifierRespiratoryRate",
    "oxygen_saturation": "HKQuantityTypeIdentifierOxygenSaturation",
    "wrist_temp":        "HKQuantityTypeIdentifierAppleSleepingWristTemperature",
    "vo2_max":           "HKQuantityTypeIdentifierVO2Max",
}

# Reverse: HK identifier bytes → user key
_HK_TO_KEY: dict[bytes, str] = {v.encode(): k for k, v in DATA_TYPE_MAP.items()}

# Tags that are direct children of <HealthData>
_TOP_LEVEL = {"Record", "ECGSample", "Workout", "ActivitySummary", "Correlation", "Me", "ExportDate"}

# Sleep stage normalization
_SLEEP_STAGE_MAP = {
    "HKCategoryValueSleepAnalysisAsleepCore":        "core",
    "HKCategoryValueSleepAnalysisAsleepDeep":        "deep",
    "HKCategoryValueSleepAnalysisAsleepREM":         "rem",
    "HKCategoryValueSleepAnalysisAwake":             "awake",
    "HKCategoryValueSleepAnalysisInBed":             "inBed",
    "HKCategoryValueSleepAnalysisAsleepUnspecified": "asleep",
}


# ---------------------------------------------------------------------------
# Phase 1 — fast byte-level scan
# ---------------------------------------------------------------------------

def scan_file(xml_path: Path) -> dict:
    """
    Single-pass byte scan: discover date range and available data types.
    Reads the file in 4 MB chunks using compiled regex — no XML parsing.
    """
    date_pat = re.compile(rb'startDate="(\d{4}-\d{2}-\d{2})')

    # Build a single alternation pattern for all known HK identifiers
    hk_ids_re = b"|".join(re.escape(k) for k in _HK_TO_KEY)
    type_pat  = re.compile(rb'type="(' + hk_ids_re + rb')"')

    min_d = max_d = None
    found: set[str] = set()

    CHUNK = 4 << 20   # 4 MB
    TAIL  = 300       # overlap to catch patterns split across chunk boundary

    with open(xml_path, "rb") as fh:
        tail = b""
        while buf := fh.read(CHUNK):
            data = tail + buf
            tail = data[-TAIL:]

            for m in date_pat.finditer(data):
                d = m.group(1).decode()
                if min_d is None or d < min_d:
                    min_d = d
                if max_d is None or d > max_d:
                    max_d = d

            for m in type_pat.finditer(data):
                key = _HK_TO_KEY.get(m.group(1))
                if key:
                    found.add(key)

            if b"<ECGSample" in data:
                found.add("ecg")

    return {
        "min_date":       min_d or "",
        "max_date":       max_d or "",
        "available_types": sorted(found),
    }


# ---------------------------------------------------------------------------
# Phase 2 — selective iterparse extraction
# ---------------------------------------------------------------------------

def extract_records(
    xml_path: Path,
    start_date: str,        # "YYYY-MM-DD"
    end_date:   str,        # "YYYY-MM-DD"
    data_types: list[str],  # subset of DATA_TYPE_MAP keys (+ "ecg")
) -> dict[str, list]:
    """
    Stream through the XML with iterparse, keeping only records whose
    type is in `data_types` and whose startDate falls within [start, end].

    Memory: each processed element is detached from the root and cleared,
    so RAM stays constant regardless of file size.
    """
    wanted_hk: dict[str, str] = {
        DATA_TYPE_MAP[k]: k
        for k in data_types
        if k in DATA_TYPE_MAP
    }
    want_ecg = "ecg" in data_types

    results: dict[str, list] = {k: [] for k in data_types}

    # iterparse with both events so we can capture the root on "start"
    context = ET.iterparse(str(xml_path), events=("start", "end"))
    event, root = next(context)   # ("start", <HealthData>)

    for event, elem in context:
        if event != "end" or elem.tag not in _TOP_LEVEL:
            continue

        try:
            if elem.tag == "Record":
                rec_type = elem.get("type", "")
                user_key = wanted_hk.get(rec_type)
                if user_key:
                    sd = elem.get("startDate", "")[:10]
                    if start_date <= sd <= end_date:
                        results[user_key].append(_parse_record(elem, rec_type))

            elif elem.tag == "ECGSample" and want_ecg:
                sd = elem.get("startDate", "")[:10]
                if start_date <= sd <= end_date:
                    results["ecg"].append(_parse_ecg(elem))
        finally:
            # Always detach from root to free memory
            try:
                root.remove(elem)
            except ValueError:
                pass

    return results


# ---------------------------------------------------------------------------
# Element parsers
# ---------------------------------------------------------------------------

def _parse_record(elem, rec_type: str) -> dict:
    sd = elem.get("startDate", "")
    ed = elem.get("endDate", "")

    if rec_type == DATA_TYPE_MAP["hrv"]:
        return _parse_hrv(elem, sd)

    if rec_type == DATA_TYPE_MAP["sleep"]:
        return _parse_sleep(elem, sd, ed)

    # Generic numeric record (heart rate, respiratory rate, SpO2, etc.)
    return {
        "timestamp": sd,
        "value":     elem.get("value", ""),
        "unit":      elem.get("unit", ""),
    }


def _parse_hrv(elem, sd: str) -> dict:
    try:
        value_ms = float(elem.get("value", "0"))
    except ValueError:
        value_ms = 0.0

    beat_bpms: list[float] = []
    hrv_list = elem.find("HeartRateVariabilityMetadataList")
    if hrv_list is not None:
        for beat in hrv_list.findall("InstantaneousBeatsPerMinute"):
            bpm_str = beat.get("bpm")
            if bpm_str:
                try:
                    beat_bpms.append(float(bpm_str))
                except ValueError:
                    pass

    return {"timestamp": sd, "value_ms": value_ms, "beat_bpms": beat_bpms}


def _parse_sleep(elem, sd: str, ed: str) -> dict:
    stage = _SLEEP_STAGE_MAP.get(elem.get("value", ""), "unknown")
    return {
        "start_date":       sd,
        "end_date":         ed,
        "stage":            stage,
        "duration_minutes": _duration_min(sd, ed),
    }


def _parse_ecg(elem) -> dict:
    return {
        "timestamp":           elem.get("startDate", ""),
        "average_heart_rate":  float(elem.get("averageHeartRate", 0) or 0),
        "classification":      elem.get("classification", "notDetermined"),
        "voltage_measurements": [],
        "lead_type":           elem.get("leadType", "AppleWatchSimilarToLeadI"),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _duration_min(start_str: str, end_str: str) -> float:
    for fmt in ("%Y-%m-%d %H:%M:%S %z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            s = datetime.strptime(start_str[:25].strip(), fmt)
            e = datetime.strptime(end_str[:25].strip(), fmt)
            return (e - s).total_seconds() / 60.0
        except ValueError:
            continue
    return 0.0
