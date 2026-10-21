from __future__ import annotations
"""
Storage interface shared by the SQL (local/dev) and Firestore+GCS (cloud) backends.

A *session* is one check-in: health data, questionnaire and analysis live in
its payload dict; ownership and listing fields live in SessionMeta.

Ownership: every session gets a random access token when it is created. Only
the SHA-256 of the token is stored. Anyone presenting the token (or the owning
logged-in user) may read or change the session — nobody else.
"""
import hashlib
import hmac
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Protocol


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_session_id() -> str:
    # 64 random bits: not guessable, still short enough for URLs.
    return f"pb_{utcnow():%Y%m%d}_{secrets.token_hex(8)}"


def new_access_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def token_matches(token: Optional[str], token_hash: Optional[str]) -> bool:
    if not token or not token_hash:
        return False
    return hmac.compare_digest(hash_token(token), token_hash)


@dataclass
class SessionMeta:
    id: str
    token_hash: Optional[str] = None
    user_id: Optional[str] = None
    status: str = "pending"
    primary_constitution: str = ""
    source: str = "xml"
    progress: float = 0.0
    # A few headline numbers kept next to the index so history/trends need no payload reads.
    metrics: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=utcnow)
    updated_at: datetime = field(default_factory=utcnow)

    def summary(self) -> dict:
        return {
            "session_id": self.id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "status": self.status or "pending",
            "primary_constitution": self.primary_constitution or "",
            "source": self.source or "xml",
            "metrics": self.metrics or {},
        }


@dataclass
class UserRecord:
    id: str
    email: str
    hashed_password: str


def _num(v) -> Optional[float]:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return round(f, 1) if f > 0 else None


def extract_metrics(data: dict) -> dict:
    """Headline numbers from a payload update; keys absent from `data` are left untouched."""
    out: dict = {}
    health = data.get("health")
    if isinstance(health, dict):
        hrv = health.get("hrv") or {}
        sleep = [s for s in health.get("sleep") or [] if (s or {}).get("total_sleep_minutes")]
        out.update({
            "sdnn": _num(hrv.get("sdnn")),
            "rmssd": _num(hrv.get("rmssd")),
            "resting_hr": _num(health.get("resting_heart_rate")),
            "sleep_minutes": _num(sum(s["total_sleep_minutes"] for s in sleep) / len(sleep)) if sleep else None,
            "ecg_count": len(health.get("ecg_readings") or []),
        })
    q = data.get("questionnaire")
    if isinstance(q, dict):
        load = 0
        for cat in ("energy", "digestion", "mood", "pain", "sleep"):
            load += sum(v for v in (q.get(cat) or {}).values() if isinstance(v, (int, float)))
        out["symptom_load"] = load
    analysis = data.get("analysis")
    if isinstance(analysis, dict) and analysis:
        out["risk"] = (analysis.get("executive_summary") or {}).get("overall_risk_level")
    return {k: v for k, v in out.items() if v is not None}


def merge_meta_from_payload(meta: SessionMeta, data: dict) -> None:
    """Keep the listing fields in sync with what was just written to the payload."""
    if "status" in data and data["status"]:
        meta.status = data["status"]
    analysis = data.get("analysis") or {}
    if isinstance(analysis, dict) and analysis.get("primary_constitution"):
        meta.primary_constitution = analysis["primary_constitution"]
    meta.metrics = {**(meta.metrics or {}), **extract_metrics(data)}
    meta.updated_at = utcnow()


class Store(Protocol):
    # ── sessions ──
    def create_session(self, *, user_id: Optional[str] = None, source: str = "xml") -> tuple[SessionMeta, str]:
        """Create an empty session; returns (meta, plaintext access token)."""
    def get_meta(self, session_id: str) -> Optional[SessionMeta]: ...
    def get_metas(self, session_ids: list[str]) -> list[SessionMeta]: ...
    def list_for_user(self, user_id: str) -> list[SessionMeta]: ...
    def load_payload(self, session_id: str) -> dict: ...
    def update_session(self, session_id: str, data: dict) -> None:
        """Shallow-merge `data` into the payload and refresh listing fields."""
    def set_progress(self, session_id: str, pct: float) -> None: ...
    def set_owner(self, session_id: str, user_id: str) -> None: ...
    def delete_session(self, session_id: str) -> bool: ...
    def purge_legacy_sessions(self, *, dry_run: bool = True) -> list[str]:
        """Delete sessions created before access tokens existed (no token_hash)."""

    # ── uploaded Apple Health exports ──
    def put_upload(self, session_id: str, path: Path) -> None:
        """Persist a copy of the uploaded file (the caller still owns `path`)."""
    def fetch_upload(self, session_id: str, dest: Path) -> bool: ...
    def delete_upload(self, session_id: str) -> None: ...

    # ── users ──
    def get_user(self, user_id: str) -> Optional[UserRecord]: ...
    def get_user_by_email(self, email: str) -> Optional[UserRecord]: ...
    def create_user(self, email: str, hashed_password: str) -> UserRecord: ...

    # ── HealthKit incremental sync ──
    def add_health_records(self, session_id: str, data_type: str, records: list[tuple[datetime, dict]]) -> int: ...
    def list_health_records(self, session_id: str) -> list[dict]: ...
    def count_health_records(self, user_id: str, data_type: str) -> int: ...
    def get_anchor(self, user_id: str, data_type: str) -> Optional[tuple[Optional[str], Optional[datetime]]]: ...
    def set_anchor(self, user_id: str, data_type: str, anchor: str) -> None: ...
