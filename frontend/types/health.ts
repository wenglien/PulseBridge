export interface ECGReading {
  timestamp: string
  average_heart_rate: number
  classification: string
  voltage_measurements: number[]
  lead_type: string
}

export interface HRVMetrics {
  sdnn: number
  rmssd: number
  lf_power: number
  hf_power: number
  lf_hf_ratio: number
  pnn50: number
  mean_rr: number
  rr_intervals: number[]
  timestamps: string[]
}

export interface SleepStage {
  start_date: string
  end_date: string
  stage: "inBed" | "awake" | "asleep" | "core" | "deep" | "rem" | "unknown"
  duration_minutes: number
}

export interface SleepData {
  date: string
  total_sleep_minutes: number
  deep_sleep_minutes: number
  rem_sleep_minutes: number
  core_sleep_minutes: number
  awake_minutes: number
  sleep_efficiency: number
  stages: SleepStage[]
}

export interface HealthData {
  session_id: string
  uploaded_at: string
  ecg_readings: ECGReading[]
  hrv: HRVMetrics | null
  sleep: SleepData[]
  stress_level: number
  resting_heart_rate: number
  active_energy_burned: number
  step_count: number
}

export interface ManualHealthInput {
  session_id?: string
  resting_heart_rate: number
  sdnn: number
  rmssd: number
  lf_hf_ratio: number
  stress_level: number
  sleep_hours: number
  deep_sleep_pct: number
  rem_sleep_pct: number
  sleep_efficiency: number
}
