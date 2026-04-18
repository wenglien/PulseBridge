from __future__ import annotations
"""
CSV parser for Apple Watch health data exports.

Supports two ECG formats:

  Format A — Native Apple Watch export (from the Health app "Export PDF" → CSV):
    Metadata key-value rows (記錄日期, 分類, 取樣頻率 …)
    followed by raw µV voltage readings, one per line.
    Detected by presence of "記錄日期" / "取樣頻率" / "導程" in the first 30 lines.

  Format B — Columnar (Health Auto Export, Cardiogram, etc.):
    Standard CSV with header row containing Date / Classification / Heart Rate columns.

Supported non-ECG formats (Format B style only):
  heartrate — Date, Heart Rate (count/min)
  hrv       — Date, Heart Rate Variability (ms) / SDNN
"""
import csv
import io
import re
from datetime import datetime
from typing import Optional


# ---------------------------------------------------------------------------
# Chinese → internal ECG classification map
# ---------------------------------------------------------------------------

_ZH_CLASS_MAP: dict[str, str] = {
    "正常竇性心律": "sinusRhythm",
    "竇性心律":     "sinusRhythm",
    "心房顫動":     "atrialFibrillation",
    "心率過高":     "inconclusiveHighHeartRate",
    "心率過低":     "inconclusiveLowHeartRate",
    "記錄不良":     "inconclusiveOther",
    "無法分類":     "notDetermined",
    # English (for Format B)
    "sinus rhythm":        "sinusRhythm",
    "atrial fibrillation": "atrialFibrillation",
    "high heart rate":     "inconclusiveHighHeartRate",
    "low heart rate":      "inconclusiveLowHeartRate",
    "inconclusive":        "inconclusiveOther",
    "poor recording":      "inconclusiveOther",
    "not determined":      "notDetermined",
}


def _normalize_ecg_class(raw: str) -> str:
    """Map any known classification string (ZH or EN) to a canonical value."""
    s = raw.strip()
    # Exact match first
    if s in _ZH_CLASS_MAP:
        return _ZH_CLASS_MAP[s]
    sl = s.lower()
    for key, val in _ZH_CLASS_MAP.items():
        if key in sl or key in s:
            return val
    # Fallback keyword scan
    if "sinus" in sl:
        return "sinusRhythm"
    if "atrial" in sl or "afib" in sl or "fibrillation" in sl:
        return "atrialFibrillation"
    if "high" in sl and "rate" in sl:
        return "inconclusiveHighHeartRate"
    if "low" in sl and "rate" in sl:
        return "inconclusiveLowHeartRate"
    if "inconclusive" in sl or "poor" in sl:
        return "inconclusiveOther"
    return "notDetermined"


# ---------------------------------------------------------------------------
# Internal helpers (shared)
# ---------------------------------------------------------------------------

def _decode_text(content: bytes) -> str:
    """Decode bytes; try UTF-8-BOM, then UTF-8, then big5 (common for TW devices)."""
    for enc in ("utf-8-sig", "utf-8", "big5", "gbk"):
        try:
            return content.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return content.decode("utf-8", errors="replace")


def _parse_date(s: str) -> str:
    s = s.strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%d %H:%M:%S%z",
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


def _find_col(headers: list[str], keywords: list[str]) -> Optional[str]:
    for h in headers:
        if any(k in h.lower() for k in keywords):
            return h
    return None


# ---------------------------------------------------------------------------
# Format detection
# ---------------------------------------------------------------------------

_NATIVE_MARKERS = ("記錄日期", "取樣頻率", "導程", "赫茲", "分類")


def _is_native_apple_ecg(text: str) -> bool:
    """Return True if the text looks like a native Apple Watch ECG export."""
    head = "\n".join(text.splitlines()[:30])
    return any(m in head for m in _NATIVE_MARKERS)


def detect_csv_type(content: bytes) -> str:
    """
    Detect CSV type: 'ecg', 'heartrate', 'hrv', or 'unknown'.
    Handles both native Apple Watch ECG exports and columnar CSVs.
    """
    text = _decode_text(content)

    # Native Apple Watch ECG format takes priority
    if _is_native_apple_ecg(text):
        return "ecg"

    # Columnar format — inspect headers
    reader = csv.DictReader(io.StringIO(text))
    headers = [h.strip().lower() for h in (reader.fieldnames or [])]
    joined = " ".join(headers)

    if any(k in joined for k in ("classification", "algorithmic", "ecg", "rhythm")):
        return "ecg"
    if any(k in joined for k in ("variability", "sdnn", "rmssd", "hrv")):
        return "hrv"
    if any(k in joined for k in ("heart rate", "bpm")):
        return "heartrate"
    return "unknown"


# ---------------------------------------------------------------------------
# Format A: Native Apple Watch ECG CSV parser
# ---------------------------------------------------------------------------

# Metadata keys we care about (ZH labels from the Health app)
_META_KEYS = {
    "記錄日期":  "record_date",
    "分類":      "classification",
    "取樣頻率":  "sample_rate",
    "症狀":      "symptoms",
    "軟體版本":  "software_version",
    "裝置":      "device",
    "出生日期":  "birth_date",
    "姓名":      "name",
    "名稱":      "name",
}

# Also handle English labels for international devices
_META_KEYS_EN = {
    "name":            "name",
    "date of birth":   "birth_date",
    "recorded date":   "record_date",
    "classification":  "classification",
    "symptoms":        "symptoms",
    "software version":"software_version",
    "device":          "device",
    "sample rate":     "sample_rate",
}


def _parse_native_apple_ecg(text: str) -> list[dict]:
    """
    Parse a native Apple Watch ECG CSV export.

    Returns a list containing ONE ECGReading-compatible dict with:
      - timestamp         : ISO-8601 string from 記錄日期
      - classification    : normalised classification string
      - average_heart_rate: 0.0 (not present in native format)
      - voltage_measurements: list[float] of µV values at 512 Hz
      - sample_rate_hz    : int (usually 512)
      - lead_type         : "AppleWatchSimilarToLeadI"
    """
    lines = text.splitlines()

    meta: dict[str, str] = {}
    voltages: list[float] = []
    in_voltage_section = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # --- Try to parse as key,value metadata ---
        # Split on the FIRST comma only (values may contain commas)
        parts = stripped.split(",", 1)
        key_raw = parts[0].strip().strip('"')
        val_raw = parts[1].strip().strip('"') if len(parts) > 1 else ""

        # Check known metadata keys (ZH)
        zh_key = _META_KEYS.get(key_raw)
        if zh_key:
            meta[zh_key] = val_raw
            in_voltage_section = False
            continue

        # Check known metadata keys (EN)
        en_key = _META_KEYS_EN.get(key_raw.lower())
        if en_key:
            meta[en_key] = val_raw
            in_voltage_section = False
            continue

        # Skip lead / unit header rows ("導程,導程I" / "單位,µV")
        if key_raw in ("導程", "單位", "Lead", "Unit"):
            in_voltage_section = True
            continue

        # After the lead header, any line that looks like a float is a voltage
        if in_voltage_section or _looks_like_float(stripped):
            try:
                voltages.append(float(stripped))
                in_voltage_section = True
            except ValueError:
                # Non-numeric line resets the voltage section
                in_voltage_section = False

    if not voltages:
        return []

    # Parse sample rate (e.g. "512赫茲" → 512)
    sr_raw = meta.get("sample_rate", "512")
    sr_match = re.search(r"(\d+)", sr_raw)
    sample_rate = int(sr_match.group(1)) if sr_match else 512

    # Build the single ECGReading record
    ts = _parse_date(meta.get("record_date", ""))
    cls = _normalize_ecg_class(meta.get("classification", ""))

    return [{
        "timestamp":            ts,
        "average_heart_rate":   0.0,
        "classification":       cls,
        "voltage_measurements": voltages,
        "sample_rate_hz":       sample_rate,
        "lead_type":            "AppleWatchSimilarToLeadI",
        "symptoms":             meta.get("symptoms", ""),
        "device":               meta.get("device", ""),
    }]


def _looks_like_float(s: str) -> bool:
    """Quick check: does this string look like a decimal number (possibly negative)?"""
    return bool(re.match(r"^-?\d+(\.\d+)?$", s))


# ---------------------------------------------------------------------------
# Format B: Columnar ECG CSV parser (Health Auto Export / Cardiogram)
# ---------------------------------------------------------------------------

def _parse_columnar_ecg(text: str) -> list[dict]:
    """
    Parse a columnar ECG CSV (e.g. from Health Auto Export).
    Expected headers: Date, Classification, Heart Rate (count/min)
    """
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []

    headers = [h.strip() for h in reader.fieldnames]
    date_col = _find_col(headers, ["date", "timestamp", "time", "start"])
    cls_col  = _find_col(headers, ["classification", "algorithmic", "result", "rhythm"])
    hr_col   = _find_col(headers, ["heart rate", "bpm", "hr"])

    out = []
    for row in reader:
        row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
        ts  = _parse_date(row.get(date_col, "")) if date_col else ""
        cls = _normalize_ecg_class(row.get(cls_col, "") if cls_col else "")
        hr  = _safe_float(row.get(hr_col, "0") if hr_col else "0")
        out.append({
            "timestamp":            ts,
            "average_heart_rate":   hr,
            "classification":       cls,
            "voltage_measurements": [],
            "sample_rate_hz":       512,
            "lead_type":            "AppleWatchSimilarToLeadI",
            "symptoms":             "",
            "device":               "",
        })
    return out


# ---------------------------------------------------------------------------
# Public: unified ECG parser
# ---------------------------------------------------------------------------

def parse_ecg_csv(content: bytes) -> list[dict]:
    """
    Parse an Apple Watch ECG CSV file.

    Auto-detects between:
      - Native Apple Watch export (metadata + raw µV voltages)
      - Columnar export (Health Auto Export / Cardiogram)

    Returns a list of ECGReading-compatible dicts.
    """
    text = _decode_text(content)
    if _is_native_apple_ecg(text):
        return _parse_native_apple_ecg(text)
    return _parse_columnar_ecg(text)


# ---------------------------------------------------------------------------
# Public: heart rate CSV parser
# ---------------------------------------------------------------------------

def parse_heartrate_csv(content: bytes) -> list[dict]:
    """
    Parse heart rate CSV. Returns list of {timestamp, bpm} dicts.
    Expected columns: Date, Heart Rate (count/min)
    """
    text = _decode_text(content)
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []

    headers = [h.strip() for h in reader.fieldnames]
    date_col = _find_col(headers, ["date", "timestamp", "time", "start"])
    hr_col   = _find_col(headers, ["heart rate", "bpm", "hr", "value"])

    out = []
    for row in reader:
        row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
        ts  = _parse_date(row.get(date_col, "")) if date_col else ""
        bpm = _safe_float(row.get(hr_col, "0") if hr_col else "0")
        if 20 < bpm < 300:
            out.append({"timestamp": ts, "bpm": bpm})
    return out


# ---------------------------------------------------------------------------
# Public: HRV CSV parser
# ---------------------------------------------------------------------------

def parse_hrv_csv(content: bytes) -> list[dict]:
    """
    Parse HRV CSV (SDNN / RMSSD values in ms).
    Returns hrv_from_sdnn_records-compatible dicts: {timestamp, value_ms}
    """
    text = _decode_text(content)
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []

    headers = [h.strip() for h in reader.fieldnames]
    date_col = _find_col(headers, ["date", "timestamp", "time"])
    hrv_col  = _find_col(headers, ["variability", "sdnn", "rmssd", "hrv", "value"])

    out = []
    for row in reader:
        row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
        ts  = _parse_date(row.get(date_col, "")) if date_col else ""
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
