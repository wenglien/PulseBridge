from __future__ import annotations
"""
Session access control.

Every session route requires the session's access token in the
`X-Session-Token` header (issued once, when the session is created), or a
bearer JWT for the user who owns it. Missing session, legacy session (no
token) and wrong token all return the same 404, so ids cannot be probed.
"""
import asyncio
from typing import Any, Callable, Optional, TypeVar

from fastapi import Depends, Header, HTTPException

from api.auth_deps import get_current_user_optional
from db.store import SessionMeta, UserRecord, get_store, token_matches

SESSION_TOKEN_HEADER = "X-Session-Token"
NOT_FOUND = "找不到這份報告，或你沒有權限查看"

T = TypeVar("T")


async def run_store(fn: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """Store calls are blocking (SQL / Firestore / GCS); keep them off the event loop."""
    return await asyncio.to_thread(fn, *args, **kwargs)


async def authorize_session(
    session_id: str, token: Optional[str], user: Optional[UserRecord],
) -> SessionMeta:
    meta = await run_store(get_store().get_meta, session_id)
    if meta and meta.token_hash and (
        token_matches(token, meta.token_hash) or (user is not None and meta.user_id == user.id)
    ):
        return meta
    raise HTTPException(404, NOT_FOUND)


async def session_token(
    x_session_token: Optional[str] = Header(None, alias=SESSION_TOKEN_HEADER),
) -> Optional[str]:
    return x_session_token


async def require_session(
    session_id: str,
    token: Optional[str] = Depends(session_token),
    user: Optional[UserRecord] = Depends(get_current_user_optional),
) -> SessionMeta:
    """Dependency for routes with a `{session_id}` path parameter."""
    return await authorize_session(session_id, token, user)


async def create_session(*, user: Optional[UserRecord] = None, source: str) -> tuple[str, str]:
    meta, token = await run_store(get_store().create_session, user_id=user.id if user else None, source=source)
    return meta.id, token


async def load_payload(session_id: str) -> dict:
    return await run_store(get_store().load_payload, session_id)


async def update_session(session_id: str, data: dict) -> None:
    await run_store(get_store().update_session, session_id, data)
