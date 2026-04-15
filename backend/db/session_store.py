from __future__ import annotations
"""
Compatibility layer: read/write session payloads from/to the DB,
while keeping the same dict-based interface the rest of the codebase uses.

Legacy JSON-file sessions are migrated lazily on first access.
"""
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session as DBSession

from core.config import settings
from db.base import SessionLocal
from db.models import Session as SessionModel


# ── helpers ────────────────────────────────────────────────────────────────

def generate_session_id() -> str:
    date_str = datetime.utcnow().strftime("%Y%m%d")
    hex_str = uuid.uuid4().hex[:6]
    return f"pb_{date_str}_{hex_str}"


# ── core CRUD ──────────────────────────────────────────────────────────────

def load_session(session_id: str) -> dict:
    """Return the session payload dict, or {} if not found."""
    db: DBSession = SessionLocal()
    try:
        row = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if row and row.payload_json:
            return json.loads(row.payload_json)
        # Fallback: check legacy JSON file
        return _load_from_file(session_id)
    finally:
        db.close()


def save_session(session_id: str, data: dict, *, user_id: Optional[str] = None, source: str = "xml") -> None:
    """Upsert session payload into DB (merges with existing)."""
    db: DBSession = SessionLocal()
    try:
        row = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if row:
            existing: dict = json.loads(row.payload_json) if row.payload_json else {}
        else:
            existing = _load_from_file(session_id)  # migrate from file if present
            row = SessionModel(
                id=session_id,
                user_id=user_id,
                source=source,
                created_at=datetime.utcnow(),
            )
            db.add(row)

        existing.update(data)
        existing["session_id"] = session_id
        existing.setdefault("created_at", datetime.utcnow().isoformat())
        existing["updated_at"] = datetime.utcnow().isoformat()

        row.payload_json = json.dumps(existing, ensure_ascii=False)
        row.status = data.get("status", row.status or "pending")
        row.primary_constitution = (
            data.get("analysis", {}).get("primary_constitution") or row.primary_constitution
        )
        row.updated_at = datetime.utcnow()
        if user_id:
            row.user_id = user_id

        db.commit()
    finally:
        db.close()


def list_sessions(user_id: Optional[str] = None) -> list[dict]:
    """Return summary list of all sessions, optionally filtered by user."""
    db: DBSession = SessionLocal()
    try:
        q = db.query(SessionModel).order_by(SessionModel.created_at.desc())
        if user_id:
            q = q.filter(SessionModel.user_id == user_id)
        rows = q.all()
        result = []
        for row in rows:
            result.append({
                "session_id": row.id,
                "created_at": row.created_at.isoformat() if row.created_at else "",
                "updated_at": row.updated_at.isoformat() if row.updated_at else "",
                "status": row.status or "unknown",
                "primary_constitution": row.primary_constitution or "",
                "source": row.source or "xml",
            })
        # Also surface any legacy-only JSON files not yet in DB
        for leg in _list_legacy_not_in_db({r.id for r in rows}):
            result.append(leg)
        return result
    finally:
        db.close()


def delete_session(session_id: str) -> bool:
    db: DBSession = SessionLocal()
    try:
        row = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if row:
            db.delete(row)
            db.commit()
            _delete_legacy_file(session_id)
            return True
        if _delete_legacy_file(session_id):
            return True
        return False
    finally:
        db.close()


# ── legacy JSON file helpers ───────────────────────────────────────────────

def _legacy_path(session_id: str) -> Path:
    return settings.sessions_dir / f"{session_id}.json"


def _load_from_file(session_id: str) -> dict:
    path = _legacy_path(session_id)
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _delete_legacy_file(session_id: str) -> bool:
    path = _legacy_path(session_id)
    if path.exists():
        path.unlink()
        return True
    return False


def _list_legacy_not_in_db(db_ids: set[str]) -> list[dict]:
    sessions_dir = settings.sessions_dir
    if not sessions_dir.exists():
        return []
    result = []
    for path in sorted(sessions_dir.glob("pb_*.json"), reverse=True):
        sid = path.stem
        if sid in db_ids:
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            result.append({
                "session_id": sid,
                "created_at": data.get("created_at", ""),
                "updated_at": data.get("updated_at", ""),
                "status": data.get("status", "unknown"),
                "primary_constitution": (
                    data.get("analysis", {}).get("primary_constitution", "")
                    if data.get("analysis") else ""
                ),
                "source": "xml",
            })
        except Exception:
            continue
    return result
