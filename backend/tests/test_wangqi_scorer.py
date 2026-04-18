from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core import wangqi_scorer


def _answers(default: int, overrides: dict[str, int] | None = None) -> dict[str, int]:
    a = {item_id: default for item_id in wangqi_scorer.ALL_ITEM_IDS}
    if overrides:
        a.update(overrides)
    return a


def test_transformed_score_bounds():
    """All-1 answers → 0; all-5 answers → 100 for non-reverse subscales."""
    all_ones = _answers(1)
    all_fives = _answers(5)

    scores_low = wangqi_scorer.score_all(all_ones)
    scores_high = wangqi_scorer.score_all(all_fives)

    # 平和質 has reverse-scored items: all-1 and all-5 are not trivially 0/100
    for name, score in scores_low.items():
        if name == "平和質":
            continue
        assert score == 0.0, f"{name} all-1 should be 0, got {score}"
    for name, score in scores_high.items():
        if name == "平和質":
            continue
        assert score == 100.0, f"{name} all-5 should be 100, got {score}"


def test_balanced_reverse_scoring():
    """平和質: positive-item=5 and reverse-items=1 → 100分（最健康）."""
    # balanced_1 and balanced_6 are positive; 2,3,4,5,7,8 are reverse
    overrides = {
        "balanced_1": 5, "balanced_6": 5,
        "balanced_2": 1, "balanced_3": 1, "balanced_4": 1,
        "balanced_5": 1, "balanced_7": 1, "balanced_8": 1,
    }
    a = _answers(1, overrides)
    assert wangqi_scorer.transformed_score("平和質", a) == 100.0


def test_judgment_balanced_yes():
    """平和質 ≥60 且其他偏頗 <30 → 平和質 是."""
    # Achieve 平和 ≥60 by answering positives=4, reverses=2
    overrides = {f"balanced_{i}": 4 for i in (1, 6)}
    overrides.update({f"balanced_{i}": 2 for i in (2, 3, 4, 5, 7, 8)})
    a = _answers(1, overrides)  # other subscales default to 1 → 0分
    scores = wangqi_scorer.score_all(a)
    verdicts = wangqi_scorer.judge(scores)

    assert scores["平和質"] >= 60
    assert verdicts["平和質"] in ("是", "基本是")


def test_judgment_biased_yes():
    """氣虛質 ≥40 → 是."""
    overrides = {f"qi_def_{i}": 3 for i in range(1, 9)}  # raw=24, n=8 → (24-8)/32*100=50
    a = _answers(1, overrides)
    scores = wangqi_scorer.score_all(a)
    verdicts = wangqi_scorer.judge(scores)

    assert scores["氣虛質"] == 50.0
    assert verdicts["氣虛質"] == "是"


def test_judgment_tendency():
    """30 ≤ 轉化分 < 40 → 傾向是."""
    # 陽虛質 n=7. raw=18 → (18-7)/(7*4)*100 = 39.3 ∈ [30, 40)
    overrides = {
        "yang_def_1": 3, "yang_def_2": 3, "yang_def_3": 3, "yang_def_4": 3,
        "yang_def_5": 2, "yang_def_6": 2, "yang_def_7": 2,
    }
    a = _answers(1, overrides)
    scores = wangqi_scorer.score_all(a)
    verdicts = wangqi_scorer.judge(scores)

    assert 30 <= scores["陽虛質"] < 40
    assert verdicts["陽虛質"] == "傾向是"


def test_primary_constitution_picks_yes():
    """當偏頗有「是」判定時，primary 應為最高分的「是」."""
    overrides = {f"stasis_{i}": 5 for i in range(1, 8)}  # 血瘀質 → 100
    a = _answers(1, overrides)
    scores = wangqi_scorer.score_all(a)
    verdicts = wangqi_scorer.judge(scores)

    assert wangqi_scorer.primary_constitution(scores, verdicts) == "血瘀質"


def test_all_item_ids_count():
    """Scale spans 8+8+7+8+8+6+7+7+7 = 66 items."""
    assert len(wangqi_scorer.ALL_ITEM_IDS) == 66
    assert len(set(wangqi_scorer.ALL_ITEM_IDS)) == 66  # unique
