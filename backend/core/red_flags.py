from __future__ import annotations
"""
Red flag guardrail.

Purpose: ensure that combinations of symptoms/findings suggesting an
emergency cardiac or neurological event always surface as a top-priority
alert, regardless of how the downstream LLM summarises the data.

The rules here are conservative — they are not a diagnostic instrument,
but a safety net that forces "seek medical evaluation" messaging when
a known red flag pattern is present.
"""
import uuid

from models.analysis import RiskAlert
from models.health_data import ECGReading, HRVMetrics
from models.questionnaire import QuestionnaireResponse


# Severity threshold for the questionnaire's 0-3 scale.
# 2 = "中等" / moderate, 3 = "嚴重" / severe.
SEVERE = 2


def detect_red_flags(
    questionnaire: QuestionnaireResponse | None,
    hrv: HRVMetrics | None,
    ecg_readings: list[ECGReading] | None,
) -> list[RiskAlert]:
    """
    Return guardrail alerts for high-risk symptom/finding combinations.

    Current rules:
      1. Chest tightness (moderate+) combined with AFib on ECG → immediate.
      2. Chest tightness + severely reduced HRV (SDNN < 20) → immediate.
      3. Severe chest tightness alone with any palpitation/syncope proxy → immediate.
      4. Chest tightness + irregular rhythm on ECG → urgent.
    """
    alerts: list[RiskAlert] = []

    if questionnaire is None:
        return alerts

    chest = questionnaire.pain.chest_tightness
    if chest < SEVERE:
        return alerts

    afib_present = any(
        r.classification == "atrialFibrillation" for r in (ecg_readings or [])
    )
    inconclusive_burden = sum(
        1 for r in (ecg_readings or [])
        if "inconclusive" in (r.classification or "").lower()
    )
    low_hrv = bool(hrv and hrv.sdnn > 0 and hrv.sdnn < 20)

    # Rule 1: chest + AFib
    if afib_present:
        alerts.append(_build_alert(
            "critical",
            "立即就醫：胸悶合併心房顫動",
            "Urgent: Chest tightness with atrial fibrillation",
            "您回報胸悶症狀，且 ECG 偵測到心房顫動。此組合屬急診就醫警訊，"
            "可能涉及心源性胸痛或中風前兆。",
            "請立即前往急診。切勿自行駕車。若出現意識改變、冒冷汗、噁心或"
            "疼痛放射至下顎/左臂，立即撥打 119。",
            {"chest_tightness_severity": chest, "afib": True},
        ))
        return alerts

    # Rule 2: chest + severely low HRV
    if low_hrv:
        alerts.append(_build_alert(
            "critical",
            "立即就醫：胸悶合併自主神經嚴重抑制",
            "Urgent: Chest tightness with critically low HRV",
            f"您回報胸悶症狀，且 SDNN {hrv.sdnn:.1f}ms 嚴重偏低。"
            "此組合可能反映急性心肌缺血或自主神經失調。",
            "請立即前往急診進行心電圖、心肌酶與必要的心導管評估。",
            {"chest_tightness_severity": chest, "sdnn": hrv.sdnn},
        ))
        return alerts

    # Rule 3: severe chest + palpitation-like symptom cluster
    if chest >= 3 and (questionnaire.mood.anxiety >= SEVERE or inconclusive_burden >= 2):
        alerts.append(_build_alert(
            "high",
            "儘快就醫：嚴重胸悶合併心律不穩訊號",
            "Urgent: Severe chest tightness with rhythm concerns",
            "您回報嚴重胸悶，且伴隨焦慮或多次 ECG 結果不確定。"
            "無法排除心律不整或心絞痛。",
            "請於 24 小時內至心臟科或急診評估，並攜帶 Apple Watch ECG 記錄。",
            {"chest_tightness_severity": chest},
        ))
        return alerts

    # Rule 4: chest + any cardiac irregularity fallback
    if inconclusive_burden >= 1:
        alerts.append(_build_alert(
            "high",
            "建議儘速就醫：胸悶合併 ECG 不確定結果",
            "Urgent: Chest tightness with inconclusive ECG",
            "您回報胸悶症狀，且有 ECG 判讀不確定的記錄。",
            "建議一週內至心臟科進行 12 導程心電圖與相關檢查。",
            {"chest_tightness_severity": chest,
             "inconclusive_readings": inconclusive_burden},
        ))

    return alerts


def _build_alert(
    risk_level: str,
    title_zh: str,
    title_en: str,
    description_zh: str,
    recommendation: str,
    trigger_values: dict,
) -> RiskAlert:
    return RiskAlert(
        id="redflag-" + str(uuid.uuid4())[:8],
        category="cardiac",
        risk_level=risk_level,  # type: ignore[arg-type]
        title_zh=title_zh,
        title_en=title_en,
        description_zh=description_zh,
        recommendation=recommendation,
        trigger_values=trigger_values,
    )
