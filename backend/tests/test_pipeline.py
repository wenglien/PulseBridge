"""Tests for the shared analysis context used by every analysis entry point."""
import gzip

import pytest

from api.routes.analysis import stream_analysis_sse
from api.routes.health_data import _XmlTooLarge, _gunzip_capped
from core.pipeline import prepare_analysis_context
from models.health_data import ECGReading, HealthData
from models.questionnaire import PainSymptoms, QuestionnaireResponse


def test_red_flags_reach_integrated_assessment():
    health = HealthData(
        session_id="t",
        ecg_readings=[ECGReading(timestamp="2026-01-01", classification="atrialFibrillation")],
    )
    q = QuestionnaireResponse(session_id="t", pain=PainSymptoms(chest_tightness=2))

    ctx = prepare_analysis_context(health, q)

    assert ctx.ecg_alerts[0].risk_level == "critical"
    assert ctx.integrated.cardiac_risk_level == "critical"
    assert ctx.integrated.follow_up_priority == "immediate"
    assert ctx.ecg_alerts[0].title_zh in ctx.integrated.red_flags


def test_empty_session_builds_context():
    ctx = prepare_analysis_context(HealthData(session_id="t"), QuestionnaireResponse(session_id="t"))
    assert ctx.ecg_alerts == []
    assert ctx.tcm_scores


def test_stream_route_uses_shared_pipeline():
    # Guards against the routes drifting back to a private copy of the logic.
    assert "prepare_analysis_context" in stream_analysis_sse.__code__.co_names


def test_gunzip_capped_roundtrip(tmp_path):
    src, dst = tmp_path / "a.xml.gz", tmp_path / "a.xml"
    src.write_bytes(gzip.compress(b"<HealthData/>"))
    _gunzip_capped(src, dst, max_bytes=1024)
    assert dst.read_bytes() == b"<HealthData/>"


def test_gunzip_capped_rejects_bomb(tmp_path):
    src, dst = tmp_path / "b.xml.gz", tmp_path / "b.xml"
    src.write_bytes(gzip.compress(b"0" * (3 * 1024 * 1024)))
    with pytest.raises(_XmlTooLarge):
        _gunzip_capped(src, dst, max_bytes=1024 * 1024)
