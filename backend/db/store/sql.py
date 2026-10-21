from __future__ import annotations
"""SQLAlchemy-backed store for local development and tests (SQLite by default)."""
import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from core.config import settings
from db.base import SessionLocal, init_db
from db.models import HealthRecord, Session as SessionRow, SyncAnchor, User
from db.store.base import (
    SessionMeta, UserRecord, hash_token, merge_meta_from_payload,
    new_access_token, new_session_id, utcnow,
)


def _meta(row: SessionRow) -> SessionMeta:
    return SessionMeta(
        id=row.id,
        token_hash=row.token_hash,
        user_id=row.user_id,
        status=row.status or "pending",
        primary_constitution=row.primary_constitution or "",
        source=row.source or "xml",
        progress=row.progress or 0.0,
        metrics=json.loads(row.metrics_json) if row.metrics_json else {},
        created_at=row.created_at or utcnow(),
        updated_at=row.updated_at or row.created_at or utcnow(),
    )


def _user(row: User) -> UserRecord:
    return UserRecord(id=row.id, email=row.email, hashed_password=row.hashed_password)


class SqlStore:
    def __init__(self) -> None:
        init_db()
        self.blob_dir = settings.uploads_dir / "blobs"

    # ── sessions ────────────────────────────────────────────────────────────
    def create_session(self, *, user_id: Optional[str] = None, source: str = "xml") -> tuple[SessionMeta, str]:
        token = new_access_token()
        now = utcnow()
        row = SessionRow(
            id=new_session_id(), token_hash=hash_token(token), user_id=user_id,
            source=source, status="pending", progress=0.0,
            created_at=now, updated_at=now, payload_json="{}",
        )
        with SessionLocal() as db:
            db.add(row)
            db.commit()
            return _meta(row), token

    def get_meta(self, session_id: str) -> Optional[SessionMeta]:
        with SessionLocal() as db:
            row = db.get(SessionRow, session_id)
            return _meta(row) if row else None

    def get_metas(self, session_ids: list[str]) -> list[SessionMeta]:
        if not session_ids:
            return []
        with SessionLocal() as db:
            rows = db.query(SessionRow).filter(SessionRow.id.in_(session_ids)).all()
            return [_meta(r) for r in rows]

    def list_for_user(self, user_id: str) -> list[SessionMeta]:
        with SessionLocal() as db:
            rows = (db.query(SessionRow).filter(SessionRow.user_id == user_id)
                    .order_by(SessionRow.created_at.desc()).all())
            return [_meta(r) for r in rows]

    def load_payload(self, session_id: str) -> dict:
        with SessionLocal() as db:
            row = db.get(SessionRow, session_id)
            return json.loads(row.payload_json) if row and row.payload_json else {}

    def update_session(self, session_id: str, data: dict) -> None:
        with SessionLocal() as db:
            row = db.get(SessionRow, session_id)
            if row is None:
                raise KeyError(session_id)
            payload = json.loads(row.payload_json) if row.payload_json else {}
            payload.update(data)
            meta = _meta(row)
            merge_meta_from_payload(meta, data)
            row.payload_json = json.dumps(payload, ensure_ascii=False)
            row.status, row.primary_constitution, row.updated_at = (
                meta.status, meta.primary_constitution, meta.updated_at)
            row.metrics_json = json.dumps(meta.metrics, ensure_ascii=False)
            db.commit()

    def set_progress(self, session_id: str, pct: float) -> None:
        with SessionLocal() as db:
            row = db.get(SessionRow, session_id)
            if row is not None:
                row.progress = pct
                db.commit()

    def set_owner(self, session_id: str, user_id: str) -> None:
        with SessionLocal() as db:
            row = db.get(SessionRow, session_id)
            if row is not None:
                row.user_id = user_id
                db.commit()

    def delete_session(self, session_id: str) -> bool:
        with SessionLocal() as db:
            row = db.get(SessionRow, session_id)
            if row is None:
                return False
            db.delete(row)
            db.commit()
        self.delete_upload(session_id)
        return True

    def purge_legacy_sessions(self, *, dry_run: bool = True) -> list[str]:
        with SessionLocal() as db:
            ids = [r.id for r in db.query(SessionRow.id).filter(SessionRow.token_hash.is_(None))]
        legacy_files = sorted(settings.sessions_dir.glob("pb_*.json")) if settings.sessions_dir.exists() else []
        ids += [p.stem for p in legacy_files if p.stem not in ids]
        if not dry_run:
            for sid in ids:
                self.delete_session(sid)
            for p in legacy_files:
                p.unlink(missing_ok=True)
        return ids

    # ── uploads ─────────────────────────────────────────────────────────────
    def _blob(self, session_id: str) -> Path:
        return self.blob_dir / f"{session_id}.upload"

    def put_upload(self, session_id: str, path: Path) -> None:
        self.blob_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, self._blob(session_id))

    def fetch_upload(self, session_id: str, dest: Path) -> bool:
        src = self._blob(session_id)
        if not src.exists():
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
        return True

    def delete_upload(self, session_id: str) -> None:
        self._blob(session_id).unlink(missing_ok=True)

    # ── users ───────────────────────────────────────────────────────────────
    def get_user(self, user_id: str) -> Optional[UserRecord]:
        with SessionLocal() as db:
            row = db.get(User, user_id)
            return _user(row) if row else None

    def get_user_by_email(self, email: str) -> Optional[UserRecord]:
        with SessionLocal() as db:
            row = db.query(User).filter(User.email == email).first()
            return _user(row) if row else None

    def create_user(self, email: str, hashed_password: str) -> UserRecord:
        with SessionLocal() as db:
            row = User(id=str(uuid.uuid4()), email=email, hashed_password=hashed_password)
            db.add(row)
            db.commit()
            return _user(row)

    # ── HealthKit ───────────────────────────────────────────────────────────
    def add_health_records(self, session_id: str, data_type: str, records: list[tuple[datetime, dict]]) -> int:
        with SessionLocal() as db:
            for recorded_at, payload in records:
                db.add(HealthRecord(session_id=session_id, data_type=data_type, recorded_at=recorded_at,
                                    payload_json=json.dumps(payload, ensure_ascii=False)))
            db.commit()
        return len(records)

    def list_health_records(self, session_id: str) -> list[dict]:
        with SessionLocal() as db:
            rows = (db.query(HealthRecord).filter(HealthRecord.session_id == session_id)
                    .order_by(HealthRecord.recorded_at).all())
            return [{"data_type": r.data_type, **json.loads(r.payload_json)} for r in rows]

    def count_health_records(self, user_id: str, data_type: str) -> int:
        with SessionLocal() as db:
            return (db.query(HealthRecord)
                    .join(SessionRow, HealthRecord.session_id == SessionRow.id)
                    .filter(SessionRow.user_id == user_id, HealthRecord.data_type == data_type)
                    .count())

    def get_anchor(self, user_id: str, data_type: str):
        with SessionLocal() as db:
            row = (db.query(SyncAnchor)
                   .filter(SyncAnchor.user_id == user_id, SyncAnchor.data_type == data_type).first())
            return (row.anchor_value, row.last_sync_at) if row else None

    def set_anchor(self, user_id: str, data_type: str, anchor: str) -> None:
        with SessionLocal() as db:
            row = (db.query(SyncAnchor)
                   .filter(SyncAnchor.user_id == user_id, SyncAnchor.data_type == data_type).first())
            if row is None:
                row = SyncAnchor(user_id=user_id, data_type=data_type)
                db.add(row)
            row.anchor_value, row.last_sync_at = anchor, utcnow()
            db.commit()
