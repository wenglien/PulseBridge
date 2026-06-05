"use client"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useId, Suspense } from "react"
import {
  Activity,
  ArrowRight,
  Clock3,
  HeartPulse,
  MessageSquareText,
  Moon,
  Sparkles,
  Stethoscope,
} from "lucide-react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { FadeIn } from "@/components/ui/FadeIn"
import { useQuestionnaire } from "@/hooks/useQuestionnaire"

const EXAMPLES = [
  "最近常常覺得疲勞，下午特別沒精神，手腳容易冰冷。",
  "這兩週睡不著、半夜容易醒，多夢，早上起來還是很累。",
  "飯後腹脹、胃酸逆流，壓力大時會胸悶和心悸。",
]

const PROMPT_POINTS = [
  { icon: Activity, title: "身體感受", text: "疲勞、怕冷、冒汗、頭痛、胸悶、痠痛" },
  { icon: Moon, title: "睡眠狀態", text: "入睡時間、半夜醒來、夢境、醒後恢復感" },
  { icon: HeartPulse, title: "腸胃與情緒", text: "胃口、排便、腹脹、焦慮、煩躁、低落" },
  { icon: Clock3, title: "時間與程度", text: "持續多久、一天何時最明顯、輕微或嚴重" },
]

function QuestionnaireContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionParam = searchParams.get("session")
  const stableId = useId().replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)
  const sessionId = sessionParam ?? `pb_manual_${stableId}`

  const { data, setNotes, submitting, submitted, error, submit } = useQuestionnaire(sessionId)
  const text = data.additional_notes
  const trimmed = text.trim()
  const canSubmit = trimmed.length >= 6

  useEffect(() => {
    if (submitted) router.push(`/analysis?session=${sessionId}`)
  }, [submitted, sessionId, router])

  const appendExample = (example: string) => {
    setNotes(trimmed ? `${trimmed}\n${example}` : example)
  }

  return (
    <PageWrapper maxWidth="lg">
      <div className="space-y-6">
        <FadeIn delay={0.05}>
          <div className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase text-[#0D7A66]">Symptom narrative</p>
            <h1 className="text-3xl font-bold text-[var(--text-1)]">直接描述你的症狀</h1>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-[var(--text-2)]">
              用自己的話寫下最近的身體狀態，系統會保留原文，並自動整理成分析報告可使用的症狀線索。
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <FadeIn delay={0.12}>
            <Card className="space-y-5">
              <div className="flex items-start gap-3 border-b border-[var(--border)] pb-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#E8F5F2] text-[#0D7A66]">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-1)]">症狀描述</h2>
                  <p className="mt-0.5 text-sm text-[var(--text-3)]">越具體越好，例如時間、頻率、嚴重度與誘發情境。</p>
                </div>
              </div>

              <textarea
                value={text}
                onChange={(e) => setNotes(e.target.value)}
                rows={12}
                placeholder="例如：最近兩週常常疲勞，下午特別沒精神，晚上睡不著且半夜會醒。飯後容易腹脹，壓力大時會胸悶和心悸..."
                className="min-h-[280px] w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-base leading-7 text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[#0D7A66] focus:outline-none focus:ring-2 focus:ring-[#0D7A66]/20"
              />

              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => appendExample(example)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-xs leading-5 text-[var(--text-2)] transition-colors hover:border-[#0D7A66]/40 hover:bg-[var(--surface-accent)]"
                  >
                    {example}
                  </button>
                ))}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[var(--text-3)]">
                  {trimmed.length > 0 ? `${trimmed.length} 個字` : "尚未輸入症狀描述"}
                </p>
                <Button onClick={submit} loading={submitting} disabled={!canSubmit}>
                  提交並分析
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </FadeIn>

          <FadeIn delay={0.18} from="right">
            <div className="space-y-4 lg:sticky lg:top-24">
              <Card className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#0D7A66]" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">描述重點</p>
                </div>
                <div className="grid gap-3">
                  {PROMPT_POINTS.map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.title} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                        <div className="flex items-start gap-3">
                          <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0D7A66]" />
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-1)]">{item.title}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">{item.text}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <Card className="space-y-3">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-[#0D7A66]" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">提交內容</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="text-sm leading-6 text-[var(--text-2)]">
                    {trimmed || "輸入後，這裡會保留你的原始描述，並送入後續 AI 報告。"}
                  </p>
                </div>
                <p className="text-xs leading-5 text-[var(--text-3)]">
                  會話 ID: <span className="font-mono">{sessionId}</span>
                </p>
              </Card>
            </div>
          </FadeIn>
        </div>
      </div>
    </PageWrapper>
  )
}

export default function QuestionnairePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-[var(--text-3)]">載入中...</span>
      </div>
    }>
      <QuestionnaireContent />
    </Suspense>
  )
}
