"use client"
import { useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { Bot, Download, FileText, HeartPulse, RefreshCw, UploadCloud } from "lucide-react"
import { PageWrapper } from "@/components/layout/PageWrapper"
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
import { DataObservationPanel } from "@/components/analysis/DataObservationPanel"
import { RiskArcGauge } from "@/components/charts/RiskArcGauge"
import { SymptomRadarChart } from "@/components/charts/SymptomRadarChart"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { FadeIn } from "@/components/ui/FadeIn"
import { ChatPanel } from "@/components/analysis/ChatPanel"
import { useAnalysis } from "@/hooks/useAnalysis"
import { api } from "@/lib/api"
import { printReport } from "@/lib/reportPrint"
import type { AnalysisResult } from "@/types/analysis"
import type { HealthData } from "@/types/health"
import type { QuestionnaireResponse } from "@/types/questionnaire"
import { formatDate } from "@/lib/utils"
import Link from "next/link"

const followUpLabel = {
  immediate: "立即就醫",
  "1_week": "一週內追蹤",
  "2_weeks": "兩週內追蹤",
  routine: "例行追蹤",
} as const

function hasStructuredSymptoms(questionnaire: QuestionnaireResponse): boolean {
  return ["energy", "digestion", "mood", "pain", "sleep"].some((key) =>
    Object.values(questionnaire[key as keyof QuestionnaireResponse] as unknown as Record<string, number>)
      .some((value) => value > 0),
  )
}

function AnalysisContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session")

  const { result, streaming, error, startStream, onComplete, onError } = useAnalysis()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireResponse | null>(null)
  const [existingResult, setExistingResult] = useState<AnalysisResult | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(() => Boolean(sessionId))
  const [started, setStarted] = useState(false)
  const [streamAttempt, setStreamAttempt] = useState(0)

  useEffect(() => {
    if (!sessionId) {
      return
    }
    Promise.all([
      api.getAnalysis(sessionId).catch(() => null),
      api.getHealthData(sessionId).catch(() => null),
      api.getQuestionnaire(sessionId).catch(() => null),
    ]).then(([analysis, healthData, qData]) => {
      if (analysis && analysis.status === "completed") {
        setExistingResult(analysis)
      }
      if (healthData) setHealth(healthData as HealthData)
      if (qData) setQuestionnaire(qData as QuestionnaireResponse)
    }).finally(() => setLoadingExisting(false))
  }, [sessionId])

  const handleStart = () => {
    setStarted(true)
    setStreamAttempt((prev) => prev + 1)
    startStream()
  }

  const handleStreamError = (message: string) => {
    setStarted(false)
    onError(message)
  }

  if (!sessionId) {
    return (
      <PageWrapper maxWidth="md">
        <Card className="text-center py-12 space-y-4">
          <p className="text-[var(--text-2)]">未找到會話 ID，請先上傳資料或填寫問卷</p>
          <Link href="/upload"><Button>上傳資料</Button></Link>
        </Card>
      </PageWrapper>
    )
  }

  if (loadingExisting) {
    return (
      <PageWrapper maxWidth="md">
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      </PageWrapper>
    )
  }

  const displayResult = result ?? existingResult

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <FadeIn delay={0.05}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#E8F5F2] text-[#0D7A66]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#0D7A66]">Health report</p>
                <h1 className="text-3xl font-bold text-[var(--text-1)]">健康分析報告</h1>
                <p className="text-[var(--text-3)] text-sm mt-1 font-mono">{sessionId}</p>
              </div>
            </div>
            {displayResult && (
              <p className="text-[var(--text-3)] text-xs">{formatDate(displayResult.analyzed_at)}</p>
            )}
          </div>
        </FadeIn>

        {/* Start streaming or show existing */}
        {!displayResult && !started && (
          <FadeIn delay={0.12}>
          <Card className="overflow-hidden p-0">
            <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-5 p-7 sm:p-8">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[#E8F5F2] text-[#0D7A66]">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-[var(--text-1)]">產生中西醫整合報告</h2>
                  <p className="text-[var(--text-2)] text-sm mt-3 leading-6">
                    AI 將整合 ECG、HRV、睡眠數據和症狀問卷，生成風險摘要、指標解讀與個人化調養建議。
                  </p>
                </div>
                <Button size="lg" onClick={handleStart}>
                  開始分析
                </Button>
              </div>
              <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] p-6 lg:border-l lg:border-t-0">
                <div className="grid gap-3">
                  {[
                    { icon: HeartPulse, title: "心血管訊號", desc: "彙整心率、ECG 分類與風險旗標" },
                    { icon: RefreshCw, title: "恢復與壓力", desc: "比較 HRV、睡眠與症狀負擔" },
                    { icon: FileText, title: "就醫友善摘要", desc: "整理成可匯出的結構化報告" },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                        <div className="flex items-start gap-3">
                          <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0D7A66]" />
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-1)]">{item.title}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">{item.desc}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </Card>
          </FadeIn>
        )}

        {/* Streaming display */}
        {started && streaming && !displayResult && (
          <StreamingAnalysis
            key={`${sessionId}-${streamAttempt}`}
            sessionId={sessionId}
            onComplete={onComplete}
            onError={handleStreamError}
          />
        )}

        {error && (
          <Card className="border-red-200">
            <div className="flex gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-red-600 font-medium">分析失敗</p>
                <p className="text-[var(--text-2)] text-sm">{error}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={handleStart}>
                  重試
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Full results */}
        {displayResult && (
          <div className="space-y-6">
            {/* Risk gauge + summary row */}
            <FadeIn delay={0.08}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Risk gauge */}
              <Card className="flex flex-col items-center justify-center py-4">
                <p className="text-xs text-[var(--text-3)] uppercase tracking-wider mb-4 self-start">整體風險評估</p>
                <RiskArcGauge
                  riskLevel={displayResult.executive_summary.overall_risk_level}
                />
              </Card>

              {/* Summary */}
              <div className="lg:col-span-2">
                <Card glow className="h-full">
                  <p className="text-xs text-[var(--text-3)] uppercase tracking-wider mb-3">數據總結</p>
                  {displayResult.executive_summary.headline_zh && (
                    <p className="text-[var(--text-1)] text-lg font-semibold mb-2">{displayResult.executive_summary.headline_zh}</p>
                  )}
                  {displayResult.executive_summary.key_findings.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {displayResult.executive_summary.key_findings.map((item) => (
                        <span key={item} className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-muted)] text-[var(--text-2)] border border-[var(--border)]">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                  {displayResult.claude_summary_zh && (
                    <p className="text-[var(--text-2)] leading-relaxed text-sm">{displayResult.claude_summary_zh}</p>
                  )}
                </Card>
              </div>
            </div>
            </FadeIn>

            <FadeIn>
              <DataObservationPanel
                health={health}
                result={displayResult}
                questionnaire={questionnaire}
              />
            </FadeIn>

            {/* Symptom narrative / structured questionnaire */}
            {questionnaire && (
              <FadeIn>
              <div>
                <h2 className="text-sm font-medium text-[var(--text-3)] uppercase tracking-wider mb-3">症狀問卷分析</h2>
                <Card className="space-y-5">
                  {questionnaire.additional_notes && (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                      <p className="text-xs text-[var(--text-3)] uppercase tracking-wider mb-2">使用者症狀描述</p>
                      <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-2)]">
                        {questionnaire.additional_notes}
                      </p>
                    </div>
                  )}

                  {hasStructuredSymptoms(questionnaire) && (
                    <div>
                      <p className="text-xs text-[var(--text-3)] uppercase tracking-wider mb-1">系統整理的症狀分布</p>
                      <p className="text-xs text-[var(--text-2)] mb-4">以下是根據描述推斷出的各系統症狀負擔比例。</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                        <SymptomRadarChart data={questionnaire} />
                        <div className="space-y-3">
                          {[
                            { key: "energy",    label: "能量與疲勞", max: 18 },
                            { key: "digestion", label: "消化系統",   max: 18 },
                            { key: "mood",      label: "情緒狀態",   max: 15 },
                            { key: "pain",      label: "疼痛症狀",   max: 15 },
                            { key: "sleep",     label: "睡眠品質",   max: 12 },
                          ].map(({ key, label, max }) => {
                            const score = Object.values(questionnaire[key as keyof QuestionnaireResponse] as unknown as Record<string, number>).reduce((a, v) => a + v, 0)
                            const pct = Math.round((score / max) * 100)
                            return (
                              <div key={key}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-[var(--text-2)]">{label}</span>
                                  <span className="text-xs font-mono text-[var(--text-2)]">{score}/{max} ({pct}%)</span>
                                </div>
                                <div className="h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: pct === 0 ? "#D1D5DB" : pct < 30 ? "#0D7A66" : pct < 60 ? "#F59E0B" : "#DC2626",
                                    }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
              </FadeIn>
            )}

            {/* Risk alerts */}
            <FadeIn>
              <div>
                <h2 className="text-sm font-medium text-[var(--text-3)] uppercase tracking-wider mb-3">
                  風險提醒
                </h2>
                <RiskAlertBanner alerts={displayResult.risk_alerts} />
              </div>
            </FadeIn>

            <FadeIn>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <p className="text-xs text-[var(--text-3)] uppercase tracking-wider mb-3">整合心血管判讀</p>
                <p className="text-[var(--text-2)] leading-relaxed text-sm">
                  {displayResult.integrated_cardiac_assessment.primary_conclusion_zh}
                </p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 border border-[var(--border)]">
                    <p className="text-xs text-[var(--text-3)]">整體風險</p>
                    <p className="text-sm text-[var(--text-1)] mt-1 uppercase">
                      {displayResult.integrated_cardiac_assessment.cardiac_risk_level}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 border border-[var(--border)]">
                    <p className="text-xs text-[var(--text-3)]">追蹤時程</p>
                    <p className="text-sm text-[var(--text-1)] mt-1">
                      {followUpLabel[displayResult.integrated_cardiac_assessment.follow_up_priority]}
                    </p>
                  </div>
                </div>
                {displayResult.integrated_cardiac_assessment.red_flags.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-[var(--text-3)] mb-2">紅旗訊號</p>
                    <div className="flex flex-wrap gap-2">
                      {displayResult.integrated_cardiac_assessment.red_flags.map((item) => (
                        <span key={item} className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <Card>
                <p className="text-xs text-[var(--text-3)] uppercase tracking-wider mb-3">數據驅動建議</p>
                {displayResult.data_driven_recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {displayResult.data_driven_recommendations.map((item, index) => (
                      <div key={`${item.title_zh}-${index}`} className="rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-[var(--text-1)]">{item.title_zh}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-muted)] text-[var(--text-2)] uppercase">
                            {item.domain}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8F5F2] text-[#0D7A66] uppercase">
                            {item.priority}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text-2)] mt-2 leading-relaxed">{item.why_zh}</p>
                        {item.target_metric && (
                          <p className="text-xs text-[var(--text-3)] mt-2">目標：{item.target_metric}</p>
                        )}
                        {item.actions.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {item.actions.map((action) => (
                              <span key={action} className="text-xs px-2 py-1 rounded-lg bg-[var(--surface)] text-[var(--text-2)] border border-[var(--border)]">
                                {action}
                              </span>
                            ))}
                          </div>
                        )}
                        <CitationChips
                          codes={item.citations}
                          references={displayResult.references}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-3)]">目前沒有額外的數據驅動建議。</p>
                )}
              </Card>
            </div>
            </FadeIn>

            <FadeIn>
              <div>
                <h2 className="text-sm font-medium text-[var(--text-3)] uppercase tracking-wider mb-3">
                  指標解讀與改善
                </h2>
                <MetricExplanationPanel items={displayResult.metric_explanations ?? []} references={displayResult.references} />
              </div>
            </FadeIn>

            {/* HRV */}
            {health?.hrv && health.hrv.sdnn > 0 && (
              <FadeIn>
                <div>
                  <h2 className="text-sm font-medium text-[var(--text-3)] uppercase tracking-wider mb-3">
                    心率變異性（HRV）
                  </h2>
                  <HRVMetricsPanel hrv={health.hrv} analysis={displayResult.hrv_analysis} />
                  {health.hrv.sdnn_series && health.hrv.sdnn_series.length > 1 && (
                    <Card className="mt-4">
                      <HRVTrendChart
                        series={health.hrv.sdnn_series}
                        reference={displayResult.hrv_analysis?.reference_range}
                      />
                    </Card>
                  )}
                </div>
              </FadeIn>
            )}

            {/* ECG */}
            {health?.ecg_readings && health.ecg_readings.length > 0 && (
              <FadeIn>
                <div>
                  <h2 className="text-sm font-medium text-[var(--text-3)] uppercase tracking-wider mb-3">
                    心電圖（ECG）
                  </h2>
                  <ECGSummaryPanel
                    ecgReadings={health.ecg_readings}
                    flags={displayResult.western_flags}
                    analysis={displayResult.ecg_analysis}
                  />
                </div>
              </FadeIn>
            )}

            {/* Sleep */}
            {health?.sleep && health.sleep.length > 0 && (
              <FadeIn>
                <div>
                  <h2 className="text-sm font-medium text-[var(--text-3)] uppercase tracking-wider mb-3">
                    睡眠分析
                  </h2>
                  <SleepSummaryCard sleep={health.sleep} />
                </div>
              </FadeIn>
            )}

            {/* Recommendations */}
            <FadeIn>
              <div>
                <h2 className="text-sm font-medium text-[var(--text-3)] uppercase tracking-wider mb-3">
                  中醫視角調養建議
                </h2>
                <p className="text-sm text-[var(--text-2)] mb-3">
                  不以九種體質分類呈現，而是直接從中醫觀點整理你目前較需要留意的身體狀態與調整方向。
                </p>
                <RecommendationList recommendations={displayResult.recommendations} references={displayResult.references} />
              </div>
            </FadeIn>

            {displayResult.references && Object.keys(displayResult.references).length > 0 && (
              <FadeIn>
                <ReferencesPanel references={displayResult.references} />
              </FadeIn>
            )}

            {/* AI Chat Panel */}
            <FadeIn>
              <div>
                <h2 className="text-sm font-medium text-[var(--text-3)] uppercase tracking-wider mb-3">
                  AI 追問助理
                </h2>
                <p className="text-sm text-[var(--text-2)] mb-3">
                  對報告有任何疑問？直接問 AI，它已完整讀取您的分析結果。
                </p>
                <ChatPanel sessionId={sessionId} />
              </div>
            </FadeIn>

            {/* Actions */}
            <FadeIn>
            <div className="flex gap-3 flex-wrap justify-end pt-4 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                onClick={() => printReport(
                  displayResult,
                  health,
                  sessionId,
                  new Date().toLocaleDateString("zh-TW"),
                )}
              >
                <Download className="h-4 w-4" />
                匯出就醫報告 PDF
              </Button>
              <Link href="/questionnaire">
                <Button variant="secondary">重新問卷</Button>
              </Link>
              <Link href="/upload">
                <Button variant="secondary">
                  <UploadCloud className="h-4 w-4" />
                  上傳新資料
                </Button>
              </Link>
              {!result && (
                <Button onClick={handleStart}>重新分析</Button>
              )}
            </div>
            </FadeIn>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Spinner size="lg" /></div>}>
      <AnalysisContent />
    </Suspense>
  )
}
