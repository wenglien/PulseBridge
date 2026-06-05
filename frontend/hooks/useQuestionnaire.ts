"use client"
import { useState, useCallback } from "react"
import { api } from "@/lib/api"
import type { QuestionnaireResponse, SymptomSeverity } from "@/types/questionnaire"
import { EMPTY_QUESTIONNAIRE } from "@/types/questionnaire"

type QuestionnaireDraft = Omit<QuestionnaireResponse, "session_id">
type SymptomCategory = keyof Omit<QuestionnaireResponse, "session_id" | "submitted_at" | "additional_notes">

const KEYWORD_RULES: Array<{
  category: SymptomCategory
  field: string
  keywords: string[]
}> = [
  { category: "energy", field: "fatigue", keywords: ["疲勞", "疲累", "很累", "沒力", "無力", "倦怠", "提不起勁"] },
  { category: "energy", field: "morning_grogginess", keywords: ["晨起", "早上起床", "起床昏", "睡醒很累", "醒來很累"] },
  { category: "energy", field: "afternoon_slump", keywords: ["午後", "下午沒精神", "下午很累", "飯後想睡"] },
  { category: "energy", field: "cold_limbs", keywords: ["手腳冰冷", "怕冷", "畏寒", "四肢冷", "腳冷", "手冷"] },
  { category: "energy", field: "spontaneous_sweating", keywords: ["自汗", "容易流汗", "沒動也流汗", "冒汗"] },
  { category: "energy", field: "night_sweats", keywords: ["盜汗", "夜汗", "睡覺流汗", "半夜流汗"] },

  { category: "digestion", field: "bloating", keywords: ["腹脹", "脹氣", "肚子脹", "胃脹"] },
  { category: "digestion", field: "loose_stools", keywords: ["拉肚子", "腹瀉", "大便稀", "軟便", "稀便"] },
  { category: "digestion", field: "constipation", keywords: ["便秘", "排便困難", "大便乾", "解不出來"] },
  { category: "digestion", field: "poor_appetite", keywords: ["食慾差", "沒胃口", "不想吃", "食慾不振"] },
  { category: "digestion", field: "heartburn", keywords: ["胃酸", "火燒心", "逆流", "胃食道逆流", "胸口灼熱"] },
  { category: "digestion", field: "nausea_after_eating", keywords: ["噁心", "反胃", "想吐", "飯後不舒服"] },

  { category: "mood", field: "anxiety", keywords: ["焦慮", "緊張", "心慌", "恐慌", "坐立不安"] },
  { category: "mood", field: "irritability", keywords: ["易怒", "煩躁", "暴躁", "很煩", "火氣大"] },
  { category: "mood", field: "depression", keywords: ["憂鬱", "低落", "鬱悶", "沒興趣", "心情差"] },
  { category: "mood", field: "mental_fog", keywords: ["腦霧", "注意力差", "思緒不清", "反應慢", "記憶差"] },
  { category: "mood", field: "sighing", keywords: ["嘆氣", "常嘆氣", "胸口悶想嘆氣"] },

  { category: "pain", field: "headache", keywords: ["頭痛", "偏頭痛", "頭暈", "頭脹"] },
  { category: "pain", field: "chest_tightness", keywords: ["胸悶", "胸痛", "心悸", "心慌", "喘", "呼吸不順"] },
  { category: "pain", field: "joint_pain", keywords: ["關節痛", "膝蓋痛", "肩膀痛", "關節痠"] },
  { category: "pain", field: "muscle_aches", keywords: ["肌肉痠", "痠痛", "背痛", "腰痠", "肩頸痠"] },
  { category: "pain", field: "fixed_pain_location", keywords: ["固定痛", "同一個地方痛", "刺痛", "固定部位"] },

  { category: "sleep", field: "difficulty_falling_asleep", keywords: ["失眠", "睡不著", "難入睡", "入睡困難"] },
  { category: "sleep", field: "frequent_waking", keywords: ["淺眠", "半夜醒", "一直醒", "多醒", "睡眠中斷"] },
  { category: "sleep", field: "dream_disturbed", keywords: ["多夢", "做夢", "夢很多", "惡夢"] },
  { category: "sleep", field: "early_morning_waking", keywords: ["早醒", "太早醒", "凌晨醒", "清晨醒"] },
]

function inferSeverity(text: string): SymptomSeverity {
  if (/(非常|很嚴重|嚴重|劇烈|受不了|明顯|每天|整天|一直|持續)/.test(text)) return 3
  if (/(中等|常常|經常|反覆|最近|好幾天|幾乎)/.test(text)) return 2
  if (/(輕微|偶爾|一點|有點|稍微)/.test(text)) return 1
  return 2
}

function inferQuestionnaireFromText(data: QuestionnaireDraft): QuestionnaireDraft {
  const text = data.additional_notes.trim()
  if (!text) return data

  const severity = inferSeverity(text)
  const inferred: QuestionnaireDraft = {
    ...EMPTY_QUESTIONNAIRE,
    additional_notes: data.additional_notes,
  }

  for (const rule of KEYWORD_RULES) {
    if (!rule.keywords.some((keyword) => text.includes(keyword))) continue
    const categoryData = inferred[rule.category] as unknown as Record<string, SymptomSeverity>
    categoryData[rule.field] = Math.max(categoryData[rule.field] ?? 0, severity) as SymptomSeverity
  }

  return inferred
}

export function useQuestionnaire(sessionId: string) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<QuestionnaireDraft>({
    ...EMPTY_QUESTIONNAIRE,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setSeverity = useCallback(
    (
      category: keyof Omit<QuestionnaireResponse, "session_id" | "submitted_at" | "additional_notes">,
      field: string,
      value: SymptomSeverity,
    ) => {
      setData((prev) => ({
        ...prev,
        [category]: { ...(prev[category] as object), [field]: value },
      }))
    },
    [],
  )

  const setNotes = useCallback((notes: string) => {
    setData((prev) => ({ ...prev, additional_notes: notes }))
  }, [])

  const submit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload = inferQuestionnaireFromText(data)
      await api.submitQuestionnaire({ ...payload, session_id: sessionId })
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失敗")
    } finally {
      setSubmitting(false)
    }
  }, [data, sessionId])

  return {
    step, setStep,
    data, setSeverity, setNotes,
    submitting, submitted, error, submit,
  }
}
