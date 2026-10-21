from __future__ import annotations
"""Health data upload (CSV / XML) and retrieval routes."""
import asyncio
import gzip
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from datetime import datetime

from api.auth_deps import get_current_user_optional
from api.dependencies import (
    NOT_FOUND, authorize_session, create_session, load_payload, require_session,
    run_store, session_token, update_session,
)
from db.store import SessionMeta, UserRecord, get_store
from core.config import settings
from core.rate_limit import LIMIT_CREATE
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

_MAX_CSV_BYTES = settings.max_csv_file_size_mb * 1024 * 1024

class _XmlTooLarge(Exception):
    pass


def _max_xml_bytes() -> int:
    return settings.max_xml_size_mb * 1024 * 1024


def _gunzip_capped(src_path: Path, dst_path: Path, max_bytes: int) -> None:
    """Decompress src → dst, aborting once output exceeds max_bytes (gzip-bomb guard)."""
    written = 0
    with gzip.open(src_path, "rb") as src, open(dst_path, "wb") as dst:
        while chunk := src.read(1024 * 1024):
            written += len(chunk)
            if written > max_bytes:
                raise _XmlTooLarge()
            dst.write(chunk)


GZIP_MAGIC = b"\x1f\x8b"


def _cache_path(session_id: str) -> Path:
    """Decompressed export.xml on this instance's local disk (a cache, not the source of truth)."""
    return settings.uploads_dir / f"{session_id}.xml"


def _ensure_local_xml(session_id: str) -> Optional[Path]:
    """
    Return a local, decompressed copy of the session's export. On Cloud Run the
    request may land on a different instance than the upload did, so fall back
    to the copy kept in the store.
    """
    cache = _cache_path(session_id)
    if cache.exists():
        return cache
    fetched = settings.uploads_dir / f"{session_id}.fetched"
    if not get_store().fetch_upload(session_id, fetched):
        return None
    try:
        with open(fetched, "rb") as f:
            is_gz = f.read(2) == GZIP_MAGIC
        if is_gz:
            _gunzip_capped(fetched, cache, _max_xml_bytes())
        else:
            fetched.replace(cache)
    finally:
        fetched.unlink(missing_ok=True)
    return cache


@router.post("/upload-csv", dependencies=[Depends(LIMIT_CREATE)])
async def upload_csv(
    files: List[UploadFile] = File(...),
    user: Optional[UserRecord] = Depends(get_current_user_optional),
):
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
            raise HTTPException(400, f"{f.filename} 超過 {settings.max_csv_file_size_mb}MB 限制")

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

    session_id, new_token = await create_session(user=user, source="csv")

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

    await update_session(session_id, {
        "health": health_data.model_dump(),
        "status": "health_uploaded",
    })

    return {"session_id": session_id, "session_token": new_token, "parsed": health_data.model_dump()}


@router.post("/manual", dependencies=[Depends(LIMIT_CREATE)])
async def manual_input(
    data: ManualHealthInput,
    token: Optional[str] = Depends(session_token),
    user: Optional[UserRecord] = Depends(get_current_user_optional),
):
    """Add manually entered metrics to an owned session, or start a new one."""
    new_token = None
    if data.session_id:
        await authorize_session(data.session_id, token, user)
        session_id = data.session_id
    else:
        session_id, new_token = await create_session(user=user, source="manual")

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

    await update_session(session_id, {
        "health": health_data.model_dump(),
        "status": "health_uploaded",
    })

    body = {"session_id": session_id, "data": health_data.model_dump()}
    if new_token:
        body["session_token"] = new_token
    return body


@router.post("/add-ecg-csv")
async def add_ecg_csv(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    token: Optional[str] = Depends(session_token),
    user: Optional[UserRecord] = Depends(get_current_user_optional),
):
    """
    Parse an ECG CSV and merge the readings into an existing session.
    The session must already exist (created by upload-xml/extract or upload-csv).
    """
    await authorize_session(session_id, token, user)
    session = await load_payload(session_id)
    if "health" not in session:
        raise HTTPException(404, "這份紀錄還沒有健康資料，請先上傳 Apple Health 匯出檔")

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
    await update_session(session_id, {"health": health})

    return {"session_id": session_id, "ecg_count": len(ecg_list)}


# ---------------------------------------------------------------------------
# XML upload / scan / extract  (large file, memory-safe streaming)
# ---------------------------------------------------------------------------

@router.post("/upload-xml", dependencies=[Depends(LIMIT_CREATE)])
async def upload_xml(
    file: UploadFile = File(...),
    user: Optional[UserRecord] = Depends(get_current_user_optional),
):
    """
    Save the Apple Health export (.xml, or browser-gzipped .xml.gz) in 1 MB
    chunks, keep a copy in the store, and scan it in the same request.
    Returns the new session's id and access token plus the scan result
    (date range and available data types).
    """
    name = (file.filename or "").lower()
    is_gz = name.endswith(".gz")
    is_xml = name.endswith(".xml") and not is_gz

    if not (is_xml or is_gz):
        raise HTTPException(400, "請上傳 .xml 或 .xml.gz（gzip 壓縮）格式的 Apple Health 匯出檔案")

    session_id, new_token = await create_session(user=user, source="xml")
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    xml_path = _cache_path(session_id)
    incoming = settings.uploads_dir / f"{session_id}.incoming"
    limit = _max_xml_bytes()
    upload_bytes = 0

    try:
        target = incoming if is_gz else xml_path
        with open(target, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                upload_bytes += len(chunk)
                if upload_bytes > limit:
                    raise HTTPException(413, f"檔案超過 {settings.max_xml_size_mb}MB 上限，請縮短匯出日期範圍")
                f.write(chunk)

        if is_gz:
            try:
                await asyncio.to_thread(_gunzip_capped, incoming, xml_path, limit)
            except _XmlTooLarge as e:
                raise HTTPException(413, f"解壓縮後超過 {settings.max_xml_size_mb}MB 上限，請縮短匯出日期範圍") from e
            except (OSError, EOFError) as e:
                raise HTTPException(400, f"無法解壓縮 gzip 檔案：{e}") from e

        # Keep the (smaller) file as received so any instance can extract later.
        await run_store(get_store().put_upload, session_id, target)
    except BaseException:
        xml_path.unlink(missing_ok=True)
        await run_store(get_store().delete_session, session_id)
        raise
    finally:
        incoming.unlink(missing_ok=True)

    await update_session(session_id, {"status": "xml_uploaded"})
    scan_payload = await asyncio.to_thread(scan_file, xml_path)

    return {
        "session_id":         session_id,
        "session_token":      new_token,
        "file_size_mb":       round(xml_path.stat().st_size / 1024 / 1024, 1),
        "upload_size_mb":     round(upload_bytes / 1024 / 1024, 1),
        "was_gzip_upload":    is_gz,
        "scan":               scan_payload,
    }


@router.get("/scan/{session_id}")
async def scan_xml(meta: SessionMeta = Depends(require_session)):
    """Fast byte-level scan: return date range + available data types."""
    xml_path = await asyncio.to_thread(_ensure_local_xml, meta.id)
    if xml_path is None:
        raise HTTPException(404, "找不到上傳的檔案，請重新上傳")

    result = await asyncio.to_thread(scan_file, xml_path)
    return result


@router.post("/extract")
async def extract_xml(
    body: ExtractRequest,
    token: Optional[str] = Depends(session_token),
    user: Optional[UserRecord] = Depends(get_current_user_optional),
):
    """
    Streaming iterparse extraction: only reads records matching
    the requested data types and date range.
    """
    await authorize_session(body.session_id, token, user)
    if not body.data_types:
        raise HTTPException(400, "請選擇至少一個資料類型")

    xml_path = await asyncio.to_thread(_ensure_local_xml, body.session_id)
    if xml_path is None:
        raise HTTPException(404, "找不到上傳的檔案，請重新上傳")

    store = get_store()
    await run_store(store.set_progress, body.session_id, 0.0)
    last_reported = [0.0]

    def _on_progress(pct: float) -> None:
        # Runs in the worker thread. Persisted (not in memory) so polling works
        # across instances; throttled to keep store writes cheap.
        if pct - last_reported[0] >= 0.05:
            last_reported[0] = pct
            store.set_progress(body.session_id, pct)

    raw = await asyncio.to_thread(
        extract_records,
        xml_path,
        body.start_date,
        body.end_date,
        body.data_types,
        _on_progress,
    )
    await run_store(store.set_progress, body.session_id, 1.0)

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

    await update_session(body.session_id, {
        "health": health_data.model_dump(),
        "status": "health_uploaded",
    })
    # The export is no longer needed once its data is in the session.
    xml_path.unlink(missing_ok=True)
    await run_store(store.delete_upload, body.session_id)

    return {
        "session_id": body.session_id,
        "parsed":     health_data.model_dump(),
        "record_counts": counts,
    }


@router.get("/extract-progress/{session_id}")
async def extract_progress(meta: SessionMeta = Depends(require_session)):
    """Return the latest extract progress pct in [0, 1] for the given session."""
    return {"pct": meta.progress}


# 必須註冊在 /scan/、/extract 等固定路徑之後，否則「scan」會被當成 {session_id}
@router.get("/{session_id}")
async def get_health_data(meta: SessionMeta = Depends(require_session)):
    session = await load_payload(meta.id)
    if "health" not in session:
        raise HTTPException(404, NOT_FOUND)
    return session["health"]
