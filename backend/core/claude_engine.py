from __future__ import annotations
"""
LLM API integration for PulseBridge.
Builds the analysis prompt and streams responses via SSE.
"""
import json
import re
from typing import AsyncIterator, Optional

import httpx

from core.config import settings
from core.references import REFERENCES, ALLOWED_CODES, filter_references


def _clean_citations(raw) -> list[str]:
    """Keep only citation codes that exist in the registry."""
    if not isinstance(raw, list):
        return []
    allowed = set(ALLOWED_CODES)
    out: list[str] = []
    for c in raw:
        if isinstance(c, str) and c in allowed and c not in out:
            out.append(c)
    return out
from models.health_data import HealthData
from models.questionnaire import QuestionnaireResponse
from models.analysis import (
    AnalysisResult,
    ConstitutionScore,
    ConstitutionType,
    DataDrivenRecommendation,
    ECGAnalysis,
    ExecutiveSummary,
    HealthRecommendation,
    HRVAnalysis,
    IntegratedCardiacAssessment,
    MetricExplanation,
    RiskAlert,
    WesternFlags,
)


SYSTEM_PROMPT = """你是一位以數據為核心的心血管與自律神經分析助手，精通：
1. 單導程心電圖（ECG）與 Apple Watch ECG classification 解讀
2. 心率變異性（HRV）時間域與頻域分析
3. 自律神經平衡、恢復狀態與睡眠相關風險判讀
4. 依據已提供數據證據撰寫嚴謹、可執行的健康建議

重要原則：
- 以繁體中文為主要語言進行分析
- 以數據證據為優先，不要忽略已提供的 ECG/HRV 結構化分析結果
- 不要捏造不存在的量測值；若資料不足，必須明確說明 confidence 降低
- 對高風險指標（如 AFib、極低 HRV、明顯 ST 偏移）給予明確就醫建議
- 保持謹慎、不過度診斷的專業語氣
- 健康建議要直接對應數據異常，不要泛泛而論
- 中醫內容請以「身體狀態與調養方向」呈現，不要用九種體質分類去標籤使用者

你必須以有效的 JSON 格式回應，結構如下：
{
  "executive_summary": {
    "headline_zh": "一句話總結",
    "overall_risk_level": "low|medium|high|critical",
    "key_findings": ["3項以內重點發現"]
  },
  "integrated_cardiac_assessment": {
    "primary_conclusion_zh": "整合 ECG 與 HRV 的結論",
    "cardiac_risk_level": "low|medium|high|critical",
    "red_flags": ["高風險旗標"],
    "follow_up_priority": "immediate|1_week|2_weeks|routine"
  },
  "data_driven_recommendations": [
    {
      "domain": "ecg|hrv|recovery|lifestyle|follow_up",
      "priority": "high|medium|low",
      "title_zh": "建議標題",
      "why_zh": "直接對應到哪個數據異常",
      "target_metric": "希望改善到的指標或追蹤目標",
      "actions": ["最多3項具體行動"],
      "citations": ["引用代號，只能從 <allowed_citations> 中選擇"]
    }
  ],
  "metric_explanations": [
    {
      "metric_key": "sdnn|rmssd|lf_hf|pnn50|mean_rr|avg_hr|afib_burden|st_deviation|max_hr|min_hr|sleep_efficiency...",
      "metric_label_zh": "指標中文名稱",
      "current_value": "含單位的目前數值",
      "interpretation_zh": "這個數值落在哪個區間、目前狀態如何",
      "clinical_meaning_zh": "這項指標代表的生理意義與對健康的影響",
      "improvement_goal_zh": "接下來 2-8 週可追蹤的改善目標",
      "actionable_steps": ["最多 3 項具體可執行步驟"],
      "priority": "high|medium|low",
      "citations": ["引用代號，只能從 <allowed_citations> 中選擇"]
    }
  ],
  "recommendations": [
    {
      "category": "diet|lifestyle|exercise|tcm_herbs|acupressure|emotional",
      "title_zh": "建議標題",
      "content_zh": "具體建議內容（100字以內）",
      "priority": "high|medium|low",
      "evidence_basis": "tcm|western|integrative",
      "citations": ["引用代號，只能從 <allowed_citations> 中選擇"]
    }
  ],
  "warnings": ["需要就醫或特別注意的事項"],
  "summary_zh": "整體健康狀況摘要（200字以內）",
  "summary_en": "English summary (under 150 words)"
}"""


def build_analysis_prompt(
    health_data: HealthData,
    questionnaire: QuestionnaireResponse,
    tcm_scores: list[ConstitutionScore],
    ecg_alerts: list[RiskAlert],
    ecg_analysis: ECGAnalysis,
    hrv_analysis: HRVAnalysis,
    integrated_assessment: IntegratedCardiacAssessment,
) -> str:
    """Build the structured analysis prompt for the LLM."""

    hrv = health_data.hrv
    hrv_section = "無 HRV 數據"
    if hrv and hrv.sdnn > 0:
        hrv_section = f"""HRV SDNN: {hrv.sdnn:.1f}ms | RMSSD: {hrv.rmssd:.1f}ms
    LF/HF 比值: {hrv.lf_hf_ratio:.2f} | pNN50: {hrv.pnn50:.1f}%
    平均 RR 間期: {hrv.mean_rr:.0f}ms"""

    ecg_section = "無 ECG 數據"
    if health_data.ecg_readings:
        classifications = {}
        for r in health_data.ecg_readings:
            classifications[r.classification] = classifications.get(r.classification, 0) + 1
        ecg_section = "\n    ".join([f"{k}: {v}次" for k, v in classifications.items()])

    sleep_section = "無睡眠數據"
    if health_data.sleep:
        avg_total = sum(s.total_sleep_minutes for s in health_data.sleep) / len(health_data.sleep)
        avg_deep = sum(s.deep_sleep_minutes for s in health_data.sleep) / len(health_data.sleep)
        avg_rem = sum(s.rem_sleep_minutes for s in health_data.sleep) / len(health_data.sleep)
        avg_eff = sum(s.sleep_efficiency for s in health_data.sleep) / len(health_data.sleep)
        sleep_section = f"""平均睡眠時間: {avg_total:.0f}分鐘 ({avg_total/60:.1f}小時)
    深眠: {avg_deep:.0f}分鐘 ({avg_deep/avg_total*100:.0f}% 若>0)
    REM: {avg_rem:.0f}分鐘
    睡眠效率: {avg_eff*100:.0f}%"""

    # Symptom summary
    symptom_lines = []
    severity_labels = {0: "無", 1: "輕微", 2: "中等", 3: "嚴重"}
    categories = {
        "能量/疲勞": questionnaire.energy.model_dump(),
        "消化": questionnaire.digestion.model_dump(),
        "情緒": questionnaire.mood.model_dump(),
        "疼痛": questionnaire.pain.model_dump(),
        "睡眠": questionnaire.sleep.model_dump(),
    }
    symptom_name_map = {
        "fatigue": "疲勞", "morning_grogginess": "晨起昏沉", "afternoon_slump": "午後低能",
        "cold_limbs": "手腳冰冷", "spontaneous_sweating": "自汗", "night_sweats": "盜汗",
        "bloating": "腹脹", "loose_stools": "大便稀溏", "constipation": "便秘",
        "poor_appetite": "食慾不振", "heartburn": "胃酸逆流", "nausea_after_eating": "餐後噁心",
        "anxiety": "焦慮", "irritability": "易怒", "depression": "鬱悶",
        "mental_fog": "思維不清", "sighing": "嘆氣",
        "headache": "頭痛", "chest_tightness": "胸悶", "joint_pain": "關節疼痛",
        "muscle_aches": "肌肉痠痛", "fixed_pain_location": "固定部位疼痛",
        "difficulty_falling_asleep": "難以入睡", "frequent_waking": "夜間多醒",
        "dream_disturbed": "多夢紛擾", "early_morning_waking": "早醒",
    }
    for cat_name, symptoms in categories.items():
        active = [(symptom_name_map.get(k, k), v) for k, v in symptoms.items() if v > 0]
        if active:
            symptom_lines.append(f"    {cat_name}：" + "、".join([f"{n}（{severity_labels[v]}）" for n, v in active]))

    symptom_section = "\n".join(symptom_lines) if symptom_lines else "    無明顯症狀"

    # TCM scores
    top_scores = tcm_scores[:5]
    scores_section = "\n    ".join([
        f"{s.type.value}: {s.score:.0f}分（{s.confidence}）指標：{', '.join(s.key_indicators[:3]) or '無'}"
        for s in top_scores
    ])

    # Western alerts
    alerts_section = "無風險警示"
    if ecg_alerts:
        alerts_section = "\n    ".join([
            f"【{a.risk_level.upper()}】{a.title_zh}"
            for a in ecg_alerts
        ])

    citations_section = "\n".join(
        f"    [{code}] {REFERENCES[code]}" for code in ALLOWED_CODES
    )

    ecg_analysis_section = json.dumps(ecg_analysis.model_dump(), ensure_ascii=False, indent=2)
    hrv_analysis_section = json.dumps(hrv_analysis.model_dump(), ensure_ascii=False, indent=2)
    integrated_section = json.dumps(integrated_assessment.model_dump(), ensure_ascii=False, indent=2)

    resting_hr_str = f"{health_data.resting_heart_rate:.0f} bpm" if health_data.resting_heart_rate > 0 else "未知"
    stress_str = f"{health_data.stress_level:.0f}/100" if health_data.stress_level > 0 else "未知"

    return f"""請根據以下資料提供完整的數據導向心血管與自律神經分析，並以指定的 JSON 格式回應。

<patient_data>
  <wearable_metrics>
    靜息心率: {resting_hr_str}
    壓力指數: {stress_str}
    {hrv_section}
    ECG 記錄: {ecg_section}
  </wearable_metrics>

  <sleep_data>
    {sleep_section}
  </sleep_data>

  <symptom_questionnaire>
{symptom_section}
    備註: {questionnaire.additional_notes or '無'}
  </symptom_questionnaire>

  <rule_based_tcm_scores>
    {scores_section}
  </rule_based_tcm_scores>

  <western_risk_flags>
    {alerts_section}
  </western_risk_flags>

  <derived_ecg_analysis>
{ecg_analysis_section}
  </derived_ecg_analysis>

  <derived_hrv_analysis>
{hrv_analysis_section}
  </derived_hrv_analysis>

  <integrated_rule_based_assessment>
{integrated_section}
  </integrated_rule_based_assessment>

  <allowed_citations>
{citations_section}
  </allowed_citations>
</patient_data>

請特別注意：
1. 以 ECG 與 HRV 數據分析作為主體，不要把九種體質分類當成主角
2. executive_summary 與 integrated_cardiac_assessment 必須引用已提供的 derived analysis
3. data_driven_recommendations 必須直接對應異常指標或追蹤需求
4. metric_explanations 至少提供 6 項指標，且每項都要同時包含「意義解釋」與「改善方式」
5. 若資料不足，請在 key_findings、why_zh、interpretation_zh 或 summary_zh 明確指出限制
6. 若同時有 ECG 與 HRV，metric_explanations 需覆蓋兩者，不可只寫單一面向
7. recommendations 應以中醫視角整理調養建議，可參考症狀與 rule_based_tcm_scores，但不要直接寫成「你是某某體質」
8. recommendations 不能與 data_driven_recommendations 重複
9. 每個 data_driven_recommendations、metric_explanations、recommendations 項目都必須附上 citations 陣列，代號只能從 <allowed_citations> 挑選；若找不到合適來源可留空陣列，不可捏造新代號

請務必以有效的 JSON 格式回應，不要在 JSON 外加任何文字。"""


def build_groq_payload(prompt: str) -> dict:
    """Build the Groq chat completion payload from the final prompt."""
    cleaned_prompt = prompt.strip()
    if not cleaned_prompt:
        raise RuntimeError("分析 prompt 為空，無法送出 Groq 請求")
    if "<patient_data>" not in cleaned_prompt:
        raise RuntimeError("分析 prompt 缺少病患資料區塊，已停止送出")

    return {
        "model": settings.groq_model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": cleaned_prompt},
        ],
    }


async def stream_analysis(
    health_data: HealthData,
    questionnaire: QuestionnaireResponse,
    tcm_scores: list[ConstitutionScore],
    ecg_alerts: list[RiskAlert],
    ecg_analysis: ECGAnalysis,
    hrv_analysis: HRVAnalysis,
    integrated_assessment: IntegratedCardiacAssessment,
) -> AsyncIterator[str]:
    """Call Groq and yield response chunks for the SSE UI."""
    prompt = build_analysis_prompt(
        health_data,
        questionnaire,
        tcm_scores,
        ecg_alerts,
        ecg_analysis,
        hrv_analysis,
        integrated_assessment,
    )
    payload = build_groq_payload(prompt)
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY 未設定")

    with httpx.Client(timeout=120.0) as http_client:
        response = http_client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code >= 400:
        try:
            payload = response.json()
            message = payload.get("error", {}).get("message") or payload
        except Exception:
            message = response.text
        raise RuntimeError(f"Groq API 錯誤: {message}")

    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    if not content:
        raise RuntimeError("Groq API 未回傳分析內容")

    for i in range(0, len(content), 160):
        yield content[i:i + 160]


def parse_claude_response(raw_response: str) -> dict:
    """Extract and parse JSON from Claude's response."""
    # Try to extract JSON from the response
    json_match = re.search(r'\{[\s\S]*\}', raw_response)
    if not json_match:
        return {}
    try:
        return json.loads(json_match.group())
    except json.JSONDecodeError:
        return {}


def build_analysis_result_from_claude(
    session_id: str,
    raw_response: str,
    tcm_scores: list[ConstitutionScore],
    ecg_alerts: list[RiskAlert],
    western_flags: WesternFlags,
    ecg_analysis: ECGAnalysis,
    hrv_analysis: HRVAnalysis,
    integrated_assessment: IntegratedCardiacAssessment,
) -> AnalysisResult:
    """Build AnalysisResult from Claude's JSON response and pre-computed scores."""
    parsed = parse_claude_response(raw_response)

    # Extract primary/secondary constitution from Claude (or fall back to scorer)
    primary_name = parsed.get("constitution_analysis", {}).get("primary", "")
    secondary_name = parsed.get("constitution_analysis", {}).get("secondary", None)

    # Validate against known types
    valid_types = {t.value for t in ConstitutionType}
    primary = ConstitutionType(primary_name) if primary_name in valid_types else (
        tcm_scores[0].type if tcm_scores else ConstitutionType.BALANCED
    )
    secondary = None
    if secondary_name and secondary_name in valid_types and secondary_name != primary_name:
        secondary = ConstitutionType(secondary_name)

    # Build recommendations
    recommendations: list[HealthRecommendation] = []
    for r in parsed.get("recommendations", []):
        try:
            recommendations.append(HealthRecommendation(
                category=r.get("category", "lifestyle"),
                title_zh=r.get("title_zh", ""),
                content_zh=r.get("content_zh", ""),
                priority=r.get("priority", "medium"),
                evidence_basis=r.get("evidence_basis", "integrative"),
                citations=_clean_citations(r.get("citations")),
            ))
        except Exception:
            continue

    # Add acupressure points as recommendations
    for pt in parsed.get("acupressure_points", []):
        name = pt.get("name_zh", "")
        location = pt.get("location_zh", "")
        method = pt.get("method_zh", "")
        benefit = pt.get("benefit_zh", "")
        if name:
            recommendations.append(HealthRecommendation(
                category="acupressure",
                title_zh=f"穴位：{name}",
                content_zh=f"位置：{location}。操作：{method}。功效：{benefit}",
                priority="medium",
                evidence_basis="tcm",
            ))

    # Build additional risk alerts from Claude warnings
    for warning in parsed.get("warnings", []):
        if warning and isinstance(warning, str):
            ecg_alerts.append(RiskAlert(
                id="claude-" + str(len(ecg_alerts)),
                category="cardiac",
                risk_level="medium",
                title_zh=warning[:50],
                title_en="Warning",
                description_zh=warning,
                recommendation=warning,
                trigger_values={},
            ))

    risk_levels = {"low", "medium", "high", "critical"}
    follow_up_priorities = {"immediate", "1_week", "2_weeks", "routine"}

    executive_summary_raw = parsed.get("executive_summary", {})
    executive_risk = executive_summary_raw.get("overall_risk_level", integrated_assessment.cardiac_risk_level)
    if executive_risk not in risk_levels:
        executive_risk = integrated_assessment.cardiac_risk_level
    executive_summary = ExecutiveSummary(
        headline_zh=executive_summary_raw.get("headline_zh", integrated_assessment.primary_conclusion_zh),
        overall_risk_level=executive_risk,
        key_findings=[item for item in executive_summary_raw.get("key_findings", []) if isinstance(item, str)],
    )

    integrated_raw = parsed.get("integrated_cardiac_assessment", {})
    integrated_risk = integrated_raw.get("cardiac_risk_level", integrated_assessment.cardiac_risk_level)
    if integrated_risk not in risk_levels:
        integrated_risk = integrated_assessment.cardiac_risk_level
    follow_up_priority = integrated_raw.get("follow_up_priority", integrated_assessment.follow_up_priority)
    if follow_up_priority not in follow_up_priorities:
        follow_up_priority = integrated_assessment.follow_up_priority
    integrated_result = IntegratedCardiacAssessment(
        primary_conclusion_zh=integrated_raw.get("primary_conclusion_zh", integrated_assessment.primary_conclusion_zh),
        cardiac_risk_level=integrated_risk,
        red_flags=[item for item in integrated_raw.get("red_flags", integrated_assessment.red_flags) if isinstance(item, str)],
        follow_up_priority=follow_up_priority,
    )

    data_driven_recommendations: list[DataDrivenRecommendation] = []
    for item in parsed.get("data_driven_recommendations", []):
        if not isinstance(item, dict):
            continue
        try:
            data_driven_recommendations.append(DataDrivenRecommendation(
                domain=item.get("domain", "lifestyle"),
                priority=item.get("priority", "medium"),
                title_zh=item.get("title_zh", ""),
                why_zh=item.get("why_zh", ""),
                target_metric=item.get("target_metric", ""),
                actions=[action for action in item.get("actions", []) if isinstance(action, str)],
                citations=_clean_citations(item.get("citations")),
            ))
        except Exception:
            continue

    metric_explanations: list[MetricExplanation] = []
    for item in parsed.get("metric_explanations", []):
        if not isinstance(item, dict):
            continue
        try:
            metric_explanations.append(MetricExplanation(
                metric_key=item.get("metric_key", ""),
                metric_label_zh=item.get("metric_label_zh", ""),
                current_value=item.get("current_value", ""),
                interpretation_zh=item.get("interpretation_zh", ""),
                clinical_meaning_zh=item.get("clinical_meaning_zh", ""),
                improvement_goal_zh=item.get("improvement_goal_zh", ""),
                actionable_steps=[step for step in item.get("actionable_steps", []) if isinstance(step, str)],
                priority=item.get("priority", "medium"),
                citations=_clean_citations(item.get("citations")),
            ))
        except Exception:
            continue

    used_codes: list[str] = []
    for coll in (recommendations, data_driven_recommendations, metric_explanations):
        for it in coll:
            used_codes.extend(it.citations)
    references = filter_references(used_codes)

    return AnalysisResult(
        session_id=session_id,
        executive_summary=executive_summary,
        ecg_analysis=ecg_analysis,
        hrv_analysis=hrv_analysis,
        integrated_cardiac_assessment=integrated_result,
        data_driven_recommendations=data_driven_recommendations,
        metric_explanations=metric_explanations,
        primary_constitution=primary,
        secondary_constitution=secondary,
        constitution_scores=tcm_scores,
        risk_alerts=ecg_alerts,
        recommendations=recommendations,
        claude_summary_zh=parsed.get("summary_zh", ""),
        claude_summary_en=parsed.get("summary_en", ""),
        western_flags=western_flags,
        references=references,
        raw_claude_response=raw_response,
        status="completed",
    )
