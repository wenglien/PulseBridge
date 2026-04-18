"""Tests for TCM constitution scoring."""
from __future__ import annotations

import pytest

from core.tcm_scorer import score_constitutions
from models.analysis import ConstitutionType
from models.health_data import HealthData, HRVMetrics
from models.questionnaire import (
    DigestionSymptoms,
    EnergySymptoms,
    MoodSymptoms,
    PainSymptoms,
    QuestionnaireResponse,
    SleepSymptoms,
)


def _blank_questionnaire() -> QuestionnaireResponse:
    return QuestionnaireResponse(
        session_id="test",
        energy=EnergySymptoms(),
        digestion=DigestionSymptoms(),
        mood=MoodSymptoms(),
        pain=PainSymptoms(),
        sleep=SleepSymptoms(),
    )


def _health(hrv: HRVMetrics | None = None, resting_hr: float = 70.0) -> HealthData:
    return HealthData(
        session_id="test",
        hrv=hrv,
        resting_heart_rate=resting_hr,
    )


class TestScoreConstitutions:
    def test_returns_all_nine_types(self):
        scores = score_constitutions(_health(), _blank_questionnaire())
        assert len(scores) == 9
        assert {s.type for s in scores} == set(ConstitutionType)

    def test_scores_sorted_descending(self):
        scores = score_constitutions(_health(), _blank_questionnaire())
        values = [s.score for s in scores]
        assert values == sorted(values, reverse=True)

    def test_healthy_hrv_and_no_symptoms_defaults_to_balanced(self):
        hrv = HRVMetrics(sdnn=60.0, rmssd=40.0, lf_hf_ratio=1.8, pnn50=15.0, mean_rr=860.0)
        scores = score_constitutions(_health(hrv=hrv, resting_hr=62.0), _blank_questionnaire())
        assert scores[0].type == ConstitutionType.BALANCED

    def test_severe_fatigue_and_low_hrv_raises_qi_deficiency(self):
        hrv = HRVMetrics(sdnn=25.0, rmssd=15.0, lf_hf_ratio=1.2, pnn50=2.0, mean_rr=860.0)
        q = _blank_questionnaire()
        q.energy.fatigue = 3
        q.energy.spontaneous_sweating = 3
        scores = score_constitutions(_health(hrv=hrv), q)
        top = {s.type for s in scores[:3]}
        assert ConstitutionType.QI_DEFICIENCY in top

    def test_night_sweats_raises_yin_deficiency(self):
        q = _blank_questionnaire()
        q.energy.night_sweats = 3
        scores = score_constitutions(_health(), q)
        top = {s.type for s in scores[:2]}
        assert ConstitutionType.YIN_DEFICIENCY in top

    def test_cold_limbs_raises_yang_deficiency(self):
        q = _blank_questionnaire()
        q.energy.cold_limbs = 3
        scores = score_constitutions(_health(resting_hr=52), q)
        top = {s.type for s in scores[:2]}
        assert ConstitutionType.YANG_DEFICIENCY in top

    def test_fixed_pain_raises_blood_stasis(self):
        q = _blank_questionnaire()
        q.pain.fixed_pain_location = 3
        scores = score_constitutions(_health(), q)
        top = {s.type for s in scores[:3]}
        assert ConstitutionType.BLOOD_STASIS in top

    def test_sighing_raises_qi_stagnation(self):
        q = _blank_questionnaire()
        q.mood.sighing = 3
        q.mood.depression = 2
        scores = score_constitutions(_health(), q)
        top = {s.type for s in scores[:2]}
        assert ConstitutionType.QI_STAGNATION in top

    def test_severity_zero_does_not_contribute(self):
        q1 = _blank_questionnaire()
        q2 = _blank_questionnaire()
        q2.energy.fatigue = 0  # still zero
        s1 = score_constitutions(_health(), q1)
        s2 = score_constitutions(_health(), q2)
        assert [(x.type, x.score) for x in s1] == [(x.type, x.score) for x in s2]

    def test_confidence_scales_with_score(self):
        q = _blank_questionnaire()
        q.energy.fatigue = 3
        q.energy.spontaneous_sweating = 3
        q.digestion.loose_stools = 3
        scores = score_constitutions(
            _health(hrv=HRVMetrics(sdnn=22, rmssd=15, pnn50=2, lf_hf_ratio=1, mean_rr=860)),
            q,
        )
        assert scores[0].confidence in {"high", "medium"}
        assert scores[0].score > scores[-1].score
