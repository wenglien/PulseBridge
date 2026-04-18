"""Tests for the red-flag guardrail."""
from core.red_flags import detect_red_flags
from models.health_data import ECGReading, HRVMetrics
from models.questionnaire import PainSymptoms, QuestionnaireResponse


def _questionnaire(**pain_kwargs) -> QuestionnaireResponse:
    return QuestionnaireResponse(
        session_id="test",
        pain=PainSymptoms(**pain_kwargs),
    )


class TestDetectRedFlags:
    def test_no_symptoms_no_alerts(self):
        alerts = detect_red_flags(_questionnaire(), None, [])
        assert alerts == []

    def test_mild_chest_tightness_no_alert(self):
        alerts = detect_red_flags(
            _questionnaire(chest_tightness=1), None, []
        )
        assert alerts == []

    def test_chest_plus_afib_is_critical(self):
        ecg = [ECGReading(timestamp="2026-01-01", classification="atrialFibrillation")]
        alerts = detect_red_flags(_questionnaire(chest_tightness=2), None, ecg)
        assert len(alerts) == 1
        assert alerts[0].risk_level == "critical"
        assert "心房顫動" in alerts[0].title_zh

    def test_chest_plus_severely_low_hrv_is_critical(self):
        hrv = HRVMetrics(sdnn=12.0, rmssd=10.0)
        alerts = detect_red_flags(_questionnaire(chest_tightness=3), hrv, [])
        assert len(alerts) == 1
        assert alerts[0].risk_level == "critical"
        assert "SDNN" in alerts[0].description_zh or "自主神經" in alerts[0].description_zh

    def test_severe_chest_plus_inconclusive_ecgs(self):
        ecg = [
            ECGReading(timestamp="1", classification="inconclusiveLowHeartRate"),
            ECGReading(timestamp="2", classification="inconclusivePoorReading"),
        ]
        alerts = detect_red_flags(_questionnaire(chest_tightness=3), None, ecg)
        assert len(alerts) == 1
        assert alerts[0].risk_level in {"high", "critical"}

    def test_none_questionnaire_returns_empty(self):
        assert detect_red_flags(None, None, []) == []

    def test_afib_takes_precedence_over_low_hrv(self):
        ecg = [ECGReading(timestamp="1", classification="atrialFibrillation")]
        hrv = HRVMetrics(sdnn=10.0)
        alerts = detect_red_flags(_questionnaire(chest_tightness=2), hrv, ecg)
        assert len(alerts) == 1
        assert "心房顫動" in alerts[0].title_zh
