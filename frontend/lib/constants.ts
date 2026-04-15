import type { ConstitutionType } from "@/types/analysis"

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export const ALL_CONSTITUTION_TYPES: ConstitutionType[] = [
  "平和質", "氣虛質", "陽虛質", "陰虛質",
  "痰濕質", "濕熱質", "血瘀質", "氣鬱質", "特稟質",
]

export const QUESTIONNAIRE_STEPS = [
  { id: "energy", label: "能量與疲勞" },
  { id: "digestion", label: "消化系統" },
  { id: "mood", label: "情緒狀態" },
  { id: "pain", label: "疼痛症狀" },
  { id: "sleep", label: "睡眠品質" },
]

export const ECG_CLASSIFICATION_LABELS: Record<string, string> = {
  sinusRhythm: "竇性心律（正常）",
  atrialFibrillation: "心房顫動（異常）",
  inconclusiveLowHeartRate: "不確定（心率過低）",
  inconclusiveHighHeartRate: "不確定（心率過高）",
  inconclusivePoorReading: "不確定（讀取不良）",
  notDetermined: "未判定",
}

export const RECOMMENDATION_CATEGORIES = [
  "diet", "lifestyle", "exercise", "tcm_herbs", "acupressure", "emotional"
] as const
