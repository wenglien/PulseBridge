from __future__ import annotations
"""
CSV parser for Apple Watch health data exports.
Supports outputs from Health Auto Export (iOS app) and similar tools.

Detected file types (by column headers):
  ecg       - Date, Classification, Heart Rate (count/min)
  heartrate - Date, Heart Rate (count/min)
  hrv       - Date, Heart Rate Variability (ms) / SDNN
"""
import csv
import io
from datetime import datetime
from typing import Optional


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _decode(content: bytes) -> tuple[list[str], list[dict]]:
    """Decode bytes (handling BOM) and parse CSV rows."""
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return [], []
    headers = [h.strip() for h in reader.fieldnames]
    rows = [
        {k.strip(): (v or "").strip() for k, v in row.items() if k}
        for row in reader
    ]
    return headers, rows


def _find_col(headers: list[str], keywords: list[str]) -> Optional[str]:
    """Return the first header that contains any keyword (case-insensitive)."""
    for h in headers:
        hl = h.lower()
        if any(k in hl for k in keywords):
            return h
    return None


def _parse_date(s: str) -> str:
    s = s.strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%d/%m/%Y %H:%M",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(s, fmt).isoformat()
        except ValueError:
            continue
    return s


def _safe_float(s: str) -> float:
    try:
        return float(s.split()[0]) if s else 0.0
    except (ValueError, IndexError):
        return 0.0


def _normalize_ecg_class(raw: str) -> str:
    r = raw.lower()
    if "sinus" in r:
        return "sinusRhythm"
    if "atrial" in r or "afib" in r or "fibrillation" in r:
        return "atrialFibrillation"
    if "high" in r and "rate" in r:
        return "inconclusiveHighHeartRate"
    if "low" in r and "rate" in r:
        return "inconclusiveLowHeartRate"
    if "inconclusive" in r or "poor" in r:
        return "inconclusiveOther"
    return "notDetermined"


# ---------------------------------------------------------------------------
# Public: type detection
# ---------------------------------------------------------------------------

def detect_csv_type(content: bytes) -> str:
    """Detect CSV type from column headers: 'ecg', 'heartrate', 'hrv', or 'unknown'."""
    headers, _ = _decode(content)
    joined = " ".join(h.lower() for h in headers)
    if any(k in joined for k in ("classification", "algorithmic", "ecg")):
        return "ecg"
    if any(k in joined for k in ("variability", "sdnn", "rmssd", "hrv")):
        return "hrv"
    if any(k in joined for k in ("heart rate", "bpm")):
        return "heartrate"
    return "unknown"


# ---------------------------------------------------------------------------
# Public: parsers
# ---------------------------------------------------------------------------

def parse_ecg_csv(content: bytes) -> list[dict]:
    """
    Parse ECG CSV. Returns ECGReading-compatible dicts.
    Expected columns: Date, Classification, Heart Rate (count/min)
    """
    headers, rows = _decode(content)
    if not rows:
        return []

    date_col = _find_col(headers, ["date", "timestamp", "time", "start"])
    cls_col  = _find_col(headers, ["classification", "algorithmic", "result", "rhythm"])
    hr_col   = _find_col(headers, ["heart rate", "bpm", "hr"])

    out = []
    for row in rows:
        ts  = _parse_date(row[date_col]) if date_col else ""
        cls = _normalize_ecg_class(row.get(cls_col, "") if cls_col else "")
        hr  = _safe_float(row.get(hr_col, "0") if hr_col else "0")
        out.append({
            "timestamp": ts,
            "average_heart_rate": hr,
            "classification": cls,
            "voltage_measurements": [],
            "lead_type": "AppleWatchSimilarToLeadI",
        })
    return out


def parse_heartrate_csv(content: bytes) -> list[dict]:
    """
    Parse heart rate CSV. Returns list of {timestamp, bpm} dicts.
    Expected columns: Date, Heart Rate (count/min)
    """
    headers, rows = _decode(content)
    if not rows:
        return []

    date_col = _find_col(headers, ["date", "timestamp", "time", "start"])
    hr_col   = _find_col(headers, ["heart rate", "bpm", "hr", "value"])

    out = []
    for row in rows:
        ts  = _parse_date(row[date_col]) if date_col else ""
        bpm = _safe_float(row.get(hr_col, "0") if hr_col else "0")
        if 20 < bpm < 300:
            out.append({"timestamp": ts, "bpm": bpm})
    return out


def parse_hrv_csv(content: bytes) -> list[dict]:
    """
    Parse HRV CSV (SDNN / RMSSD values in ms).
    Expected columns: Date, Heart Rate Variability (ms)
    Returns hrv_from_sdnn_records-compatible dicts: {timestamp, value_ms}
    """
    headers, rows = _decode(content)
    if not rows:
        return []

    date_col = _find_col(headers, ["date", "timestamp", "time"])
    hrv_col  = _find_col(headers, ["variability", "sdnn", "rmssd", "hrv", "value"])

    out = []
    for row in rows:
        ts  = _parse_date(row[date_col]) if date_col else ""
        val = _safe_float(row.get(hrv_col, "0") if hrv_col else "0")
        if val > 0:
            out.append({"timestamp": ts, "value_ms": val})
    return out


# ---------------------------------------------------------------------------
# Derived metrics from HR timeseries
# ---------------------------------------------------------------------------

def resting_hr_from_records(hr_records: list[dict]) -> float:
    """Estimate resting HR as the 10th-percentile of all readings."""
    bpms = sorted(r["bpm"] for r in hr_records if 30 < r["bpm"] < 250)
    if not bpms:
        return 0.0
    idx = max(0, int(len(bpms) * 0.10))
    return round(bpms[idx], 1)


def rr_intervals_from_hr(hr_records: list[dict]) -> list[float]:
    """Convert HR readings to approximate RR intervals (ms) for HRV estimation."""
    return [
        round(60000.0 / r["bpm"], 1)
        for r in hr_records
        if 30 < r["bpm"] < 250
    ]
