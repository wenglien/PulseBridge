from __future__ import annotations
"""Session listing and management routes."""
from fastapi import APIRouter, HTTPException

from api.dependencies import load_session, list_sessions, delete_session

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("")
async def get_sessions():
    return list_sessions()


@router.get("/{session_id}")
async def get_session(session_id: str):
    session = load_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.delete("/{session_id}")
async def delete_session_route(session_id: str):
    found = delete_session(session_id)
    if not found:
        raise HTTPException(404, "Session not found")
    return {"deleted": True, "session_id": session_id}
