export type ConstitutionType =
  | "平和質" | "氣虛質" | "陽虛質" | "陰虛質"
  | "痰濕質" | "濕熱質" | "血瘀質" | "氣鬱質" | "特稟質"

export type RiskLevel = "low" | "medium" | "high" | "critical"

export interface ConstitutionScore {
  type: ConstitutionType
  score: number
  confidence: "low" | "medium" | "high"
  key_indicators: string[]
}

export interface RiskAlert {
  id: string
  category: "cardiac" | "autonomic" | "sleep" | "metabolic"
  risk_level: RiskLevel
  title_zh: string
  title_en: string
  description_zh: string
  recommendation: string
  trigger_values: Record<string, number | string>
}

export interface HealthRecommendation {
  category: "diet" | "lifestyle" | "exercise" | "tcm_herbs" | "acupressure" | "emotional"
  title_zh: string
  content_zh: string
  priority: "high" | "medium" | "low"
  evidence_basis: "tcm" | "western" | "integrative"
}

export interface WesternFlags {
  afib_detected: boolean
  hrv_concern: boolean
  sleep_apnea_risk: boolean
  autonomic_imbalance: boolean
  bradycardia: boolean
  tachycardia: boolean
}

export interface ExecutiveSummary {
  headline_zh: string
  overall_risk_level: RiskLevel
  key_findings: string[]
}

export interface ECGSignalQuality {
  total_readings: number
  usable_readings: number
  inconclusive_readings: number
  quality_score: number
}

export interface ECGRhythmSummary {
  dominant_rhythm: string
  classification_distribution: Record<string, number>
  afib_detected: boolean
  afib_burden_pct: number
}

export interface ECGHeartRateProfile {
  mean_hr_bpm: number
  median_hr_bpm: number
  min_hr_bpm: number
  max_hr_bpm: number
  hr_variability_across_ecg: number
}

export interface ECGWaveformFindings {
  st_deviation_detected: boolean
  st_abnormal_readings: number
  st_deviation_max_uv: number
}

export interface ECGRiskAssessment {
  risk_level: RiskLevel
  confidence: "low" | "medium" | "high"
  evidence: string[]
}

export interface ECGAnalysis {
  signal_quality: ECGSignalQuality
  rhythm_summary: ECGRhythmSummary
  heart_rate_profile: ECGHeartRateProfile
  waveform_findings: ECGWaveformFindings
  ecg_risk_assessment: ECGRiskAssessment
}

export interface HRVTimeDomain {
  sdnn_ms: number
  rmssd_ms: number
  pnn50_pct: number
  mean_rr_ms: number
}

export interface HRVFrequencyDomain {
  lf_power: number
  hf_power: number
  lf_hf_ratio: number
}

export interface HRVAutonomicBalance {
  sympathetic_dominance: boolean
  parasympathetic_activity: "low" | "normal" | "high"
  overall_recovery_state: "poor" | "fair" | "good"
}

export interface HRVRiskAssessment {
  risk_level: RiskLevel
  confidence: "low" | "medium" | "high"
  evidence: string[]
}

export interface HRVAnalysis {
  time_domain: HRVTimeDomain
  frequency_domain: HRVFrequencyDomain
  autonomic_balance: HRVAutonomicBalance
  hrv_risk_assessment: HRVRiskAssessment
}

export interface IntegratedCardiacAssessment {
  primary_conclusion_zh: string
  cardiac_risk_level: RiskLevel
  red_flags: string[]
  follow_up_priority: "immediate" | "1_week" | "2_weeks" | "routine"
}

export interface DataDrivenRecommendation {
  domain: "ecg" | "hrv" | "recovery" | "lifestyle" | "follow_up"
  priority: "high" | "medium" | "low"
  title_zh: string
  why_zh: string
  target_metric: string
  actions: string[]
}

export interface MetricExplanation {
  metric_key: string
  metric_label_zh: string
  current_value: string
  interpretation_zh: string
  clinical_meaning_zh: string
  improvement_goal_zh: string
  actionable_steps: string[]
  priority: "high" | "medium" | "low"
}

export interface AnalysisResult {
  session_id: string
  analyzed_at: string
  executive_summary: ExecutiveSummary
  ecg_analysis: ECGAnalysis
  hrv_analysis: HRVAnalysis
  integrated_cardiac_assessment: IntegratedCardiacAssessment
  data_driven_recommendations: DataDrivenRecommendation[]
  metric_explanations: MetricExplanation[]
  primary_constitution: ConstitutionType
  secondary_constitution: ConstitutionType | null
  constitution_scores: ConstitutionScore[]
  risk_alerts: RiskAlert[]
  recommendations: HealthRecommendation[]
  claude_summary_zh: string
  claude_summary_en: string
  western_flags: WesternFlags
  raw_claude_response: string
  status: "pending" | "analyzing" | "completed" | "error"
  error_message?: string
}

export interface Session {
  session_id: string
  created_at: string
  updated_at: string
  status: string
  primary_constitution: string
}
