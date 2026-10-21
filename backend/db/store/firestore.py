from __future__ import annotations
"""
Cloud store: Firestore for metadata/users/HealthKit records, Cloud Storage for
session payloads and uploaded Apple Health exports.

Why payloads live in Cloud Storage: a payload can carry raw ECG waveforms
(up to 50 recordings × ~15k samples), far past Firestore's 1 MiB document limit.

Layout (all names prefixed by FIRESTORE_PREFIX, handy for test isolation):
  {p}sessions/{session_id}          token_hash, user_id, status, primary_constitution,
                                    source, progress, metrics, created_at, updated_at
  {p}users/{user_id}                email, hashed_password
  {p}user_emails/{email}            user_id          (enforces unique e-mail)
  {p}health_records/{auto}          session_id, user_id, data_type, recorded_at, payload
  {p}sync_anchors/{user}_{type}     user_id, data_type, anchor_value, last_sync_at
  gs://{bucket}/{p}sessions/{id}.json.gz   payload (gzip JSON)
  gs://{bucket}/{p}uploads/{id}            uploaded export (.xml or .xml.gz, as received)
"""
import gzip
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from core.config import settings
from db.store.base import (
    SessionMeta, UserRecord, hash_token, merge_meta_from_payload,
    new_access_token, new_session_id, utcnow,
)

_MAX_WRITE_ATTEMPTS = 8
_BATCH = 400  # Firestore allows 500 writes per batch


def _naive(dt) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


class EmailTakenError(Exception):
    pass


class FirestoreStore:
    def __init__(self) -> None:
        from google.cloud import firestore, storage  # imported lazily: optional in local dev

        self._fs_mod = firestore
        self.db = firestore.Client(project=settings.gcp_project or None, database=settings.firestore_database)
        self.bucket = storage.Client(project=settings.gcp_project or None).bucket(settings.gcs_bucket)
        p = settings.firestore_prefix
        self.sessions = self.db.collection(f"{p}sessions")
        self.users = self.db.collection(f"{p}users")
        self.user_emails = self.db.collection(f"{p}user_emails")
        self.records = self.db.collection(f"{p}health_records")
        self.anchors = self.db.collection(f"{p}sync_anchors")
        self.prefix = p

    # ── helpers ─────────────────────────────────────────────────────────────
    def _payload_blob(self, session_id: str):
        return self.bucket.blob(f"{self.prefix}sessions/{session_id}.json.gz")

    def _upload_blob(self, session_id: str):
        return self.bucket.blob(f"{self.prefix}uploads/{session_id}")

    @staticmethod
    def _meta(doc) -> SessionMeta:
        d = doc.to_dict() or {}
        return SessionMeta(
            id=doc.id,
            token_hash=d.get("token_hash"),
            user_id=d.get("user_id"),
            status=d.get("status") or "pending",
            primary_constitution=d.get("primary_constitution") or "",
            source=d.get("source") or "xml",
            progress=float(d.get("progress") or 0.0),
            metrics=d.get("metrics") or {},
            created_at=_naive(d.get("created_at")) or utcnow(),
            updated_at=_naive(d.get("updated_at")) or _naive(d.get("created_at")) or utcnow(),
        )

    # ── sessions ────────────────────────────────────────────────────────────
    def create_session(self, *, user_id: Optional[str] = None, source: str = "xml") -> tuple[SessionMeta, str]:
        token = new_access_token()
        meta = SessionMeta(id=new_session_id(), token_hash=hash_token(token), user_id=user_id, source=source)
        self.sessions.document(meta.id).create({
            "token_hash": meta.token_hash, "user_id": user_id, "status": meta.status,
            "primary_constitution": "", "source": source, "progress": 0.0,
            "created_at": meta.created_at, "updated_at": meta.updated_at,
        })
        return meta, token

    def get_meta(self, session_id: str) -> Optional[SessionMeta]:
        doc = self.sessions.document(session_id).get()
        return self._meta(doc) if doc.exists else None

    def get_metas(self, session_ids: list[str]) -> list[SessionMeta]:
        refs = [self.sessions.document(s) for s in dict.fromkeys(session_ids)]
        return [self._meta(d) for d in self.db.get_all(refs) if d.exists] if refs else []

    def list_for_user(self, user_id: str) -> list[SessionMeta]:
        docs = self.sessions.where(filter=self._fs_mod.FieldFilter("user_id", "==", user_id)).stream()
        return sorted((self._meta(d) for d in docs), key=lambda m: m.created_at, reverse=True)

    def load_payload(self, session_id: str) -> dict:
        blob = self.bucket.get_blob(self._payload_blob(session_id).name)
        if blob is None:
            return {}
        return json.loads(gzip.decompress(blob.download_as_bytes()))

    def update_session(self, session_id: str, data: dict) -> None:
        from google.api_core.exceptions import PreconditionFailed

        ref = self.sessions.document(session_id)
        snap = ref.get()
        if not snap.exists:
            raise KeyError(session_id)

        # Optimistic concurrency on the payload blob: retry if someone wrote in between.
        name = self._payload_blob(session_id).name
        for _ in range(_MAX_WRITE_ATTEMPTS):
            blob = self.bucket.get_blob(name)
            generation = blob.generation if blob else 0
            payload = json.loads(gzip.decompress(blob.download_as_bytes(if_generation_match=generation))) if blob else {}
            payload.update(data)
            body = gzip.compress(json.dumps(payload, ensure_ascii=False).encode())
            try:
                self.bucket.blob(name).upload_from_string(
                    body, content_type="application/json", if_generation_match=generation)
                break
            except PreconditionFailed:
                continue
        else:
            raise RuntimeError(f"could not update session {session_id}: too many concurrent writes")

        meta = self._meta(snap)
        merge_meta_from_payload(meta, data)
        ref.update({"status": meta.status, "primary_constitution": meta.primary_constitution,
                    "metrics": meta.metrics, "updated_at": meta.updated_at})

    def set_progress(self, session_id: str, pct: float) -> None:
        self.sessions.document(session_id).update({"progress": float(pct)})

    def set_owner(self, session_id: str, user_id: str) -> None:
        self.sessions.document(session_id).update({"user_id": user_id})
        # HealthKit records carry the owner for per-user counts.
        recs = self.records.where(filter=self._fs_mod.FieldFilter("session_id", "==", session_id)).stream()
        refs = [r.reference for r in recs]
        for i in range(0, len(refs), _BATCH):
            batch = self.db.batch()
            for ref in refs[i:i + _BATCH]:
                batch.update(ref, {"user_id": user_id})
            batch.commit()

    def delete_session(self, session_id: str) -> bool:
        ref = self.sessions.document(session_id)
        if not ref.get().exists:
            return False
        recs = self.records.where(filter=self._fs_mod.FieldFilter("session_id", "==", session_id)).stream()
        self._delete_refs([r.reference for r in recs])
        ref.delete()
        for blob in (self._payload_blob(session_id), self._upload_blob(session_id)):
            self._delete_blob(blob)
        return True

    def purge_legacy_sessions(self, *, dry_run: bool = True) -> list[str]:
        ids = [d.id for d in self.sessions.stream() if not (d.to_dict() or {}).get("token_hash")]
        if not dry_run:
            for sid in ids:
                self.delete_session(sid)
        return ids

    # ── uploads ─────────────────────────────────────────────────────────────
    def put_upload(self, session_id: str, path: Path) -> None:
        self._upload_blob(session_id).upload_from_filename(str(path))

    def fetch_upload(self, session_id: str, dest: Path) -> bool:
        blob = self.bucket.get_blob(self._upload_blob(session_id).name)
        if blob is None:
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        blob.download_to_filename(str(dest))
        return True

    def delete_upload(self, session_id: str) -> None:
        self._delete_blob(self._upload_blob(session_id))

    @staticmethod
    def _delete_blob(blob) -> None:
        from google.api_core.exceptions import NotFound
        try:
            blob.delete()
        except NotFound:
            pass

    def _delete_refs(self, refs: list) -> None:
        for i in range(0, len(refs), _BATCH):
            batch = self.db.batch()
            for r in refs[i:i + _BATCH]:
                batch.delete(r)
            batch.commit()

    # ── users ───────────────────────────────────────────────────────────────
    def get_user(self, user_id: str) -> Optional[UserRecord]:
        doc = self.users.document(user_id).get()
        if not doc.exists:
            return None
        d = doc.to_dict()
        return UserRecord(id=doc.id, email=d["email"], hashed_password=d["hashed_password"])

    def get_user_by_email(self, email: str) -> Optional[UserRecord]:
        doc = self.user_emails.document(email.lower()).get()
        return self.get_user(doc.to_dict()["user_id"]) if doc.exists else None

    def create_user(self, email: str, hashed_password: str) -> UserRecord:
        from google.api_core.exceptions import AlreadyExists, Conflict

        user = UserRecord(id=str(uuid.uuid4()), email=email, hashed_password=hashed_password)
        batch = self.db.batch()
        batch.create(self.user_emails.document(email.lower()), {"user_id": user.id})  # fails if taken
        batch.create(self.users.document(user.id), {
            "email": email, "hashed_password": hashed_password, "created_at": utcnow()})
        try:
            batch.commit()
        except (AlreadyExists, Conflict) as e:
            raise EmailTakenError(email) from e
        return user

    # ── HealthKit ───────────────────────────────────────────────────────────
    def add_health_records(self, session_id: str, data_type: str, records: list[tuple[datetime, dict]]) -> int:
        owner = (self.sessions.document(session_id).get().to_dict() or {}).get("user_id")
        for i in range(0, len(records), _BATCH):
            batch = self.db.batch()
            for recorded_at, payload in records[i:i + _BATCH]:
                batch.set(self.records.document(), {
                    "session_id": session_id, "user_id": owner, "data_type": data_type,
                    "recorded_at": recorded_at, "payload": payload,
                })
            batch.commit()
        return len(records)

    def list_health_records(self, session_id: str) -> list[dict]:
        docs = self.records.where(filter=self._fs_mod.FieldFilter("session_id", "==", session_id)).stream()
        rows = sorted((d.to_dict() for d in docs), key=lambda r: _naive(r.get("recorded_at")) or datetime.min)
        return [{"data_type": r["data_type"], **(r.get("payload") or {})} for r in rows]

    def count_health_records(self, user_id: str, data_type: str) -> int:
        FF = self._fs_mod.FieldFilter
        q = self.records.where(filter=FF("user_id", "==", user_id)).where(filter=FF("data_type", "==", data_type))
        return int(q.count().get()[0][0].value)

    def get_anchor(self, user_id: str, data_type: str):
        doc = self.anchors.document(f"{user_id}_{data_type}").get()
        if not doc.exists:
            return None
        d = doc.to_dict()
        return d.get("anchor_value"), _naive(d.get("last_sync_at"))

    def set_anchor(self, user_id: str, data_type: str, anchor: str) -> None:
        self.anchors.document(f"{user_id}_{data_type}").set({
            "user_id": user_id, "data_type": data_type, "anchor_value": anchor, "last_sync_at": utcnow()})
