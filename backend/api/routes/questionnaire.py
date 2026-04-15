from __future__ import annotations
"""Questionnaire submission and retrieval routes."""
from fastapi import APIRouter, HTTPException

from api.dependencies import save_session, load_session
from models.questionnaire import QuestionnaireResponse

router = APIRouter(prefix="/questionnaire", tags=["questionnaire"])


@router.post("/submit")
async def submit_questionnaire(data: QuestionnaireResponse):
    session = load_session(data.session_id)
    if not session:
        # Allow creating a questionnaire-only session
        save_session(data.session_id, {
            "questionnaire": data.model_dump(),
            "status": "questionnaire_submitted",
        })
    else:
        save_session(data.session_id, {
            "questionnaire": data.model_dump(),
            "status": "questionnaire_submitted",
        })
    return {"session_id": data.session_id, "saved": True}


@router.get("/{session_id}")
async def get_questionnaire(session_id: str):
    session = load_session(session_id)
    if not session or "questionnaire" not in session:
        raise HTTPException(404, "Questionnaire not found for this session")
    return session["questionnaire"]
