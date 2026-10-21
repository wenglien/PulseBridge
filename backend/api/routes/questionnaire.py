from __future__ import annotations
"""Questionnaire submission and retrieval routes."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from api.auth_deps import get_current_user_optional
from core.rate_limit import LIMIT_CREATE
from api.dependencies import (
    NOT_FOUND, authorize_session, create_session, load_payload, require_session,
    session_token, update_session,
)
from db.store import SessionMeta, UserRecord
from models.questionnaire import QuestionnaireResponse

router = APIRouter(prefix="/questionnaire", tags=["questionnaire"])


@router.post("/submit", dependencies=[Depends(LIMIT_CREATE)])
async def submit_questionnaire(
    data: QuestionnaireResponse,
    token: Optional[str] = Depends(session_token),
    user: Optional[UserRecord] = Depends(get_current_user_optional),
):
    """
    With a session_id: add the questionnaire to that (owned) session.
    Without one: start a questionnaire-only session and return its access token.
    """
    new_token = None
    if data.session_id:
        await authorize_session(data.session_id, token, user)
        session_id = data.session_id
    else:
        session_id, new_token = await create_session(user=user, source="manual")

    data.session_id = session_id
    await update_session(session_id, {
        "questionnaire": data.model_dump(),
        "status": "questionnaire_submitted",
    })
    body = {"session_id": session_id, "saved": True}
    if new_token:
        body["session_token"] = new_token
    return body


@router.get("/{session_id}")
async def get_questionnaire(meta: SessionMeta = Depends(require_session)):
    payload = await load_payload(meta.id)
    if "questionnaire" not in payload:
        raise HTTPException(404, NOT_FOUND)
    return payload["questionnaire"]
