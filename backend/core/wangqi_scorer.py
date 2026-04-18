"""
ZYYXH/T157-2009 王琦九種體質量表 scorer.

The standard 60-item scale groups items into 9 subscales (one per
constitution type). Each item is a 5-point Likert (1=沒有, 5=總是).
Subscale score (轉化分) = ((raw − n) / (n × 4)) × 100, where n = item
count. Judgment thresholds are the national standard:

  平和質: 轉化分 ≥ 60 AND all 偏頗 transformed < 40  → "是"
          ≥ 60 AND all 偏頗 < 30                    → "基本是"
  偏頗質:  轉化分 ≥ 40                              → "是"
          30 ≤ 轉化分 < 40                          → "傾向是"
          < 30                                      → "否"

This module only scores; the frontend owns the actual item wording.
Callers pass a dict of item_id → answer (1–5).
"""
from __future__ import annotations

from typing import Literal

# ---------------------------------------------------------------------------
# Subscale layout — item ids and reverse-score flags.
# Item ids use the convention "{type_code}_{n}". reverse_ids hold ids whose
# answer must be reversed before summing (5→1, 4→2, …), per the standard.
# ---------------------------------------------------------------------------

_SUBSCALES: dict[str, dict] = {
    "平和質": {
        "count": 8,
        "ids": [f"balanced_{i}" for i in range(1, 9)],
        # Standard reverse items: #2,3,4,5,7,8 (only #1,#6 are positively worded)
        "reverse_ids": {f"balanced_{i}" for i in (2, 3, 4, 5, 7, 8)},
    },
    "氣虛質": {"count": 8, "ids": [f"qi_def_{i}"   for i in range(1, 9)], "reverse_ids": set()},
    "陽虛質": {"count": 7, "ids": [f"yang_def_{i}" for i in range(1, 8)], "reverse_ids": set()},
    "陰虛質": {"count": 8, "ids": [f"yin_def_{i}"  for i in range(1, 9)], "reverse_ids": set()},
    "痰濕質": {"count": 8, "ids": [f"phlegm_{i}"   for i in range(1, 9)], "reverse_ids": set()},
    "濕熱質": {"count": 6, "ids": [f"dampheat_{i}" for i in range(1, 7)], "reverse_ids": set()},
    "血瘀質": {"count": 7, "ids": [f"stasis_{i}"   for i in range(1, 8)], "reverse_ids": set()},
    "氣鬱質": {"count": 7, "ids": [f"qi_stag_{i}"  for i in range(1, 8)], "reverse_ids": set()},
    "特稟質": {"count": 7, "ids": [f"special_{i}"  for i in range(1, 8)], "reverse_ids": set()},
}

ALL_ITEM_IDS: list[str] = [
    item_id for sub in _SUBSCALES.values() for item_id in sub["ids"]
]

Judgment = Literal["是", "基本是", "傾向是", "否"]


def transformed_score(subscale: str, answers: dict[str, int]) -> float:
    """Compute 轉化分 for a single subscale. Missing items count as 1 (無)."""
    sub = _SUBSCALES[subscale]
    ids: list[str] = sub["ids"]
    reverse: set[str] = sub["reverse_ids"]
    n = sub["count"]

    raw = 0
    for item_id in ids:
        a = answers.get(item_id, 1)
        if not (1 <= a <= 5):
            a = 1
        if item_id in reverse:
            a = 6 - a
        raw += a

    return round(((raw - n) / (n * 4)) * 100, 1)


def score_all(answers: dict[str, int]) -> dict[str, float]:
    """Return transformed scores for all 9 subscales."""
    return {name: transformed_score(name, answers) for name in _SUBSCALES}


def judge(scores: dict[str, float]) -> dict[str, Judgment]:
    """
    Apply the ZYYXH/T157-2009 judgment rules.

    Returns a map of constitution → judgment.
    """
    biased = [k for k in scores if k != "平和質"]
    balanced = scores.get("平和質", 0.0)
    biased_max = max((scores[k] for k in biased), default=0.0)

    result: dict[str, Judgment] = {}

    if balanced >= 60 and biased_max < 40:
        result["平和質"] = "是" if biased_max < 30 else "基本是"
    elif balanced >= 60 and biased_max < 30:
        result["平和質"] = "基本是"
    else:
        result["平和質"] = "否"

    for k in biased:
        s = scores[k]
        if s >= 40:
            result[k] = "是"
        elif s >= 30:
            result[k] = "傾向是"
        else:
            result[k] = "否"

    return result


def primary_constitution(scores: dict[str, float], verdicts: dict[str, Judgment]) -> str:
    """Pick the dominant type per the standard."""
    if verdicts.get("平和質") in ("是", "基本是"):
        return "平和質"

    # Highest-scoring 偏頗質 judged "是"; fall back to highest-scoring overall.
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    for name, _ in ranked:
        if name != "平和質" and verdicts.get(name) == "是":
            return name
    return ranked[0][0] if ranked else "平和質"
