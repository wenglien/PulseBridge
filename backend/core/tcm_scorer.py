from __future__ import annotations
"""
TCM Constitution Scoring Algorithm.
Scores all 9 constitution types using HRV metrics, sleep data, and symptom questionnaire.
Based on the Chinese national standard: 中醫體質分類與判定 (GB/T 21751-2008).
"""
from models.health_data import HealthData, HRVMetrics, SleepData
from models.questionnaire import QuestionnaireResponse
from models.analysis import ConstitutionScore, ConstitutionType


# Symptom → Constitution weight map
# Format: {symptom_key: {ConstitutionType: weight (0–5)}}
SYMPTOM_CONSTITUTION_MAP: dict[str, dict[str, float]] = {
    # Energy symptoms
    "fatigue": {"氣虛質": 3.5, "陽虛質": 2.0},
    "morning_grogginess": {"氣虛質": 2.0, "痰濕質": 2.5, "陽虛質": 1.5},
    "afternoon_slump": {"氣虛質": 3.0, "陰虛質": 1.5},
    "cold_limbs": {"陽虛質": 5.0, "氣虛質": 1.5, "血瘀質": 1.0},
    "spontaneous_sweating": {"氣虛質": 4.0},
    "night_sweats": {"陰虛質": 5.0},
    # Digestion symptoms
    "bloating": {"痰濕質": 3.0, "氣鬱質": 2.5, "氣虛質": 1.5},
    "loose_stools": {"氣虛質": 3.0, "陽虛質": 3.0, "痰濕質": 1.5},
    "constipation": {"陰虛質": 2.5, "氣鬱質": 2.0, "濕熱質": 1.5},
    "poor_appetite": {"氣虛質": 3.0, "陽虛質": 2.0, "痰濕質": 1.5},
    "heartburn": {"濕熱質": 4.0, "陰虛質": 1.5},
    "nausea_after_eating": {"痰濕質": 3.5, "氣鬱質": 2.0},
    # Mood symptoms
    "anxiety": {"氣鬱質": 4.0, "陰虛質": 1.5},
    "irritability": {"濕熱質": 3.0, "氣鬱質": 2.5, "陰虛質": 1.5},
    "depression": {"氣鬱質": 4.5, "陽虛質": 1.5},
    "mental_fog": {"痰濕質": 4.0, "氣虛質": 2.0},
    "sighing": {"氣鬱質": 5.0},
    # Pain symptoms
    "headache": {"血瘀質": 2.0, "氣鬱質": 2.0, "濕熱質": 1.5},
    "chest_tightness": {"血瘀質": 3.5, "氣鬱質": 3.0},
    "joint_pain": {"血瘀質": 2.5, "陽虛質": 2.0, "痰濕質": 2.0},
    "muscle_aches": {"血瘀質": 2.0, "氣鬱質": 1.5},
    "fixed_pain_location": {"血瘀質": 5.0},
    # Sleep symptoms
    "difficulty_falling_asleep": {"氣鬱質": 3.5, "陰虛質": 2.5, "濕熱質": 1.5},
    "frequent_waking": {"陰虛質": 3.0, "氣鬱質": 2.0, "血瘀質": 1.0},
    "dream_disturbed": {"氣鬱質": 3.5, "陰虛質": 2.5},
    "early_morning_waking": {"陰虛質": 3.0, "氣鬱質": 2.5},
}

ALL_TYPES = [t.value for t in ConstitutionType]


def score_constitutions(
    health_data: HealthData,
    questionnaire: QuestionnaireResponse,
) -> list[ConstitutionScore]:
    """
    Compute scores for all 9 TCM constitution types.
    Returns sorted list (highest score first).
    """
    raw_scores: dict[str, float] = {t: 0.0 for t in ALL_TYPES}

    # --- 1. HRV/physiological scoring (max ~40 pts) ---
    hrv = health_data.hrv
    if hrv and hrv.sdnn > 0:
        raw_scores = _apply_hrv_scores(raw_scores, hrv, health_data.resting_heart_rate)

    # --- 2. Symptom questionnaire scoring (max ~40 pts) ---
    raw_scores = _apply_symptom_scores(raw_scores, questionnaire)

    # --- 3. Sleep data scoring (max ~20 pts) ---
    if health_data.sleep:
        raw_scores = _apply_sleep_scores(raw_scores, health_data.sleep)

    # --- Normalize to 0–100 ---
    max_score = max(raw_scores.values()) if raw_scores else 1.0
    if max_score < 0.01:
        max_score = 1.0

    normalized: dict[str, float] = {
        t: round((s / max_score) * 100, 1) for t, s in raw_scores.items()
    }

    # If highest score < 40 and data is minimal → primary = 平和質
    top_score = max(normalized.values())
    if top_score < 40:
        normalized["平和質"] = max(normalized["平和質"], 60.0)

    # Build ConstitutionScore list with key indicators
    scores: list[ConstitutionScore] = []
    for type_name, score in normalized.items():
        indicators = _get_key_indicators(type_name, hrv, questionnaire, health_data.sleep)
        confidence = "high" if score > 70 else "medium" if score > 40 else "low"
        scores.append(ConstitutionScore(
            type=ConstitutionType(type_name),
            score=score,
            confidence=confidence,
            key_indicators=indicators,
        ))

    return sorted(scores, key=lambda x: x.score, reverse=True)


def _apply_hrv_scores(
    scores: dict[str, float],
    hrv: HRVMetrics,
    resting_hr: float,
) -> dict[str, float]:
    sdnn = hrv.sdnn
    rmssd = hrv.rmssd
    lf_hf = hrv.lf_hf_ratio
    pnn50 = hrv.pnn50
    hr = resting_hr if resting_hr > 0 else (60000 / hrv.mean_rr if hrv.mean_rr > 0 else 70)

    # 氣虛質: Low HRV, low pNN50
    if sdnn < 30:
        scores["氣虛質"] += 15
    elif sdnn < 45:
        scores["氣虛質"] += 8
    if rmssd < 20:
        scores["氣虛質"] += 12
    if pnn50 < 3:
        scores["氣虛質"] += 8

    # 陽虛質: Bradycardia tendency, low sympathetic
    if hr < 58:
        scores["陽虛質"] += 10
    if lf_hf < 1.0:
        scores["陽虛質"] += 8
    if sdnn < 35:
        scores["陽虛質"] += 8

    # 陰虛質: Tachycardia tendency, high sympathetic at rest
    if hr > 80:
        scores["陰虛質"] += 10
    if sdnn > 60:
        scores["陰虛質"] += 5
    if rmssd > 40:
        scores["陰虛質"] += 5

    # 痰濕質: Low overall HRV, high resting HR
    if sdnn < 35 and hr > 72:
        scores["痰濕質"] += 12
    if pnn50 < 5:
        scores["痰濕質"] += 8

    # 濕熱質: High stress (high LF/HF) + tachycardia
    if lf_hf > 3.5:
        scores["濕熱質"] += 12
    if hr > 78:
        scores["濕熱質"] += 8

    # 血瘀質: Extreme LF/HF (very high or very low)
    if lf_hf > 5.0 or lf_hf < 0.5:
        scores["血瘀質"] += 10

    # 氣鬱質: Moderate-high LF/HF, moderate SDNN
    if 2.5 < lf_hf < 5.0:
        scores["氣鬱質"] += 12
    if 30 < sdnn < 55:
        scores["氣鬱質"] += 6

    # 特稟質: Irregular HRV (high coefficient of variation in RR)
    if hrv.rr_intervals and len(hrv.rr_intervals) > 10:
        import numpy as np
        rr_arr = [r for r in hrv.rr_intervals if 300 < r < 2000]
        if rr_arr:
            cv = float(np.std(rr_arr) / np.mean(rr_arr)) if np.mean(rr_arr) > 0 else 0
            if cv > 0.15:
                scores["特稟質"] += 12

    # 平和質: Normal HRV range
    if 45 <= sdnn <= 85 and 25 <= rmssd <= 55 and 1.0 <= lf_hf <= 3.0:
        scores["平和質"] += 20

    return scores


def _apply_symptom_scores(
    scores: dict[str, float],
    q: QuestionnaireResponse,
) -> dict[str, float]:
    # Flatten all symptoms into a single dict
    all_symptoms: dict[str, int] = {}
    for category in [q.energy, q.digestion, q.mood, q.pain, q.sleep]:
        all_symptoms.update(category.model_dump())

    for symptom_key, severity in all_symptoms.items():
        if severity == 0:
            continue
        if symptom_key not in SYMPTOM_CONSTITUTION_MAP:
            continue
        for constitution, weight in SYMPTOM_CONSTITUTION_MAP[symptom_key].items():
            scores[constitution] += severity * weight

    return scores


def _apply_sleep_scores(
    scores: dict[str, float],
    sleep_list: list[SleepData],
) -> dict[str, float]:
    if not sleep_list:
        return scores

    avg_deep = sum(s.deep_sleep_minutes for s in sleep_list) / len(sleep_list)
    avg_rem = sum(s.rem_sleep_minutes for s in sleep_list) / len(sleep_list)
    avg_efficiency = sum(s.sleep_efficiency for s in sleep_list) / len(sleep_list)
    avg_awake = sum(s.awake_minutes for s in sleep_list) / len(sleep_list)

    if avg_deep < 60:
        scores["氣虛質"] += 8
        scores["陽虛質"] += 6
    if avg_rem < 60:
        scores["陰虛質"] += 8
    if avg_efficiency < 0.75:
        scores["痰濕質"] += 8
        scores["氣鬱質"] += 6
    if avg_awake > 60:
        scores["陰虛質"] += 8
        scores["氣鬱質"] += 6
    if avg_deep >= 90 and avg_rem >= 90 and avg_efficiency >= 0.85:
        scores["平和質"] += 10

    return scores


def _get_key_indicators(
    type_name: str,
    hrv: HRVMetrics | None,
    q: QuestionnaireResponse,
    sleep_list: list[SleepData],
) -> list[str]:
    """Generate human-readable key indicators for a constitution type."""
    indicators: list[str] = []

    hrv_indicators = {
        "氣虛質": lambda h: h.sdnn < 35 and ["低 SDNN"] or [],
        "陽虛質": lambda h: h.lf_hf_ratio < 1.2 and ["低 LF/HF 比值"] or [],
        "陰虛質": lambda h: h.sdnn > 55 and ["偏高 SDNN"] or [],
        "痰濕質": lambda h: h.pnn50 < 5 and ["低 pNN50"] or [],
        "濕熱質": lambda h: h.lf_hf_ratio > 3.5 and ["高 LF/HF 比值"] or [],
        "血瘀質": lambda h: (h.lf_hf_ratio > 5 or h.lf_hf_ratio < 0.5) and ["異常 LF/HF 比值"] or [],
        "氣鬱質": lambda h: 2.5 < h.lf_hf_ratio < 5 and ["中高 LF/HF 比值"] or [],
    }

    if hrv and hrv.sdnn > 0 and type_name in hrv_indicators:
        indicators.extend(hrv_indicators[type_name](hrv))

    # Top symptom indicators
    all_symptoms: dict[str, int] = {}
    for cat in [q.energy, q.digestion, q.mood, q.pain, q.sleep]:
        all_symptoms.update(cat.model_dump())

    symptom_labels = {
        "fatigue": "疲勞", "cold_limbs": "手腳冰冷", "night_sweats": "盜汗",
        "spontaneous_sweating": "自汗", "bloating": "腹脹", "loose_stools": "大便稀溏",
        "constipation": "便秘", "heartburn": "胃酸逆流", "anxiety": "焦慮",
        "irritability": "易怒", "depression": "鬱悶", "mental_fog": "思維不清",
        "sighing": "嘆氣", "chest_tightness": "胸悶", "fixed_pain_location": "固定疼痛",
        "difficulty_falling_asleep": "難以入睡", "dream_disturbed": "多夢",
    }

    for symptom, severity in all_symptoms.items():
        if severity >= 2 and symptom in SYMPTOM_CONSTITUTION_MAP:
            if type_name in SYMPTOM_CONSTITUTION_MAP[symptom]:
                label = symptom_labels.get(symptom, symptom)
                indicators.append(label)

    # Sleep indicators
    if sleep_list:
        avg_deep = sum(s.deep_sleep_minutes for s in sleep_list) / len(sleep_list)
        avg_rem = sum(s.rem_sleep_minutes for s in sleep_list) / len(sleep_list)
        if type_name in ("氣虛質", "陽虛質") and avg_deep < 60:
            indicators.append("深眠不足")
        if type_name == "陰虛質" and avg_rem < 60:
            indicators.append("REM 睡眠不足")

    return list(dict.fromkeys(indicators))[:5]  # deduplicate, max 5
