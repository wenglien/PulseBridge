from __future__ import annotations
"""
HealthKit incremental sync API.

POST /api/hk/sync          – iOS pushes normalized HK records + anchor
GET  /api/hk/anchor/{type} – iOS fetches last stored anchor to resume from
GET  /api/hk/status        – overview of all data types for the current user
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth_deps import get_current_user
from api.dependencies import NOT_FOUND, run_store
from core.pipeline import run_feature_pipeline
from db.store import UserRecord, get_store
from db.store.base import utcnow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hk", tags=["healthkit"])

SUPPORTED_TYPES = {
    "hrv", "ecg", "sleep", "heart_rate", "resting_hr",
    "respiratory_rate", "oxygen_saturation", "wrist_temp", "vo2_max",
}


# ── Schemas ─────────────────────────────────────────────────────────────────

class HKSyncPayload(BaseModel):
    data_type: str
    anchor: Optional[str] = None        # serialized HKQueryAnchor (base64 or opaque str)
    records: list[dict] = Field(..., max_length=5000)  # normalized records from iOS Sync Engine
    session_id: Optional[str] = None    # client may hint which session to attach to


class HKSyncResponse(BaseModel):
    session_id: str
    session_token: Optional[str] = None  # only when a new session was created
    accepted_count: int
    anchor_stored: bool
    pipeline_queued: bool


class AnchorResponse(BaseModel):
    data_type: str
    anchor_value: Optional[str]
    last_sync_at: Optional[str]


# ── Endpoints ────────────────────────────────────────────────────────────────

def _recorded_at(rec: dict) -> datetime:
    raw = rec.get("timestamp") or rec.get("recorded_at") or rec.get("date")
    try:
        return datetime.fromisoformat(raw) if raw else utcnow()
    except (TypeError, ValueError):
        return utcnow()


@router.post("/sync", response_model=HKSyncResponse)
async def sync_healthkit(
    payload: HKSyncPayload,
    background_tasks: BackgroundTasks,
    current_user: UserRecord = Depends(get_current_user),
):
    if payload.data_type not in SUPPORTED_TYPES:
        raise HTTPException(400, f"Unsupported data_type: {payload.data_type}. Must be one of {SUPPORTED_TYPES}")

    store = get_store()
    new_token = None
    if payload.session_id:
        meta = await run_store(store.get_meta, payload.session_id)
        # Only the owner may attach records to an existing session.
        if not meta or meta.user_id != current_user.id:
            raise HTTPException(404, NOT_FOUND)
        session_id = meta.id
    else:
        meta, new_token = await run_store(store.create_session, user_id=current_user.id, source="healthkit")
        session_id = meta.id

    records = [(_recorded_at(r), r) for r in payload.records]
    accepted = await run_store(store.add_health_records, session_id, payload.data_type, records)

    anchor_stored = payload.anchor is not None
    if anchor_stored:
        await run_store(store.set_anchor, current_user.id, payload.data_type, payload.anchor)

    pipeline_queued = accepted > 0
    if pipeline_queued:
        background_tasks.add_task(_run_pipeline_task, session_id)

    return HKSyncResponse(
        session_id=session_id,
        session_token=new_token,
        accepted_count=accepted,
        anchor_stored=anchor_stored,
        pipeline_queued=pipeline_queued,
    )


@router.get("/anchor/{data_type}", response_model=AnchorResponse)
async def get_anchor(data_type: str, current_user: UserRecord = Depends(get_current_user)):
    if data_type not in SUPPORTED_TYPES:
        raise HTTPException(400, f"Unsupported data_type: {data_type}")
    found = await run_store(get_store().get_anchor, current_user.id, data_type)
    value, last = found if found else (None, None)
    return AnchorResponse(
        data_type=data_type,
        anchor_value=value,
        last_sync_at=last.isoformat() if last else None,
    )


@router.get("/status")
async def get_sync_status(current_user: UserRecord = Depends(get_current_user)):
    """Return last sync time and record count for every data type."""
    store = get_store()
    result = {}
    for dt in sorted(SUPPORTED_TYPES):
        anchor = await run_store(store.get_anchor, current_user.id, dt)
        result[dt] = {
            "last_sync_at": anchor[1].isoformat() if anchor and anchor[1] else None,
            "has_anchor": anchor is not None,
            "record_count": await run_store(store.count_health_records, current_user.id, dt),
        }
    return result


# ── Background task ──────────────────────────────────────────────────────────

async def _run_pipeline_task(session_id: str) -> None:
    """Load all HK records for the session and trigger the feature pipeline."""
    store = get_store()
    try:
        records = await run_store(store.list_health_records, session_id)
        if not records:
            return
        result = await run_feature_pipeline(session_id, records)
        await run_store(store.update_session, session_id, {
            "analysis": result.model_dump() if result else {},
            "status": "completed" if result else "error",
        })
    except Exception:
        logger.exception("HealthKit pipeline failed for %s", session_id)
        await run_store(store.update_session, session_id, {"status": "error"})
