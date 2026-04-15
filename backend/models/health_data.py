from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ECGReading(BaseModel):
    timestamp: str
    average_heart_rate: float = 0.0
    classification: str = "notDetermined"
    voltage_measurements: list[float] = Field(default_factory=list)
    lead_type: str = "AppleWatchSimilarToLeadI"


class HRVMetrics(BaseModel):
    sdnn: float = 0.0
    rmssd: float = 0.0
    lf_power: float = 0.0
    hf_power: float = 0.0
    lf_hf_ratio: float = 0.0
    pnn50: float = 0.0
    mean_rr: float = 0.0
    rr_intervals: list[float] = Field(default_factory=list)
    timestamps: list[str] = Field(default_factory=list)


class SleepStage(BaseModel):
    start_date: str
    end_date: str
    stage: str
    duration_minutes: float


class SleepData(BaseModel):
    date: str
    total_sleep_minutes: float = 0.0
    deep_sleep_minutes: float = 0.0
    rem_sleep_minutes: float = 0.0
    core_sleep_minutes: float = 0.0
    awake_minutes: float = 0.0
    sleep_efficiency: float = 0.0
    stages: list[SleepStage] = Field(default_factory=list)


class HealthData(BaseModel):
    session_id: str
    uploaded_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    ecg_readings: list[ECGReading] = Field(default_factory=list)
    hrv: Optional[HRVMetrics] = None
    sleep: list[SleepData] = Field(default_factory=list)
    stress_level: float = 0.0
    resting_heart_rate: float = 0.0
    active_energy_burned: float = 0.0
    step_count: int = 0


class ExtractRequest(BaseModel):
    session_id: str
    start_date: str          # "YYYY-MM-DD"
    end_date: str            # "YYYY-MM-DD"
    data_types: list[str]    # subset of xml_stream_parser.DATA_TYPE_MAP keys + "ecg"


class ManualHealthInput(BaseModel):
    session_id: Optional[str] = None
    resting_heart_rate: float = 0.0
    sdnn: float = 0.0
    rmssd: float = 0.0
    lf_hf_ratio: float = 0.0
    stress_level: float = 0.0
    sleep_hours: float = 0.0
    deep_sleep_pct: float = 0.0
    rem_sleep_pct: float = 0.0
    sleep_efficiency: float = 0.0
