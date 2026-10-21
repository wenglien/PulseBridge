/** Questionnaire sections and symptom labels, shared by the form and the printed report. */
export const QUESTIONNAIRE_SECTIONS = [
  {
    id: "energy" as const,
    title: "能量與疲勞",
    description: "白天的精神、體力，以及冷熱與出汗",
    fields: [
      { key: "fatigue",              label: "疲勞感" },
      { key: "morning_grogginess",   label: "晨起昏沉" },
      { key: "afternoon_slump",      label: "午後低能" },
      { key: "cold_limbs",           label: "手腳冰冷" },
      { key: "spontaneous_sweating", label: "自汗（無故出汗）" },
      { key: "night_sweats",         label: "盜汗（夜間出汗）" },
    ],
  },
  {
    id: "digestion" as const,
    title: "消化系統",
    description: "胃口、腸胃與排便",
    fields: [
      { key: "bloating",            label: "腹脹" },
      { key: "loose_stools",        label: "大便稀溏" },
      { key: "constipation",        label: "便秘" },
      { key: "poor_appetite",       label: "食慾不振" },
      { key: "heartburn",           label: "胃酸逆流" },
      { key: "nausea_after_eating", label: "餐後噁心" },
    ],
  },
  {
    id: "mood" as const,
    title: "情緒狀態",
    description: "心情、壓力與專注",
    fields: [
      { key: "anxiety",      label: "焦慮" },
      { key: "irritability", label: "易怒" },
      { key: "depression",   label: "鬱悶" },
      { key: "mental_fog",   label: "思維不清" },
      { key: "sighing",      label: "常常嘆氣" },
    ],
  },
  {
    id: "pain" as const,
    title: "疼痛症狀",
    description: "身體哪裡痠、痛或悶",
    fields: [
      { key: "headache",            label: "頭痛" },
      { key: "chest_tightness",     label: "胸悶" },
      { key: "joint_pain",          label: "關節疼痛" },
      { key: "muscle_aches",        label: "肌肉痠痛" },
      { key: "fixed_pain_location", label: "固定部位疼痛" },
    ],
  },
  {
    id: "sleep" as const,
    title: "睡眠品質",
    description: "入睡、睡眠中與醒來時",
    fields: [
      { key: "difficulty_falling_asleep", label: "難以入睡" },
      { key: "frequent_waking",           label: "夜間多醒" },
      { key: "dream_disturbed",           label: "多夢紛擾" },
      { key: "early_morning_waking",      label: "早醒（過早醒來）" },
    ],
  },
]

export const SYMPTOM_LABELS: Record<string, string> = Object.fromEntries(
  QUESTIONNAIRE_SECTIONS.flatMap((s) => s.fields.map((f) => [f.key, f.label])),
)
