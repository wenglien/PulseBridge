"use client"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, Suspense } from "react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { PageHeader } from "@/components/layout/PageHeader"
import { FlowSteps } from "@/components/flow/FlowSteps"
import { SymptomTag } from "@/components/questionnaire/SymptomTag"
import { SymptomRadarChart } from "@/components/charts/SymptomRadarChart"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { cn } from "@/lib/utils"
import { useQuestionnaire } from "@/hooks/useQuestionnaire"
import { QUESTIONNAIRE_SECTIONS as STEPS } from "@/lib/questionnaire"
import type { SymptomSeverity } from "@/types/questionnaire"

function QuestionnaireContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionParam = searchParams.get("session")
  const { step, setStep, data, setSeverity, setNotes, submitting, submittedId, error, submit } = useQuestionnaire(sessionParam)

  useEffect(() => {
    if (submittedId) router.push(`/analysis?session=${submittedId}&start=1`)
  }, [submittedId, router])

  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1

  // Total active symptoms count
  const totalActive = STEPS.flatMap((s) =>
    s.fields.map((f) => (data[s.id] as unknown as Record<string, number>)[f.key] ?? 0),
  ).filter((v) => v > 0).length

  return (
    <PageWrapper maxWidth="lg">
      <FlowSteps current="feel" skipped={sessionParam ? [] : ["data"]} sessionId={sessionParam} />
      <PageHeader
        title="最近身體感覺如何？"
        description="想想最近兩週。沒有感覺的就留在「無」，有的話選一個最接近的程度。"
        aside={
          totalActive > 0 && (
            <span className="text-sm text-[var(--ink-3)]">已勾選 {totalActive} 項</span>
          )
        }
      />

      {/* Category tabs — doubles as progress through the five pages */}
      <div className="mt-6 -mx-4 px-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 w-max" role="tablist" aria-label="症狀分類">
          {STEPS.map((s, i) => {
            const catData = data[s.id] as unknown as Record<string, number>
            const filled = Object.values(catData).filter((v) => v > 0).length
            const active = i === step
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStep(i)}
                className={cn(
                  "px-4 rounded-full text-[15px] border transition-colors gap-2",
                  active
                    ? "bg-[var(--primary)] border-[var(--primary)] text-[var(--surface)]"
                    : "bg-[var(--surface)] border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--primary-line)]",
                )}
              >
                {s.title}
                {filled > 0 && (
                  <span className={cn(
                    "grid place-items-center min-w-5 h-5 px-1 rounded-full text-xs",
                    active ? "bg-[var(--surface)]/25" : "bg-[var(--primary-wash)] text-[var(--primary)]",
                  )}>
                    {filled}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-5">
          <Card>
            <h2 className="text-xl text-[var(--ink)]">{currentStep.title}</h2>
            <p className="text-sm text-[var(--ink-3)] mt-0.5">{currentStep.description}</p>

            <div className="mt-3 divide-y divide-[var(--line)]">
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

            {isLast && (
              <div className="pt-5 mt-2 border-t border-[var(--line)]">
                <label htmlFor="q-notes" className="block text-[15px] text-[var(--ink-2)] mb-2">還有想補充的嗎？（選填）</label>
                <textarea
                  id="q-notes"
                  value={data.additional_notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="例如：最近工作壓力大、月經週期不規律、正在吃的藥…"
                  rows={3}
                  className="w-full rounded-2xl border px-4 py-3 text-[15px] placeholder:text-[var(--ink-4)] resize-none focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            )}
          </Card>

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</p>
          )}

          <div className="flex justify-between items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              上一頁
            </Button>
            <span className="text-sm text-[var(--ink-4)]">{step + 1} / {STEPS.length}</span>
            {!isLast ? (
              <Button onClick={() => setStep(step + 1)}>下一頁</Button>
            ) : (
              <Button onClick={submit} loading={submitting}>完成，產生報告</Button>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24">
          <Card className="space-y-3">
            <h2 className="text-lg text-[var(--ink)]">你的症狀分布</h2>
            <p className="text-sm text-[var(--ink-3)]">邊填邊更新。越往外代表那個面向的不適越明顯。</p>
            <SymptomRadarChart data={data} compact />
          </Card>
        </aside>
      </div>
    </PageWrapper>
  )
}

export default function QuestionnairePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="text-[var(--ink-4)]">載入中…</span>
      </div>
    }>
      <QuestionnaireContent />
    </Suspense>
  )
}
