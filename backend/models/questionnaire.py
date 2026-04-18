from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal

SymptomSeverity = Literal[0, 1, 2, 3]


class EnergySymptoms(BaseModel):
    fatigue: SymptomSeverity = 0
    morning_grogginess: SymptomSeverity = 0
    afternoon_slump: SymptomSeverity = 0
    cold_limbs: SymptomSeverity = 0
    spontaneous_sweating: SymptomSeverity = 0
    night_sweats: SymptomSeverity = 0


class DigestionSymptoms(BaseModel):
    bloating: SymptomSeverity = 0
    loose_stools: SymptomSeverity = 0
    constipation: SymptomSeverity = 0
    poor_appetite: SymptomSeverity = 0
    heartburn: SymptomSeverity = 0
    nausea_after_eating: SymptomSeverity = 0


class MoodSymptoms(BaseModel):
    anxiety: SymptomSeverity = 0
    irritability: SymptomSeverity = 0
    depression: SymptomSeverity = 0
    mental_fog: SymptomSeverity = 0
    sighing: SymptomSeverity = 0


class PainSymptoms(BaseModel):
    headache: SymptomSeverity = 0
    chest_tightness: SymptomSeverity = 0
    joint_pain: SymptomSeverity = 0
    muscle_aches: SymptomSeverity = 0
    fixed_pain_location: SymptomSeverity = 0


class SleepSymptoms(BaseModel):
    difficulty_falling_asleep: SymptomSeverity = 0
    frequent_waking: SymptomSeverity = 0
    dream_disturbed: SymptomSeverity = 0
    early_morning_waking: SymptomSeverity = 0


class QuestionnaireResponse(BaseModel):
    session_id: str
    submitted_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    energy: EnergySymptoms = Field(default_factory=EnergySymptoms)
    digestion: DigestionSymptoms = Field(default_factory=DigestionSymptoms)
    mood: MoodSymptoms = Field(default_factory=MoodSymptoms)
    pain: PainSymptoms = Field(default_factory=PainSymptoms)
    sleep: SleepSymptoms = Field(default_factory=SleepSymptoms)
    additional_notes: str = ""
    # Optional ZYYXH/T157-2009 王琦 60-item scale answers (item_id → 1–5).
    # When present, the formal transformed-score scorer overrides symptom-based scoring.
    wangqi_answers: dict[str, int] = Field(default_factory=dict)
