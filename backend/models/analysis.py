from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from enum import Enum


class ConstitutionType(str, Enum):
    BALANCED = "平和質"
    QI_DEFICIENCY = "氣虛質"
    YANG_DEFICIENCY = "陽虛質"
    YIN_DEFICIENCY = "陰虛質"
    PHLEGM_DAMP = "痰濕質"
    DAMP_HEAT = "濕熱質"
    BLOOD_STASIS = "血瘀質"
    QI_STAGNATION = "氣鬱質"
    SPECIAL = "特稟質"


RiskLevel = Literal["low", "medium", "high", "critical"]


class ConstitutionScore(BaseModel):
    type: ConstitutionType
    score: float
    confidence: Literal["low", "medium", "high"] = "medium"
    key_indicators: list[str] = Field(default_factory=list)


class RiskAlert(BaseModel):
    id: str
    category: Literal["cardiac", "autonomic", "sleep", "metabolic"]
    risk_level: RiskLevel
    title_zh: str
    title_en: str
    description_zh: str
    recommendation: str
    trigger_values: dict = Field(default_factory=dict)


class HealthRecommendation(BaseModel):
    category: Literal["diet", "lifestyle", "exercise", "tcm_herbs", "acupressure", "emotional"]
    title_zh: str
    content_zh: str
    priority: Literal["high", "medium", "low"] = "medium"
    evidence_basis: Literal["tcm", "western", "integrative"] = "integrative"
    citations: list[str] = Field(default_factory=list)


class WesternFlags(BaseModel):
    afib_detected: bool = False
    hrv_concern: bool = False
    sleep_apnea_risk: bool = False
    autonomic_imbalance: bool = False
    bradycardia: bool = False
    tachycardia: bool = False


class ExecutiveSummary(BaseModel):
    headline_zh: str = ""
    overall_risk_level: RiskLevel = "low"
    key_findings: list[str] = Field(default_factory=list)


class ECGSignalQuality(BaseModel):
    total_readings: int = 0
    usable_readings: int = 0
    inconclusive_readings: int = 0
    quality_score: float = 0.0


class ECGRhythmSummary(BaseModel):
    dominant_rhythm: str = ""
    classification_distribution: dict[str, int] = Field(default_factory=dict)
    afib_detected: bool = False
    afib_burden_pct: float = 0.0


class ECGHeartRateProfile(BaseModel):
    mean_hr_bpm: float = 0.0
    median_hr_bpm: float = 0.0
    min_hr_bpm: float = 0.0
    max_hr_bpm: float = 0.0
    hr_variability_across_ecg: float = 0.0


class ECGWaveformFindings(BaseModel):
    st_deviation_detected: bool = False
    st_abnormal_readings: int = 0
    st_deviation_max_uv: float = 0.0


class ECGRiskAssessment(BaseModel):
    risk_level: RiskLevel = "low"
    confidence: Literal["low", "medium", "high"] = "medium"
    evidence: list[str] = Field(default_factory=list)


class ECGAnalysis(BaseModel):
    signal_quality: ECGSignalQuality = Field(default_factory=ECGSignalQuality)
    rhythm_summary: ECGRhythmSummary = Field(default_factory=ECGRhythmSummary)
    heart_rate_profile: ECGHeartRateProfile = Field(default_factory=ECGHeartRateProfile)
    waveform_findings: ECGWaveformFindings = Field(default_factory=ECGWaveformFindings)
    ecg_risk_assessment: ECGRiskAssessment = Field(default_factory=ECGRiskAssessment)


class HRVTimeDomain(BaseModel):
    sdnn_ms: float = 0.0
    rmssd_ms: float = 0.0
    pnn50_pct: float = 0.0
    mean_rr_ms: float = 0.0


class HRVFrequencyDomain(BaseModel):
    lf_power: float = 0.0
    hf_power: float = 0.0
    lf_hf_ratio: float = 0.0


class HRVAutonomicBalance(BaseModel):
    sympathetic_dominance: bool = False
    parasympathetic_activity: Literal["low", "normal", "high"] = "normal"
    overall_recovery_state: Literal["poor", "fair", "good"] = "fair"


class HRVRiskAssessment(BaseModel):
    risk_level: RiskLevel = "low"
    confidence: Literal["low", "medium", "high"] = "medium"
    evidence: list[str] = Field(default_factory=list)


class HRVReferenceRange(BaseModel):
    age_bracket: str = "adult (age unknown)"
    sdnn_p25: float = 0.0
    sdnn_p50: float = 0.0
    sdnn_p75: float = 0.0
    rmssd_p25: float = 0.0
    rmssd_p50: float = 0.0
    rmssd_p75: float = 0.0
    lf_hf_normal_low: float = 1.0
    lf_hf_normal_high: float = 2.5
    sdnn_percentile: Optional[int] = None
    rmssd_percentile: Optional[int] = None
    sources: list[str] = Field(default_factory=list)
    confidence: Literal["low", "medium", "high"] = "medium"


class HRVAnalysis(BaseModel):
    time_domain: HRVTimeDomain = Field(default_factory=HRVTimeDomain)
    frequency_domain: HRVFrequencyDomain = Field(default_factory=HRVFrequencyDomain)
    autonomic_balance: HRVAutonomicBalance = Field(default_factory=HRVAutonomicBalance)
    hrv_risk_assessment: HRVRiskAssessment = Field(default_factory=HRVRiskAssessment)
    reference_range: Optional[HRVReferenceRange] = None


class IntegratedCardiacAssessment(BaseModel):
    primary_conclusion_zh: str = ""
    cardiac_risk_level: RiskLevel = "low"
    red_flags: list[str] = Field(default_factory=list)
    follow_up_priority: Literal["immediate", "1_week", "2_weeks", "routine"] = "routine"


class DataDrivenRecommendation(BaseModel):
    domain: Literal["ecg", "hrv", "recovery", "lifestyle", "follow_up"] = "lifestyle"
    priority: Literal["high", "medium", "low"] = "medium"
    title_zh: str
    why_zh: str
    target_metric: str = ""
    actions: list[str] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)


class MetricExplanation(BaseModel):
    metric_key: str
    metric_label_zh: str
    current_value: str
    interpretation_zh: str
    clinical_meaning_zh: str
    improvement_goal_zh: str
    actionable_steps: list[str] = Field(default_factory=list)
    priority: Literal["high", "medium", "low"] = "medium"
    citations: list[str] = Field(default_factory=list)


class AnalysisResult(BaseModel):
    session_id: str
    analyzed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    executive_summary: ExecutiveSummary = Field(default_factory=ExecutiveSummary)
    ecg_analysis: ECGAnalysis = Field(default_factory=ECGAnalysis)
    hrv_analysis: HRVAnalysis = Field(default_factory=HRVAnalysis)
    integrated_cardiac_assessment: IntegratedCardiacAssessment = Field(default_factory=IntegratedCardiacAssessment)
    data_driven_recommendations: list[DataDrivenRecommendation] = Field(default_factory=list)
    metric_explanations: list[MetricExplanation] = Field(default_factory=list)
    primary_constitution: ConstitutionType = ConstitutionType.BALANCED
    secondary_constitution: Optional[ConstitutionType] = None
    constitution_scores: list[ConstitutionScore] = Field(default_factory=list)
    risk_alerts: list[RiskAlert] = Field(default_factory=list)
    recommendations: list[HealthRecommendation] = Field(default_factory=list)
    claude_summary_zh: str = ""
    claude_summary_en: str = ""
    western_flags: WesternFlags = Field(default_factory=WesternFlags)
    references: dict[str, str] = Field(default_factory=dict)
    raw_claude_response: str = ""
    status: Literal["pending", "analyzing", "completed", "error"] = "pending"
    error_message: str = ""
