from __future__ import annotations
"""Session listing and management routes."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.auth_deps import get_current_user
from core.rate_limit import LIMIT_LOOKUP
from api.dependencies import load_payload, require_session, run_store
from db.store import SessionMeta, UserRecord, get_store, token_matches

router = APIRouter(prefix="/sessions", tags=["sessions"])


class SessionKey(BaseModel):
    session_id: str = Field(..., max_length=64)
    token: str = Field(..., max_length=128)


class LookupRequest(BaseModel):
    sessions: list[SessionKey] = Field(default_factory=list, max_length=200)


@router.get("")
async def get_my_sessions(user: UserRecord = Depends(get_current_user)):
    """Sessions owned by the logged-in user."""
    metas = await run_store(get_store().list_for_user, user.id)
    return [m.summary() for m in metas]


@router.post("/lookup", dependencies=[Depends(LIMIT_LOOKUP)])
async def lookup_sessions(req: LookupRequest):
    """
    Anonymous listing: the browser sends the (session_id, token) pairs it holds.
    Returns the ones that are valid, newest first, plus ids the client should forget.
    """
    tokens = {k.session_id: k.token for k in req.sessions}
    metas = await run_store(get_store().get_metas, list(tokens))
    valid = [m for m in metas if token_matches(tokens.get(m.id), m.token_hash)]
    valid.sort(key=lambda m: m.created_at, reverse=True)
    valid_ids = {m.id for m in valid}
    return {
        "sessions": [m.summary() for m in valid],
        "forget": [sid for sid in tokens if sid not in valid_ids],
    }


@router.post("/claim", dependencies=[Depends(LIMIT_LOOKUP)])
async def claim_sessions(req: LookupRequest, user: UserRecord = Depends(get_current_user)):
    """
    Attach check-ins this browser holds tokens for to the signed-in account,
    so they appear on the user's other devices. Sessions already owned by
    someone else are left alone.
    """
    tokens = {k.session_id: k.token for k in req.sessions}
    store = get_store()
    metas = await run_store(store.get_metas, list(tokens))
    claimed = []
    for m in metas:
        if token_matches(tokens.get(m.id), m.token_hash) and m.user_id in (None, user.id):
            if m.user_id is None:
                await run_store(store.set_owner, m.id, user.id)
            claimed.append(m.id)
    return {"claimed": claimed}


@router.get("/{session_id}")
async def get_session(meta: SessionMeta = Depends(require_session)):
    return {**await load_payload(meta.id), **meta.summary()}


@router.delete("/{session_id}")
async def delete_session_route(meta: SessionMeta = Depends(require_session)):
    await run_store(get_store().delete_session, meta.id)
    return {"deleted": True, "session_id": meta.id}
