from __future__ import annotations
"""
HealthKit incremental sync API.

POST /api/hk/sync          – iOS pushes normalized HK records + anchor
GET  /api/hk/anchor/{type} – iOS fetches last stored anchor to resume from
GET  /api/hk/status        – overview of all data types for the current user
"""
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from api.auth_deps import get_current_user
from db.base import get_db
from db.models import HealthRecord, Session as SessionModel, SyncAnchor, User
from db.session_store import generate_session_id, save_session
from core.pipeline import run_feature_pipeline

router = APIRouter(prefix="/hk", tags=["healthkit"])

SUPPORTED_TYPES = {
    "hrv", "ecg", "sleep", "heart_rate", "resting_hr",
    "respiratory_rate", "oxygen_saturation", "wrist_temp", "vo2_max",
}


# ── Schemas ─────────────────────────────────────────────────────────────────

class HKSyncPayload(BaseModel):
    data_type: str
    anchor: Optional[str] = None        # serialized HKQueryAnchor (base64 or opaque str)
    records: list[dict]                 # normalized records from iOS Sync Engine
    session_id: Optional[str] = None    # client may hint which session to attach to


class HKSyncResponse(BaseModel):
    session_id: str
    accepted_count: int
    anchor_stored: bool
    pipeline_queued: bool


class AnchorResponse(BaseModel):
    data_type: str
    anchor_value: Optional[str]
    last_sync_at: Optional[str]


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/sync", response_model=HKSyncResponse)
async def sync_healthkit(
    payload: HKSyncPayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if payload.data_type not in SUPPORTED_TYPES:
        raise HTTPException(400, f"Unsupported data_type: {payload.data_type}. Must be one of {SUPPORTED_TYPES}")

    # Resolve or create session
    session_id = payload.session_id
    if session_id:
        row = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not row:
            raise HTTPException(404, f"Session {session_id} not found")
    else:
        session_id = generate_session_id()
        row = SessionModel(
            id=session_id,
            user_id=current_user.id,
            source="healthkit",
            status="pending",
            created_at=datetime.utcnow(),
        )
        db.add(row)

    # Persist individual records
    accepted = 0
    for rec in payload.records:
        recorded_at_str = rec.get("timestamp") or rec.get("recorded_at") or rec.get("date")
        try:
            recorded_at = datetime.fromisoformat(recorded_at_str) if recorded_at_str else datetime.utcnow()
        except Exception:
            recorded_at = datetime.utcnow()

        db.add(HealthRecord(
            session_id=session_id,
            data_type=payload.data_type,
            recorded_at=recorded_at,
            payload_json=json.dumps(rec, ensure_ascii=False),
        ))
        accepted += 1

    # Update anchor
    anchor_stored = False
    if payload.anchor is not None:
        anchor_row = (
            db.query(SyncAnchor)
            .filter(SyncAnchor.user_id == current_user.id, SyncAnchor.data_type == payload.data_type)
            .first()
        )
        if anchor_row:
            anchor_row.anchor_value = payload.anchor
            anchor_row.last_sync_at = datetime.utcnow()
        else:
            db.add(SyncAnchor(
                user_id=current_user.id,
                data_type=payload.data_type,
                anchor_value=payload.anchor,
                last_sync_at=datetime.utcnow(),
            ))
        anchor_stored = True

    db.commit()

    # Queue feature pipeline in background
    pipeline_queued = accepted > 0
    if pipeline_queued:
        background_tasks.add_task(_run_pipeline_task, session_id, current_user.id)

    return HKSyncResponse(
        session_id=session_id,
        accepted_count=accepted,
        anchor_stored=anchor_stored,
        pipeline_queued=pipeline_queued,
    )


@router.get("/anchor/{data_type}", response_model=AnchorResponse)
async def get_anchor(
    data_type: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if data_type not in SUPPORTED_TYPES:
        raise HTTPException(400, f"Unsupported data_type: {data_type}")

    row = (
        db.query(SyncAnchor)
        .filter(SyncAnchor.user_id == current_user.id, SyncAnchor.data_type == data_type)
        .first()
    )
    return AnchorResponse(
        data_type=data_type,
        anchor_value=row.anchor_value if row else None,
        last_sync_at=row.last_sync_at.isoformat() if row and row.last_sync_at else None,
    )


@router.get("/status")
async def get_sync_status(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Return last sync time and record count for every data type."""
    anchors = (
        db.query(SyncAnchor)
        .filter(SyncAnchor.user_id == current_user.id)
        .all()
    )
    anchor_map = {a.data_type: a for a in anchors}

    result = {}
    for dt in sorted(SUPPORTED_TYPES):
        anchor = anchor_map.get(dt)
        count = (
            db.query(HealthRecord)
            .join(SessionModel, HealthRecord.session_id == SessionModel.id)
            .filter(SessionModel.user_id == current_user.id, HealthRecord.data_type == dt)
            .count()
        )
        result[dt] = {
            "last_sync_at": anchor.last_sync_at.isoformat() if anchor and anchor.last_sync_at else None,
            "has_anchor": anchor is not None,
            "record_count": count,
        }
    return result


# ── Background task ──────────────────────────────────────────────────────────

async def _run_pipeline_task(session_id: str, user_id: str) -> None:
    """Load all HK records for the session and trigger the feature pipeline."""
    from db.base import SessionLocal
    db = SessionLocal()
    try:
        records_rows = (
            db.query(HealthRecord)
            .filter(HealthRecord.session_id == session_id)
            .order_by(HealthRecord.recorded_at)
            .all()
        )
        records = [
            {"data_type": r.data_type, **json.loads(r.payload_json)}
            for r in records_rows
        ]
        if not records:
            return

        result = await run_feature_pipeline(session_id, records, user_id=user_id)

        save_session(session_id, {
            "analysis": result.model_dump() if result else {},
            "status": "completed" if result else "error",
        }, user_id=user_id, source="healthkit")
    except Exception:
        save_session(session_id, {"status": "error"}, user_id=user_id)
    finally:
        db.close()
