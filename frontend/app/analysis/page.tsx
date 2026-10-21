"use client"
import { useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import * as Tabs from "@radix-ui/react-tabs"
import { Check, Printer, RefreshCw } from "lucide-react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { FlowSteps } from "@/components/flow/FlowSteps"
import { StreamingAnalysis } from "@/components/analysis/StreamingAnalysis"
import { HRVMetricsPanel } from "@/components/analysis/HRVMetricsPanel"
import { HRVTrendChart } from "@/components/charts/HRVTrendChart"
import { ECGSummaryPanel } from "@/components/analysis/ECGSummaryPanel"
import { SleepSummaryCard } from "@/components/analysis/SleepSummaryCard"
import { RiskAlertBanner } from "@/components/analysis/RiskAlertBanner"
import { RecommendationList } from "@/components/analysis/RecommendationList"
import { MetricExplanationPanel } from "@/components/analysis/MetricExplanationPanel"
import { CitationChips } from "@/components/analysis/CitationChips"
import { ReferencesPanel } from "@/components/analysis/ReferencesPanel"
import { SymptomRadarChart } from "@/components/charts/SymptomRadarChart"
import { ChatPanel } from "@/components/analysis/ChatPanel"
import { CompareWithLast } from "@/components/analysis/CompareWithLast"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { BreathOrb } from "@/components/ui/BreathOrb"
import { useAnalysis } from "@/hooks/useAnalysis"
import { api } from "@/lib/api"
import { printReport } from "@/lib/reportPrint"
import { cn, constitutionColor, constitutionDescription, formatDate } from "@/lib/utils"
import type { AnalysisResult, RiskLevel } from "@/types/analysis"
import type { HealthData } from "@/types/health"
import type { QuestionnaireResponse } from "@/types/questionnaire"

const FOLLOW_UP = {
  immediate: "請立即就醫",
  "1_week": "一週內回診追蹤",
  "2_weeks": "兩週內再檢視一次",
  routine: "維持例行追蹤即可",
} as const

const RISK: Record<RiskLevel, { phrase: string; tone: "calm" | "caution" | "urgent"; chip: string }> = {
  low:      { phrase: "整體狀況穩定",     tone: "calm",    chip: "bg-green-100 text-green-800" },
  medium:   { phrase: "有幾項值得留意",   tone: "caution", chip: "bg-amber-100 text-amber-900" },
  high:     { phrase: "建議近期就醫檢查", tone: "urgent",  chip: "bg-orange-100 text-orange-900" },
  critical: { phrase: "請盡快就醫",       tone: "urgent",  chip: "bg-red-100 text-red-800" },
}

const SYMPTOM_GROUPS = [
  { key: "energy",    label: "能量與疲勞", max: 18 },
  { key: "digestion", label: "消化系統",   max: 18 },
  { key: "mood",      label: "情緒狀態",   max: 15 },
  { key: "pain",      label: "疼痛症狀",   max: 15 },
  { key: "sleep",     label: "睡眠品質",   max: 12 },
] as const

const TAB_TRIGGER =
  "px-4 sm:px-5 rounded-full text-[15px] text-[var(--ink-3)] whitespace-nowrap transition-colors " +
  "hover:text-[var(--ink)] data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--ink)] " +
  "data-[state=active]:shadow-[var(--shadow-soft)]"

function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-xl text-[var(--ink)]">{children}</h2>
      {note && <p className="text-sm text-[var(--ink-3)] mt-0.5">{note}</p>}
    </div>
  )
}

function AnalysisContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session")
  const autoStart = searchParams.get("start") === "1"

  const { result, streaming, error, startStream, onComplete, onError } = useAnalysis()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireResponse | null>(null)
  const [existingResult, setExistingResult] = useState<AnalysisResult | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(Boolean(sessionId))
  const [started, setStarted] = useState(false)
  const [streamAttempt, setStreamAttempt] = useState(0)

  const handleStart = () => {
    setStarted(true)
    setStreamAttempt((prev) => prev + 1)
    startStream()
  }

  useEffect(() => {
    if (!sessionId) return
    Promise.all([
      api.getAnalysis(sessionId).catch(() => null),
      api.getHealthData(sessionId).catch(() => null),
      api.getQuestionnaire(sessionId).catch(() => null),
    ]).then(([analysis, healthData, qData]) => {
      const done = analysis && analysis.status === "completed"
      if (done) setExistingResult(analysis)
      if (healthData) setHealth(healthData as HealthData)
      if (qData) setQuestionnaire(qData as QuestionnaireResponse)
      // Arriving straight from the questionnaire: start without an extra click.
      if (!done && autoStart) handleStart()
    }).finally(() => setLoadingExisting(false))
    // handleStart only touches setters; re-running on its identity would double-start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, autoStart])

  const handleStreamError = (message: string) => {
    setStarted(false)
    onError(message)
  }

  if (!sessionId) {
    return (
      <PageWrapper maxWidth="md">
        <Card className="text-center py-12 space-y-4">
          <h1 className="text-2xl text-[var(--ink)]">還沒有報告</h1>
          <p className="text-[var(--ink-3)]">先匯入資料或填寫問卷，就能產生你的第一份報告。</p>
          <Link href="/upload"><Button>開始檢視</Button></Link>
        </Card>
      </PageWrapper>
    )
  }

  if (loadingExisting) {
    return (
      <PageWrapper maxWidth="md">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <BreathOrb className="w-24" />
          <p className="text-[var(--ink-3)]">正在打開報告…</p>
        </div>
      </PageWrapper>
    )
  }

  const r = result ?? existingResult
  const fromFlow = autoStart || !r

  return (
    <PageWrapper maxWidth="lg">
      {fromFlow && <FlowSteps current="report" sessionId={sessionId} skipped={health ? [] : ["data"]} />}

      {/* ── Not started yet ── */}
      {!r && !started && !error && (
        <Card className="flex flex-col items-center text-center py-12 gap-5">
          <BreathOrb className="w-28" />
          <div>
            <h1 className="text-2xl sm:text-3xl text-[var(--ink)]">資料都準備好了</h1>
            <p className="text-[var(--ink-3)] mt-2 max-w-[28em]">
              接下來會把你的生理數據和身體感受放在一起，整理成西醫數據與中醫調養兩個角度的報告。
            </p>
          </div>
          <Button size="lg" onClick={handleStart}>產生我的報告</Button>
        </Card>
      )}

      {started && streaming && !r && (
        <StreamingAnalysis
          key={`${sessionId}-${streamAttempt}`}
          sessionId={sessionId}
          onComplete={onComplete}
          onError={handleStreamError}
        />
      )}

      {error && (
        <Card className="bg-red-50 border-red-200">
          <h2 className="text-xl text-red-800">報告沒有產生成功</h2>
          <p className="text-[var(--ink-2)] text-[15px] mt-1">{error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={handleStart}>再試一次</Button>
        </Card>
      )}

      {r && <Report r={r} health={health} questionnaire={questionnaire} sessionId={sessionId} canRerun={!result} onRerun={handleStart} />}
    </PageWrapper>
  )
}

function Report({
  r, health, questionnaire, sessionId, canRerun, onRerun,
}: {
  r: AnalysisResult
  health: HealthData | null
  questionnaire: QuestionnaireResponse | null
  sessionId: string
  canRerun: boolean
  onRerun: () => void
}) {
  const risk = RISK[r.executive_summary.overall_risk_level] ?? RISK.low
  const icaRisk = r.integrated_cardiac_assessment
  const urgentAlerts = r.risk_alerts.filter((a) => a.risk_level === "critical" || a.risk_level === "high")
  const hasBodyData = Boolean(
    (health?.hrv && health.hrv.sdnn > 0) || health?.ecg_readings?.length || health?.sleep?.length,
  )
  // Report only mounts client-side (after data loads), so reading the hash here is safe.
  const [tab, setTab] = useState(() => {
    const h = window.location.hash.slice(1)
    return ["overview", "body", "tcm", "ask"].includes(h) ? h : "overview"
  })
  const changeTab = (v: string) => {
    setTab(v)
    history.replaceState(null, "", `#${v}`)
  }

  return (
    <div className="space-y-6">
      {/* ── Summary ── */}
      <section className="rounded-[28px] bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow-soft)] p-6 sm:p-8">
        <div className="grid sm:grid-cols-[auto_1fr] gap-6 sm:gap-8 items-start">
          <BreathOrb tone={risk.tone} className="w-24 sm:w-32 mx-auto sm:mx-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className={cn("px-3 py-0.5 rounded-full text-sm font-medium", risk.chip)}>{risk.phrase}</span>
              <span className="text-sm text-[var(--ink-4)]">{formatDate(r.analyzed_at)}</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-[2rem] leading-snug text-[var(--ink)]">
              {r.executive_summary.headline_zh || "你的健康報告"}
            </h1>
            {r.claude_summary_zh && (
              <p className="mt-3 text-[15px] sm:text-base text-[var(--ink-2)] max-w-[40em]">{r.claude_summary_zh}</p>
            )}
            {r.executive_summary.key_findings.length > 0 && (
              <ul className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {r.executive_summary.key_findings.map((f) => (
                  <li key={f} className="flex gap-2 text-[15px] text-[var(--ink)]">
                    <Check size={18} className="text-[var(--primary)] shrink-0 mt-[3px]" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 pt-4 border-t border-[var(--line)] text-[15px] text-[var(--ink-2)]">
              下一步：<span className="text-[var(--ink)] font-medium">{FOLLOW_UP[icaRisk.follow_up_priority]}</span>
            </p>
          </div>
        </div>
      </section>

      {urgentAlerts.length > 0 && <RiskAlertBanner alerts={urgentAlerts} />}

      {/* ── Tabs ── */}
      <Tabs.Root value={tab} onValueChange={changeTab}>
        <Tabs.List
          aria-label="報告內容"
          className="flex gap-1 p-1 rounded-full bg-[var(--wash-2)] w-full sm:w-max overflow-x-auto [scrollbar-width:none]"
        >
          <Tabs.Trigger value="overview" className={TAB_TRIGGER}>總覽</Tabs.Trigger>
          {hasBodyData && <Tabs.Trigger value="body" className={TAB_TRIGGER}>身體數據</Tabs.Trigger>}
          <Tabs.Trigger value="tcm" className={TAB_TRIGGER}>中醫調養</Tabs.Trigger>
          <Tabs.Trigger value="ask" className={TAB_TRIGGER}>問 AI</Tabs.Trigger>
        </Tabs.List>

        {/* Overview: what to do next */}
        <Tabs.Content value="overview" className="mt-6 space-y-8 focus-visible:outline-none">
          <CompareWithLast sessionId={sessionId} />

          <section>
            <SectionTitle note="依照你的數據排出優先順序，先從第一項開始就好。">接下來兩週可以做的事</SectionTitle>
            {r.data_driven_recommendations.length > 0 ? (
              <ol className="space-y-3">
                {r.data_driven_recommendations.map((item, i) => (
                  <li key={`${item.title_zh}-${i}`}>
                    <Card>
                      <div className="flex items-start gap-4">
                        <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-[var(--primary-wash)] text-[var(--primary)] font-display text-lg">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-medium text-[var(--ink)]">{item.title_zh}</h3>
                          <p className="text-[15px] text-[var(--ink-2)] mt-1">{item.why_zh}</p>
                          {item.actions.length > 0 && (
                            <ul className="mt-3 space-y-1.5">
                              {item.actions.map((a) => (
                                <li key={a} className="flex gap-2 text-[15px] text-[var(--ink)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--sage)] shrink-0 mt-[11px]" aria-hidden />
                                  {a}
                                </li>
                              ))}
                            </ul>
                          )}
                          {item.target_metric && (
                            <p className="mt-3 inline-block rounded-full bg-[var(--mist-wash)] px-3 py-1 text-sm text-[var(--mist)]">
                              目標：{item.target_metric}
                            </p>
                          )}
                          <CitationChips codes={item.citations} references={r.references} />
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ol>
            ) : (
              <Card><p className="text-[var(--ink-3)]">這次沒有特別需要調整的項目，維持目前的作息就好。</p></Card>
            )}
          </section>

          <section>
            <SectionTitle>心臟與自律神經的整體判讀</SectionTitle>
            <Card>
              <p className="text-[15px] text-[var(--ink)]">{icaRisk.primary_conclusion_zh}</p>
              {icaRisk.red_flags.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {icaRisk.red_flags.map((f) => (
                    <li key={f} className="rounded-full bg-red-50 text-red-800 px-3 py-1 text-sm">{f}</li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          {r.risk_alerts.length > urgentAlerts.length && (
            <section>
              <SectionTitle>其他提醒</SectionTitle>
              <RiskAlertBanner alerts={r.risk_alerts.filter((a) => !urgentAlerts.includes(a))} />
            </section>
          )}
        </Tabs.Content>

        {/* Body data (Western) */}
        {hasBodyData && (
          <Tabs.Content value="body" className="mt-6 space-y-8 focus-visible:outline-none">
            {(r.metric_explanations?.length ?? 0) > 0 && (
              <section>
                <SectionTitle note="每個數字代表什麼、你落在哪裡，以及可以怎麼改善。">指標怎麼看</SectionTitle>
                <MetricExplanationPanel items={r.metric_explanations ?? []} references={r.references} hrvReference={r.hrv_analysis?.reference_range} />
              </section>
            )}
            {health?.hrv && health.hrv.sdnn > 0 && (
              <section>
                <SectionTitle note="數值越高，代表身體越能從壓力中恢復。">心率變異（HRV）</SectionTitle>
                <HRVMetricsPanel hrv={health.hrv} analysis={r.hrv_analysis} />
                {health.hrv.sdnn_series && health.hrv.sdnn_series.length > 1 && (
                  <Card className="mt-4">
                    <HRVTrendChart series={health.hrv.sdnn_series} reference={r.hrv_analysis?.reference_range} />
                  </Card>
                )}
              </section>
            )}
            {health?.ecg_readings && health.ecg_readings.length > 0 && (
              <section>
                <SectionTitle>心電圖</SectionTitle>
                <ECGSummaryPanel ecgReadings={health.ecg_readings} flags={r.western_flags} analysis={r.ecg_analysis} />
              </section>
            )}
            {health?.sleep && health.sleep.length > 0 && (
              <section>
                <SectionTitle>睡眠</SectionTitle>
                <SleepSummaryCard sleep={health.sleep} />
              </section>
            )}
          </Tabs.Content>
        )}

        {/* TCM */}
        <Tabs.Content value="tcm" className="mt-6 space-y-8 focus-visible:outline-none">
          {r.primary_constitution && (
            <section className="rounded-[24px] bg-[var(--sand-wash)] p-6 sm:p-7">
              <p className="text-sm text-[var(--ink-3)]">目前比較接近</p>
              <p className="mt-1 font-display text-3xl" style={{ color: constitutionColor(r.primary_constitution) }}>
                {r.primary_constitution}
              </p>
              <p className="mt-2 text-[15px] text-[var(--ink-2)] max-w-[36em]">{constitutionDescription(r.primary_constitution)}</p>
              <p className="mt-3 text-sm text-[var(--ink-3)]">這是調養方向的參考，不是診斷，狀態也會隨作息改變。</p>
            </section>
          )}

          {questionnaire && (
            <section>
              <SectionTitle note="依你填寫的症狀計算，比例越高代表這個面向的不適越明顯。">症狀分布</SectionTitle>
              <Card>
                <div className="grid sm:grid-cols-2 gap-6 items-center">
                  <SymptomRadarChart data={questionnaire} />
                  <ul className="space-y-3">
                    {SYMPTOM_GROUPS.map(({ key, label, max }) => {
                      const score = Object.values(questionnaire[key] as unknown as Record<string, number>).reduce((a, v) => a + v, 0)
                      const pct = Math.round((score / max) * 100)
                      return (
                        <li key={key}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-[var(--ink)]">{label}</span>
                            <span className="text-[var(--ink-3)]">{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--wash-2)] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: pct < 30 ? "var(--sage)" : pct < 60 ? "var(--honey)" : "var(--clay)",
                              }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </Card>
            </section>
          )}

          <section>
            <SectionTitle note="從飲食、作息、穴位與情緒幾個方向，挑一兩項開始。">調養建議</SectionTitle>
            <RecommendationList recommendations={r.recommendations} references={r.references} />
          </section>
        </Tabs.Content>

        <Tabs.Content value="ask" className="mt-6 focus-visible:outline-none">
          <SectionTitle note="AI 已經讀過這份報告。可以問某個數字的意思，或某個建議該怎麼做。">對報告有疑問？</SectionTitle>
          <ChatPanel sessionId={sessionId} />
        </Tabs.Content>
      </Tabs.Root>

      {r.references && Object.keys(r.references).length > 0 && <ReferencesPanel references={r.references} />}

      {/* ── Actions ── */}
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-6 border-t border-[var(--line)]">
        <Button
          variant="secondary"
          onClick={() => printReport(r, health, sessionId, new Date().toLocaleDateString("zh-TW"), questionnaire)}
        >
          <Printer size={17} aria-hidden />
          列印給醫師看
        </Button>
        {canRerun && (
          <Button variant="secondary" onClick={onRerun}>
            <RefreshCw size={17} aria-hidden />
            重新產生報告
          </Button>
        )}
        <Link href="/upload">
          <Button className="w-full">開始新的檢視</Button>
        </Link>
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><BreathOrb className="w-24" /></div>}>
      <AnalysisContent />
    </Suspense>
  )
}
