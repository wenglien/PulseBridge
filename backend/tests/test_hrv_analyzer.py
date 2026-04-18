"""Tests for HRV metric computation and reference-range mapping."""
from __future__ import annotations

import math

import numpy as np
import pytest

from core.hrv_analyzer import compute_hrv_metrics, hrv_from_sdnn_records
from core.hrv_reference import get_reference, percentile_rank
from core.ecg_analyzer import summarize_hrv
from models.health_data import HRVMetrics


def _synth_rr(mean_rr_ms: float, jitter_ms: float, n: int, seed: int = 0) -> list[float]:
    rng = np.random.default_rng(seed)
    return list(rng.normal(mean_rr_ms, jitter_ms, size=n))


class TestComputeHRVMetrics:
    def test_returns_none_for_too_few_beats(self):
        assert compute_hrv_metrics([800.0] * 10) is None

    def test_healthy_rr_produces_expected_sdnn(self):
        # 70 bpm with ~40ms jitter → SDNN should be roughly 40ms.
        rr = _synth_rr(857, 40, 120)
        result = compute_hrv_metrics(rr)

        assert result is not None
        assert 25 < result["sdnn"] < 60
        assert result["rmssd"] > 0
        assert 750 < result["mean_rr"] < 950
        assert 0 <= result["pnn50"] <= 100

    def test_low_variability_produces_low_sdnn(self):
        # Constant RR → SDNN ~ 0
        result = compute_hrv_metrics([800.0] * 100)
        assert result is not None
        assert result["sdnn"] < 1.0
        assert result["rmssd"] < 1.0
        # pNN50 must still be a float, not NaN.
        assert math.isfinite(result["pnn50"])

    def test_lf_hf_ratio_is_finite(self):
        rr = _synth_rr(800, 50, 300, seed=42)
        result = compute_hrv_metrics(rr)
        assert result is not None
        assert result["lf_hf_ratio"] > 0
        assert math.isfinite(result["lf_hf_ratio"])


class TestHRVFromSDNNRecords:
    def test_empty_returns_none(self):
        assert hrv_from_sdnn_records([]) is None
        assert hrv_from_sdnn_records([{"value_ms": 0}]) is None

    def test_averages_values(self):
        records = [{"value_ms": 40}, {"value_ms": 60}, {"value_ms": 50}]
        result = hrv_from_sdnn_records(records)
        assert result is not None
        assert result["sdnn"] == pytest.approx(50.0, abs=0.5)


class TestHRVReference:
    def test_reference_for_known_age_uses_bracket(self):
        ref = get_reference(35)
        assert ref["age_bracket"] == "30-39"
        assert ref["sdnn_p25"] < ref["sdnn_p50"] < ref["sdnn_p75"]
        assert ref["confidence"] == "high"

    def test_reference_for_unknown_age_falls_back(self):
        ref = get_reference(None)
        assert "unknown" in ref["age_bracket"]
        assert ref["confidence"] == "medium"

    def test_older_bracket_has_lower_sdnn_than_younger(self):
        young = get_reference(25)
        old = get_reference(75)
        assert old["sdnn_p50"] < young["sdnn_p50"]
        assert old["rmssd_p50"] < young["rmssd_p50"]

    def test_percentile_rank_monotonic(self):
        assert percentile_rank(20, 50, 16) < percentile_rank(50, 50, 16)
        assert percentile_rank(50, 50, 16) == pytest.approx(50, abs=1)
        assert percentile_rank(80, 50, 16) > percentile_rank(50, 50, 16)


class TestSummarizeHRV:
    def test_none_hrv_returns_low_confidence_summary(self):
        summary = summarize_hrv(None, [])
        assert summary.hrv_risk_assessment.confidence == "low"
        assert summary.reference_range is not None

    def test_healthy_hrv_low_risk(self):
        hrv = HRVMetrics(sdnn=55.0, rmssd=40.0, lf_hf_ratio=1.5, pnn50=15.0, mean_rr=900.0)
        summary = summarize_hrv(hrv, [], age=30)
        assert summary.hrv_risk_assessment.risk_level == "low"
        assert summary.reference_range is not None
        assert summary.reference_range.age_bracket == "30-39"
        assert summary.reference_range.sdnn_percentile is not None
        assert summary.autonomic_balance.overall_recovery_state == "good"

    def test_critical_sdnn_flagged(self):
        hrv = HRVMetrics(sdnn=10.0, rmssd=8.0, lf_hf_ratio=1.0, pnn50=0.5, mean_rr=700.0)
        summary = summarize_hrv(hrv, [], age=45)
        assert summary.hrv_risk_assessment.risk_level == "critical"
        assert summary.autonomic_balance.overall_recovery_state == "poor"

    def test_sympathetic_dominance_detected(self):
        hrv = HRVMetrics(sdnn=40.0, rmssd=20.0, lf_hf_ratio=6.0, pnn50=4.0, mean_rr=750.0)
        summary = summarize_hrv(hrv, [], age=40)
        assert summary.autonomic_balance.sympathetic_dominance is True
