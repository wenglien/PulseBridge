"use client"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { v4 as uuidv4 } from "uuid"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { StepIndicator } from "@/components/questionnaire/StepIndicator"
import { SymptomTag } from "@/components/questionnaire/SymptomTag"
import { SymptomRadarChart } from "@/components/charts/SymptomRadarChart"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/FadeIn"
import { useQuestionnaire } from "@/hooks/useQuestionnaire"
import type { SymptomSeverity } from "@/types/questionnaire"

const STEPS = [
  {
    id: "energy" as const,
    title: "能量與疲勞",
    description: "評估您的體力與能量狀態",
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
    description: "腸胃與消化相關症狀",
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
    description: "精神與情緒表現",
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
    description: "身體各部位疼痛或不適",
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
    description: "入睡及睡眠維持狀況",
    fields: [
      { key: "difficulty_falling_asleep", label: "難以入睡" },
      { key: "frequent_waking",           label: "夜間多醒" },
      { key: "dream_disturbed",           label: "多夢紛擾" },
      { key: "early_morning_waking",      label: "早醒（過早醒來）" },
    ],
  },
]

function QuestionnaireContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionParam = searchParams.get("session")
  const [sessionId] = useState(() => sessionParam ?? `pb_manual_${uuidv4().slice(0, 8)}`)

  const { step, setStep, data, setSeverity, setNotes, submitting, submitted, error, submit } = useQuestionnaire(sessionId)

  useEffect(() => {
    if (submitted) router.push(`/analysis?session=${sessionId}`)
  }, [submitted, sessionId, router])

  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1

  // Total active symptoms count
  const totalActive = STEPS.flatMap((s) =>
    s.fields.map((f) => (data[s.id] as unknown as Record<string, number>)[f.key] ?? 0),
  ).filter((v) => v > 0).length

  return (
    <PageWrapper maxWidth="lg">
      <div className="space-y-6">
        {/* Header */}
        <FadeIn delay={0.05}>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">症狀問卷</h1>
            <p className="text-gray-500 text-sm">
              點擊症狀標籤循環選擇嚴重程度（無 → 輕微 → 中等 → 嚴重）
            </p>
            {totalActive > 0 && (
              <span className="inline-block text-xs px-3 py-1 bg-[#E8F5F2] text-[#0D7A66] rounded-full font-semibold border border-[#9FD1C8]">
                已選 {totalActive} 項症狀
              </span>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.12}>
          <StepIndicator currentStep={step} />
        </FadeIn>

        {/* Main 2-col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Current step form */}
          <FadeIn delay={0.18} className="lg:col-span-3 space-y-4">
            <Card className="space-y-5">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-lg font-semibold text-gray-900">{currentStep.title}</h2>
                <p className="text-sm text-gray-400 mt-0.5">{currentStep.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentStep.fields.map((field) => {
                  const catData = data[currentStep.id] as unknown as Record<string, SymptomSeverity>
                  return (
                    <SymptomTag
                      key={field.key}
                      label={field.label}
                      value={catData[field.key] as SymptomSeverity ?? 0}
                      onChange={(v) => setSeverity(currentStep.id, field.key, v)}
                    />
                  )
                })}
              </div>

              {/* Notes on last step */}
              {isLast && (
                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-sm text-gray-500 mb-2">其他備註（可選）</label>
                  <textarea
                    value={data.additional_notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="如有其他症狀或特殊情況，請在此說明..."
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-[#0D7A66] focus:ring-1 focus:ring-[#0D7A66]/20"
                  />
                </div>
              )}
            </Card>

            {/* Severity legend */}
            <div className="flex items-center justify-center gap-5 text-xs text-gray-400">
              {[
                { color: "bg-slate-300", label: "無" },
                { color: "bg-yellow-400", label: "輕微" },
                { color: "bg-orange-400", label: "中等" },
                { color: "bg-red-500",    label: "嚴重" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Button
                variant="secondary"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
              >
                ← 上一步
              </Button>

              {!isLast ? (
                <Button onClick={() => setStep(step + 1)}>
                  下一步 →
                </Button>
              ) : (
                <Button onClick={submit} loading={submitting}>
                  提交並分析
                </Button>
              )}
            </div>
          </FadeIn>

          {/* Right: Radar chart preview */}
          <FadeIn delay={0.24} from="right" className="lg:col-span-2">
            <Card className="space-y-4 sticky top-24">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">症狀分布預覽</p>
                <p className="text-xs text-gray-500 mt-1">即時反映您填寫的症狀嚴重程度（百分比越高代表症狀越明顯）</p>
              </div>

              <SymptomRadarChart data={data} />

              {/* Per-step completion indicators */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                {STEPS.map((s, i) => {
                  const catData = data[s.id] as unknown as Record<string, number>
                  const score = Object.values(catData).reduce((a, v) => a + v, 0)
                  const filled = Object.values(catData).filter((v) => v > 0).length
                  const total = s.fields.length
                  return (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className={`text-xs flex-1 ${i === step ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                        {s.title}
                      </span>
                      <span className="text-xs text-gray-400">{filled}/{total}</span>
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(filled / total) * 100}%`,
                            backgroundColor: score === 0 ? "#D1D5DB" : "#0D7A66",
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </FadeIn>
        </div>

        <p className="text-center text-xs text-gray-400">
          會話 ID: <span className="font-mono">{sessionId}</span>
        </p>
      </div>
    </PageWrapper>
  )
}

export default function QuestionnairePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400">載入中...</span>
      </div>
    }>
      <QuestionnaireContent />
    </Suspense>
  )
}
