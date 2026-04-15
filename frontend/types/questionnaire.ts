export type SymptomSeverity = 0 | 1 | 2 | 3

export interface EnergySymptoms {
  fatigue: SymptomSeverity
  morning_grogginess: SymptomSeverity
  afternoon_slump: SymptomSeverity
  cold_limbs: SymptomSeverity
  spontaneous_sweating: SymptomSeverity
  night_sweats: SymptomSeverity
}

export interface DigestionSymptoms {
  bloating: SymptomSeverity
  loose_stools: SymptomSeverity
  constipation: SymptomSeverity
  poor_appetite: SymptomSeverity
  heartburn: SymptomSeverity
  nausea_after_eating: SymptomSeverity
}

export interface MoodSymptoms {
  anxiety: SymptomSeverity
  irritability: SymptomSeverity
  depression: SymptomSeverity
  mental_fog: SymptomSeverity
  sighing: SymptomSeverity
}

export interface PainSymptoms {
  headache: SymptomSeverity
  chest_tightness: SymptomSeverity
  joint_pain: SymptomSeverity
  muscle_aches: SymptomSeverity
  fixed_pain_location: SymptomSeverity
}

export interface SleepSymptoms {
  difficulty_falling_asleep: SymptomSeverity
  frequent_waking: SymptomSeverity
  dream_disturbed: SymptomSeverity
  early_morning_waking: SymptomSeverity
}

export interface QuestionnaireResponse {
  session_id: string
  submitted_at?: string
  energy: EnergySymptoms
  digestion: DigestionSymptoms
  mood: MoodSymptoms
  pain: PainSymptoms
  sleep: SleepSymptoms
  additional_notes: string
}

export const EMPTY_QUESTIONNAIRE: Omit<QuestionnaireResponse, 'session_id'> = {
  energy: { fatigue: 0, morning_grogginess: 0, afternoon_slump: 0, cold_limbs: 0, spontaneous_sweating: 0, night_sweats: 0 },
  digestion: { bloating: 0, loose_stools: 0, constipation: 0, poor_appetite: 0, heartburn: 0, nausea_after_eating: 0 },
  mood: { anxiety: 0, irritability: 0, depression: 0, mental_fog: 0, sighing: 0 },
  pain: { headache: 0, chest_tightness: 0, joint_pain: 0, muscle_aches: 0, fixed_pain_location: 0 },
  sleep: { difficulty_falling_asleep: 0, frequent_waking: 0, dream_disturbed: 0, early_morning_waking: 0 },
  additional_notes: '',
}
