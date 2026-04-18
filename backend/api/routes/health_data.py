from __future__ import annotations
"""Health data upload (CSV / XML) and retrieval routes."""
import asyncio
import gzip
import shutil
from pathlib import Path
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
from datetime import datetime

from api.dependencies import generate_session_id, save_session, load_session
from core.config import settings
from core.csv_parser import (
    detect_csv_type,
    parse_ecg_csv,
    parse_heartrate_csv,
    parse_hrv_csv,
    resting_hr_from_records,
    rr_intervals_from_hr,
)
from core.xml_stream_parser import scan_file, extract_records, DATA_TYPE_MAP
from core.hrv_analyzer import compute_hrv_metrics, hrv_from_sdnn_records
from core.ecg_analyzer import detect_r_peaks_and_hr
from core.healthkit_parser import aggregate_sleep_by_date
from models.health_data import (
    ExtractRequest, ManualHealthInput,
    HRVMetrics, SleepData, SleepStage, ECGReading, HealthData,
)

router = APIRouter(prefix="/health-data", tags=["health-data"])

_MAX_CSV_BYTES = 20 * 1024 * 1024  # 20 MB per file

# In-memory progress map for XML extract; keyed by session_id, value in [0, 1].
# Single-process only — good enough for local / single-worker deployments.
_extract_progress: dict[str, float] = {}


@router.post("/upload-csv")
async def upload_csv(files: List[UploadFile] = File(...)):
    """
    Accept one or more CSV files (ECG, Heart Rate, HRV).
    File type is auto-detected from column headers.
    """
    if not files:
        raise HTTPException(400, "請上傳至少一個 CSV 檔案")

    ecg_records: list[dict] = []
    hr_records:  list[dict] = []
    hrv_sdnn_records: list[dict] = []

    for f in files:
        raw = await f.read()
        if not raw:
            continue
        if len(raw) > _MAX_CSV_BYTES:
            raise HTTPException(400, f"{f.filename} 超過 20MB 限制")

        csv_type = detect_csv_type(raw)

        # Fallback: guess from filename if headers are ambiguous
        if csv_type == "unknown":
            fn = (f.filename or "").lower()
            if "ecg" in fn or "electrocardiogram" in fn:
                csv_type = "ecg"
            elif "hrv" in fn or "variability" in fn:
                csv_type = "hrv"
            else:
                csv_type = "heartrate"

        if csv_type == "ecg":
            ecg_records.extend(parse_ecg_csv(raw))
        elif csv_type == "hrv":
            hrv_sdnn_records.extend(parse_hrv_csv(raw))
        else:
            hr_records.extend(parse_heartrate_csv(raw))

    if not ecg_records and not hr_records and not hrv_sdnn_records:
        raise HTTPException(400, "無法從上傳的檔案中讀取任何健康資料，請確認欄位格式正確")

    session_id = generate_session_id()

    # --- Compute HRV ---
    hrv_data: HRVMetrics | None = None
    if hrv_sdnn_records:
        hrv_raw = hrv_from_sdnn_records(hrv_sdnn_records)
        if hrv_raw:
            hrv_data = HRVMetrics(**hrv_raw)
            hrv_data.sdnn_series = [
                {"timestamp": r.get("timestamp", ""), "value_ms": float(r.get("value_ms", 0))}
                for r in hrv_sdnn_records if r.get("value_ms", 0) > 0
            ]
    if hrv_data is None and hr_records:
        rr = rr_intervals_from_hr(hr_records)
        if rr:
            hrv_raw = compute_hrv_metrics(rr)
            if hrv_raw:
                hrv_data = HRVMetrics(**hrv_raw)

    # --- ECG list (cap at 50) ---
    ecg_list = [ECGReading(**r) for r in ecg_records[:50]]

    # --- HRV from native ECG voltages (fallback when no dedicated HRV file) ---
    if hrv_data is None and ecg_list:
        all_rr: list[float] = []
        for ecg_r in ecg_list:
            if len(ecg_r.voltage_measurements) >= ecg_r.sample_rate_hz:
                peaks, _ = detect_r_peaks_and_hr(
                    ecg_r.voltage_measurements, ecg_r.sample_rate_hz
                )
                if len(peaks) >= 3:
                    rr_ms = [
                        (peaks[i + 1] - peaks[i]) * 1000.0 / ecg_r.sample_rate_hz
                        for i in range(len(peaks) - 1)
                        if 333 < (peaks[i + 1] - peaks[i]) * 1000.0 / ecg_r.sample_rate_hz < 2000
                    ]
                    all_rr.extend(rr_ms)
        if len(all_rr) >= 4:
            hrv_raw = compute_hrv_metrics(all_rr)
            if hrv_raw:
                hrv_data = HRVMetrics(**hrv_raw)

    # --- Resting HR ---
    resting_hr = 0.0
    if hr_records:
        resting_hr = resting_hr_from_records(hr_records)
    elif ecg_list:
        # Prefer R-peak detected HR; fall back to stored average
        detected_hrs = []
        for ecg_r in ecg_list:
            if ecg_r.average_heart_rate > 0:
                detected_hrs.append(ecg_r.average_heart_rate)
            elif len(ecg_r.voltage_measurements) >= ecg_r.sample_rate_hz:
                _, hr = detect_r_peaks_and_hr(ecg_r.voltage_measurements, ecg_r.sample_rate_hz)
                if hr > 0:
                    detected_hrs.append(hr)
        if detected_hrs:
            resting_hr = round(min(detected_hrs), 1)  # lowest detected = closest to resting

    health_data = HealthData(
        session_id=session_id,
        ecg_readings=ecg_list,
        hrv=hrv_data,
        sleep=[],
        resting_heart_rate=resting_hr,
    )

    save_session(session_id, {
        "health": health_data.model_dump(),
        "status": "health_uploaded",
    })

    return {"session_id": session_id, "parsed": health_data.model_dump()}


@router.post("/manual")
async def manual_input(data: ManualHealthInput):
    """Create a session from manually entered health metrics."""
    session_id = data.session_id or generate_session_id()

    hrv_data: HRVMetrics | None = None
    if data.sdnn > 0:
        hrv_data = HRVMetrics(
            sdnn=data.sdnn,
            rmssd=data.rmssd,
            pnn50=max(0, (data.sdnn - 20) * 1.2),
            mean_rr=860.0,
            lf_power=data.sdnn * 0.4,
            hf_power=data.rmssd * 0.3,
            lf_hf_ratio=data.lf_hf_ratio,
            rr_intervals=[],
            timestamps=[],
        )

    sleep_list: list[SleepData] = []
    if data.sleep_hours > 0:
        total = data.sleep_hours * 60
        deep  = total * (data.deep_sleep_pct / 100)
        rem   = total * (data.rem_sleep_pct / 100)
        core  = total * 0.5 - deep * 0.1
        awake = total * (1 - data.sleep_efficiency)
        today = datetime.utcnow().strftime("%Y-%m-%d")
        sleep_list.append(SleepData(
            date=today,
            total_sleep_minutes=total,
            deep_sleep_minutes=deep,
            rem_sleep_minutes=rem,
            core_sleep_minutes=max(0, core),
            awake_minutes=max(0, awake),
            sleep_efficiency=data.sleep_efficiency,
            stages=[],
        ))

    health_data = HealthData(
        session_id=session_id,
        age=data.age,
        hrv=hrv_data,
        sleep=sleep_list,
        resting_heart_rate=data.resting_heart_rate,
        stress_level=data.stress_level,
    )

    save_session(session_id, {
        "health": health_data.model_dump(),
        "status": "health_uploaded",
    })

    return {"session_id": session_id, "data": health_data.model_dump()}


@router.post("/add-ecg-csv")
async def add_ecg_csv(
    session_id: str = File(...),
    file: UploadFile = File(...),
):
    """
    Parse an ECG CSV and merge the readings into an existing session.
    The session must already exist (created by upload-xml/extract or upload-csv).
    """
    session = load_session(session_id)
    if not session or "health" not in session:
        raise HTTPException(404, "Session not found — please upload health data first")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "檔案是空的")
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(400, "ECG CSV 超過 20 MB 限制")

    ecg_records = parse_ecg_csv(raw)
    if not ecg_records:
        raise HTTPException(400, "無法從此 CSV 讀取 ECG 資料，請確認欄位包含 Date 和 Classification")

    ecg_list = [ECGReading(**r) for r in ecg_records[:200]]

    # Merge into existing health data
    health = session["health"]
    health["ecg_readings"] = [r.model_dump() for r in ecg_list]
    save_session(session_id, {"health": health})

    return {"session_id": session_id, "ecg_count": len(ecg_list)}


# ---------------------------------------------------------------------------
# XML upload / scan / extract  (large file, memory-safe streaming)
# ---------------------------------------------------------------------------

@router.post("/upload-xml")
async def upload_xml(file: UploadFile = File(...)):
    """
    Save the Apple Health XML to disk in 1 MB chunks (memory-safe).
    Accepts plain .xml or browser-gzipped .xml.gz (gzip deflate).
    After upload, .gz is decompressed to {session_id}.xml for scan/extract.
    Returns session_id、檔案大小，以及同請求內完成的 scan（日期區間與可用類型）。
    """
    name = (file.filename or "").lower()
    is_gz = name.endswith(".gz")
    is_xml = name.endswith(".xml") and not is_gz

    if not (is_xml or is_gz):
        raise HTTPException(400, "請上傳 .xml 或 .xml.gz（gzip 壓縮）格式的 Apple Health 匯出檔案")

    session_id = generate_session_id()
    upload_dir = settings.uploads_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    xml_path = upload_dir / f"{session_id}.xml"

    upload_bytes = 0

    if is_gz:
        gz_path = upload_dir / f"{session_id}.xml.gz"
        with open(gz_path, "wb") as gz_f:
            while chunk := await file.read(1024 * 1024):
                gz_f.write(chunk)
                upload_bytes += len(chunk)
        try:
            with gzip.open(gz_path, "rb") as src, open(xml_path, "wb") as dst:
                shutil.copyfileobj(src, dst, length=1024 * 1024)
        except (OSError, EOFError) as e:
            gz_path.unlink(missing_ok=True)
            xml_path.unlink(missing_ok=True)
            raise HTTPException(400, f"無法解壓縮 gzip 檔案：{e}") from e
        gz_path.unlink(missing_ok=True)
        xml_size = xml_path.stat().st_size
    else:
        with open(xml_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                f.write(chunk)
                upload_bytes += len(chunk)
        xml_size = xml_path.stat().st_size

    save_session(session_id, {
        "xml_path": str(xml_path),
        "status":   "xml_uploaded",
    })

    # 與 GET /scan 分開的第二個請求在 Cloud Run 滾動更新／多實例時可能打到不同容器，
    # 本機 SQLite + 磁碟會出現「session 不存在」404。掃描與上傳同一請求內完成可避免該競態。
    scan_payload = await asyncio.to_thread(scan_file, xml_path)

    return {
        "session_id":         session_id,
        "file_size_mb":       round(xml_size / 1024 / 1024, 1),
        "upload_size_mb":     round(upload_bytes / 1024 / 1024, 1),
        "was_gzip_upload":    is_gz,
        "scan":               scan_payload,
    }


@router.get("/scan/{session_id}")
async def scan_xml(session_id: str):
    """
    Fast byte-level scan: return date range + available data types.
    Runs in a thread pool to avoid blocking the event loop.
    """
    session = load_session(session_id)
    if not session or "xml_path" not in session:
        raise HTTPException(404, "Session not found or XML not uploaded")

    xml_path = Path(session["xml_path"])
    if not xml_path.exists():
        raise HTTPException(404, "XML file not found on server")

    result = await asyncio.to_thread(scan_file, xml_path)
    return result


@router.post("/extract")
async def extract_xml(body: ExtractRequest):
    """
    Streaming iterparse extraction: only reads records matching
    the requested data types and date range.
    """
    session = load_session(body.session_id)
    if not session or "xml_path" not in session:
        raise HTTPException(404, "Session not found or XML not uploaded")

    xml_path = Path(session["xml_path"])
    if not xml_path.exists():
        raise HTTPException(404, "XML file not found on server")

    if not body.data_types:
        raise HTTPException(400, "請選擇至少一個資料類型")

    # Progress callback: stores latest pct in a module-level dict for polling.
    _extract_progress[body.session_id] = 0.0
    def _on_progress(pct: float) -> None:
        _extract_progress[body.session_id] = pct

    # Run CPU-intensive parsing in thread pool
    try:
        raw = await asyncio.to_thread(
            extract_records,
            xml_path,
            body.start_date,
            body.end_date,
            body.data_types,
            _on_progress,
        )
    finally:
        _extract_progress[body.session_id] = 1.0

    # ── HRV ──────────────────────────────────────────────────────────────
    hrv_data: HRVMetrics | None = None
    sdnn_records: list[dict] = []
    if raw.get("hrv"):
        # Prefer beat-by-beat RR intervals for real HRV computation
        all_bpms: list[float] = []
        for r in raw["hrv"]:
            all_bpms.extend(r.get("beat_bpms", []))
            if r.get("value_ms", 0) > 0:
                sdnn_records.append({"timestamp": r["timestamp"], "value_ms": r["value_ms"]})

        hrv_raw = None
        if all_bpms:
            rr = [60000.0 / b for b in all_bpms if 20 < b < 300]
            hrv_raw = compute_hrv_metrics(rr)
        if not hrv_raw and sdnn_records:
            hrv_raw = hrv_from_sdnn_records(sdnn_records)
        if hrv_raw:
            hrv_data = HRVMetrics(**hrv_raw)
            if sdnn_records:
                hrv_data.sdnn_series = [
                    {"timestamp": r["timestamp"], "value_ms": float(r["value_ms"])}
                    for r in sdnn_records
                ]

    # Fall back to estimating HRV from dense heart rate data
    if hrv_data is None and raw.get("heart_rate"):
        rr = [60000.0 / float(r["value"]) for r in raw["heart_rate"]
              if r.get("value") and 20 < float(r["value"]) < 300]
        hrv_raw = compute_hrv_metrics(rr) if rr else None
        if hrv_raw:
            hrv_data = HRVMetrics(**hrv_raw)

    # ── Resting HR ────────────────────────────────────────────────────────
    resting_hr = 0.0
    if raw.get("resting_hr"):
        vals = [float(r["value"]) for r in raw["resting_hr"] if r.get("value")]
        resting_hr = round(sum(vals) / len(vals), 1) if vals else 0.0
    elif raw.get("heart_rate"):
        bpms = sorted(float(r["value"]) for r in raw["heart_rate"]
                      if r.get("value") and 20 < float(r["value"]) < 250)
        if bpms:
            resting_hr = round(bpms[max(0, int(len(bpms) * 0.10))], 1)

    # ── Sleep ─────────────────────────────────────────────────────────────
    sleep_list: list[SleepData] = []
    if raw.get("sleep"):
        for s in aggregate_sleep_by_date(raw["sleep"]):
            stages = [SleepStage(**stage) for stage in s.pop("stages", [])]
            sleep_list.append(SleepData(**s, stages=stages))

    # ── ECG ───────────────────────────────────────────────────────────────
    ecg_list = [ECGReading(**r) for r in (raw.get("ecg") or [])[:50]]

    # ── Build session ─────────────────────────────────────────────────────
    health_data = HealthData(
        session_id=body.session_id,
        ecg_readings=ecg_list,
        hrv=hrv_data,
        sleep=sleep_list,
        resting_heart_rate=resting_hr,
    )

    # Record counts for the UI
    counts = {k: len(v) for k, v in raw.items() if v}

    save_session(body.session_id, {
        "health": health_data.model_dump(),
        "status": "health_uploaded",
    })

    return {
        "session_id": body.session_id,
        "parsed":     health_data.model_dump(),
        "record_counts": counts,
    }


@router.get("/extract-progress/{session_id}")
async def extract_progress(session_id: str):
    """Return the latest extract progress pct in [0, 1] for the given session."""
    return {"pct": _extract_progress.get(session_id, 0.0)}


# 必須註冊在 /scan/、/extract 等固定路徑之後，否則「scan」會被當成 {session_id}
@router.get("/{session_id}")
async def get_health_data(session_id: str):
    session = load_session(session_id)
    if not session or "health" not in session:
        raise HTTPException(404, "Session not found or health data missing")
    return session["health"]
