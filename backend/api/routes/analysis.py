from __future__ import annotations
"""Analysis trigger and retrieval routes."""
import json
from typing import List
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import httpx

from api.dependencies import save_session, load_session
from core.tcm_scorer import score_constitutions
from core.ecg_analyzer import (
    analyze_ecg,
    analyze_hrv_risks,
    build_integrated_cardiac_assessment,
    compute_western_flags,
    summarize_ecg,
    summarize_hrv,
)
from core.claude_engine import stream_analysis, build_analysis_result_from_claude
from core.config import settings
from models.health_data import HealthData, HRVMetrics, ECGReading
from models.questionnaire import QuestionnaireResponse
from models.analysis import AnalysisResult

router = APIRouter(prefix="/analysis", tags=["analysis"])


class AnalysisRequest(BaseModel):
    session_id: str


@router.post("/run")
async def run_analysis(req: AnalysisRequest):
    """Trigger full analysis (non-streaming). Returns complete AnalysisResult."""
    session = load_session(req.session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    save_session(req.session_id, {"status": "analyzing"})
    health_data, questionnaire = _load_session_data(session, req.session_id)

    # Rule-based pre-processing
    ecg_alerts = analyze_ecg(health_data.ecg_readings)
    if health_data.hrv and health_data.hrv.sdnn > 0:
        ecg_alerts.extend(analyze_hrv_risks(health_data.hrv))
    ecg_analysis = summarize_ecg(health_data.ecg_readings, ecg_alerts)
    hrv_analysis = summarize_hrv(health_data.hrv, ecg_alerts)
    western_flags = compute_western_flags(health_data.ecg_readings, health_data.hrv, ecg_alerts)
    integrated_assessment = build_integrated_cardiac_assessment(ecg_analysis, hrv_analysis, ecg_alerts)
    tcm_scores = score_constitutions(health_data, questionnaire)

    # Stream and collect full Claude response
    full_response = ""
    async for chunk in stream_analysis(
        health_data,
        questionnaire,
        tcm_scores,
        ecg_alerts,
        ecg_analysis,
        hrv_analysis,
        integrated_assessment,
    ):
        full_response += chunk

    result = build_analysis_result_from_claude(
        req.session_id,
        full_response,
        tcm_scores,
        ecg_alerts,
        western_flags,
        ecg_analysis,
        hrv_analysis,
        integrated_assessment,
    )

    save_session(req.session_id, {
        "analysis": result.model_dump(),
        "status": "completed",
    })

    return result.model_dump()


@router.get("/stream/{session_id}")
async def stream_analysis_sse(session_id: str):
    """SSE endpoint — streams Claude response chunks, then sends final result."""
    session = load_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    save_session(session_id, {"status": "analyzing"})
    health_data, questionnaire = _load_session_data(session, session_id)

    ecg_alerts = analyze_ecg(health_data.ecg_readings)
    if health_data.hrv and health_data.hrv.sdnn > 0:
        ecg_alerts.extend(analyze_hrv_risks(health_data.hrv))
    ecg_analysis = summarize_ecg(health_data.ecg_readings, ecg_alerts)
    hrv_analysis = summarize_hrv(health_data.hrv, ecg_alerts)
    western_flags = compute_western_flags(health_data.ecg_readings, health_data.hrv, ecg_alerts)
    integrated_assessment = build_integrated_cardiac_assessment(ecg_analysis, hrv_analysis, ecg_alerts)
    tcm_scores = score_constitutions(health_data, questionnaire)

    async def event_generator():
        full_response = ""
        try:
            async for chunk in stream_analysis(
                health_data,
                questionnaire,
                tcm_scores,
                ecg_alerts,
                ecg_analysis,
                hrv_analysis,
                integrated_assessment,
            ):
                full_response += chunk
                payload = json.dumps({"chunk": chunk}, ensure_ascii=False)
                yield f"data: {payload}\n\n"

            # Build and save final result
            result = build_analysis_result_from_claude(
                session_id,
                full_response,
                tcm_scores,
                ecg_alerts,
                western_flags,
                ecg_analysis,
                hrv_analysis,
                integrated_assessment,
            )
            save_session(session_id, {
                "analysis": result.model_dump(),
                "status": "completed",
            })

            done_payload = json.dumps({"done": True, "result": result.model_dump()}, ensure_ascii=False)
            yield f"data: {done_payload}\n\n"

        except Exception as e:
            error_payload = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {error_payload}\n\n"
            save_session(session_id, {"status": "error", "error_message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{session_id}")
async def get_analysis(session_id: str):
    session = load_session(session_id)
    if not session or "analysis" not in session:
        raise HTTPException(404, "Analysis not found for this session")
    return session["analysis"]


# ── AI Follow-up Chat ────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]


def _build_chat_system_prompt(session: dict) -> str:
    analysis = session.get("analysis", {})
    health = session.get("health", {})

    # Executive summary
    exec_sum = analysis.get("executive_summary", {})
    headline = exec_sum.get("headline_zh", "")
    risk = exec_sum.get("overall_risk_level", "")
    findings = exec_sum.get("key_findings", [])

    # HRV
    hrv = (health.get("hrv") or {})
    hrv_str = ""
    if hrv and hrv.get("sdnn", 0) > 0:
        hrv_str = (
            f"SDNN {hrv.get('sdnn', 0):.1f}ms | "
            f"RMSSD {hrv.get('rmssd', 0):.1f}ms | "
            f"LF/HF {hrv.get('lf_hf_ratio', 0):.2f} | "
            f"pNN50 {hrv.get('pnn50', 0):.1f}%"
        )

    # ECG
    ecg_readings = health.get("ecg_readings") or []
    ecg_str = ""
    if ecg_readings:
        counts: dict[str, int] = {}
        for r in ecg_readings:
            c = r.get("classification", "Unknown")
            counts[c] = counts.get(c, 0) + 1
        ecg_str = "、".join(f"{k} {v}筆" for k, v in counts.items())

    # Sleep
    sleep_list = health.get("sleep") or []
    sleep_str = ""
    if sleep_list:
        avg_eff = sum(s.get("sleep_efficiency", 0) for s in sleep_list) / len(sleep_list)
        avg_total = sum(s.get("total_sleep_minutes", 0) for s in sleep_list) / len(sleep_list)
        sleep_str = f"平均睡眠 {avg_total/60:.1f}小時，效率 {avg_eff*100:.0f}%"

    # Summary
    summary_zh = analysis.get("claude_summary_zh", "")

    # Risk alerts
    alerts = analysis.get("risk_alerts", [])
    alerts_str = "、".join(a.get("title_zh", "") for a in alerts[:5]) if alerts else "無"

    # Recommendations
    recs = analysis.get("recommendations", [])
    recs_str = "\n".join(
        f"- {r.get('title_zh', '')}: {r.get('content_zh', '')}"
        for r in recs[:5]
    )

    return f"""你是 PulseBridge 健康分析助理，正在協助使用者理解他們的個人化健康分析報告。

## 本次分析結果摘要

**整體風險等級**: {risk}
**一句話總結**: {headline}
**關鍵發現**: {', '.join(findings)}
**整體摘要**: {summary_zh}

## 生理數據
- HRV 指標: {hrv_str or '無數據'}
- ECG 記錄: {ecg_str or '無數據'}
- 睡眠: {sleep_str or '無數據'}
- 靜息心率: {health.get('resting_heart_rate', 0):.0f} bpm

## 風險提醒
{alerts_str}

## 主要調養建議
{recs_str or '無'}

## 你的角色
- 以繁體中文回答，語氣親切但專業
- 回答必須根據以上數據，不要捏造數值
- 若問題超出數據範圍，誠實說明「目前的報告沒有這項數據」
- 不提供診斷，但可以解釋指標意義與改善方向
- 回答精簡，控制在 200 字以內，除非用戶需要詳細說明"""


@router.post("/chat/{session_id}")
async def chat_followup(session_id: str, req: ChatRequest):
    """SSE 串流：根據分析結果回答使用者的追問。"""
    session = load_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.get("analysis"):
        raise HTTPException(400, "請先完成分析再使用追問功能")

    if not settings.groq_api_key:
        raise HTTPException(500, "GROQ_API_KEY 未設定")

    system_prompt = _build_chat_system_prompt(session)

    groq_messages = [{"role": "system", "content": system_prompt}]
    for m in req.messages:
        if m.role in ("user", "assistant") and m.content.strip():
            groq_messages.append({"role": m.role, "content": m.content})

    payload = {
        "model": settings.groq_model,
        "temperature": 0.5,
        "stream": True,
        "messages": groq_messages,
    }

    async def event_generator():
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                ) as response:
                    if response.status_code >= 400:
                        err = await response.aread()
                        yield f"data: {json.dumps({'error': f'Groq API 錯誤: {err.decode()}'})}\n\n"
                        return

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if raw == "[DONE]":
                            yield f"data: {json.dumps({'done': True})}\n\n"
                            return
                        try:
                            chunk_data = json.loads(raw)
                            delta = chunk_data["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield f"data: {json.dumps({'chunk': delta}, ensure_ascii=False)}\n\n"
                        except Exception:
                            continue
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _load_session_data(session: dict, session_id: str) -> tuple[HealthData, QuestionnaireResponse]:
    """Load and reconstruct health data and questionnaire from session JSON."""
    health_raw = session.get("health")
    q_raw = session.get("questionnaire")

    if health_raw:
        health_data = HealthData(**health_raw)
    else:
        # Empty health data for questionnaire-only sessions
        health_data = HealthData(session_id=session_id)

    if q_raw:
        questionnaire = QuestionnaireResponse(**q_raw)
    else:
        questionnaire = QuestionnaireResponse(session_id=session_id)

    return health_data, questionnaire
