"use client"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { StreamingAnalysis } from "@/components/analysis/StreamingAnalysis"
import { HRVMetricsPanel } from "@/components/analysis/HRVMetricsPanel"
import { ECGSummaryPanel } from "@/components/analysis/ECGSummaryPanel"
import { SleepSummaryCard } from "@/components/analysis/SleepSummaryCard"
import { RiskAlertBanner } from "@/components/analysis/RiskAlertBanner"
import { RecommendationList } from "@/components/analysis/RecommendationList"
import { MetricExplanationPanel } from "@/components/analysis/MetricExplanationPanel"
import { RiskArcGauge } from "@/components/charts/RiskArcGauge"
import { SymptomRadarChart } from "@/components/charts/SymptomRadarChart"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/FadeIn"
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

function AnalysisContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get("session")

  const { result, streaming, error, startStream, onComplete, onError } = useAnalysis()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireResponse | null>(null)
  const [existingResult, setExistingResult] = useState<AnalysisResult | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [started, setStarted] = useState(false)
  const [streamAttempt, setStreamAttempt] = useState(0)

  useEffect(() => {
    if (!sessionId) {
      setLoadingExisting(false)
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
          <p className="text-gray-500">未找到會話 ID，請先上傳資料或填寫問卷</p>
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
            <div>
              <h1 className="text-3xl font-bold text-gray-900">健康分析報告</h1>
              <p className="text-gray-400 text-sm mt-1 font-mono">{sessionId}</p>
            </div>
            {displayResult && (
              <p className="text-gray-400 text-xs">{formatDate(displayResult.analyzed_at)}</p>
            )}
          </div>
        </FadeIn>

        {/* Start streaming or show existing */}
        {!displayResult && !started && (
          <FadeIn delay={0.12}>
          <Card className="text-center py-12 space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">開始 AI 中西醫整合分析</h2>
              <p className="text-gray-500 text-sm mt-2">
                Claude AI 將分析您的 ECG、HRV、睡眠數據和症狀問卷，<br />
                生成個人化的中醫視角解讀與調養建議
              </p>
            </div>
            <Button size="lg" onClick={handleStart}>開始分析</Button>
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
                <p className="text-gray-500 text-sm">{error}</p>
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
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-4 self-start">整體風險評估</p>
                <RiskArcGauge
                  riskLevel={displayResult.executive_summary.overall_risk_level}
                />
              </Card>

              {/* Summary */}
              <div className="lg:col-span-2">
                <Card glow className="h-full">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">數據總結</p>
                  {displayResult.executive_summary.headline_zh && (
                    <p className="text-gray-900 text-lg font-semibold mb-2">{displayResult.executive_summary.headline_zh}</p>
                  )}
                  {displayResult.executive_summary.key_findings.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {displayResult.executive_summary.key_findings.map((item) => (
                        <span key={item} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                  {displayResult.claude_summary_zh && (
                    <p className="text-gray-600 leading-relaxed text-sm">{displayResult.claude_summary_zh}</p>
                  )}
                </Card>
              </div>
            </div>
            </FadeIn>

            {/* Symptom radar (if questionnaire data available) */}
            {questionnaire && (
              <FadeIn>
              <div>
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">症狀問卷分析</h2>
                <Card>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">各系統症狀嚴重度</p>
                  <p className="text-xs text-gray-500 mb-4">根據您填寫的症狀問卷，以下雷達圖呈現各系統的症狀負擔比例</p>
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
                              <span className="text-xs font-medium text-gray-700">{label}</span>
                              <span className="text-xs font-mono text-gray-500">{score}/{max} ({pct}%)</span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
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
                </Card>
              </div>
              </FadeIn>
            )}

            {/* Risk alerts */}
            <FadeIn>
              <div>
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  風險提醒
                </h2>
                <RiskAlertBanner alerts={displayResult.risk_alerts} />
              </div>
            </FadeIn>

            <FadeIn>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">整合心血管判讀</p>
                <p className="text-gray-700 leading-relaxed text-sm">
                  {displayResult.integrated_cardiac_assessment.primary_conclusion_zh}
                </p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="rounded-xl bg-gray-50 px-3 py-2 border border-gray-200">
                    <p className="text-xs text-gray-400">整體風險</p>
                    <p className="text-sm text-gray-800 mt-1 uppercase">
                      {displayResult.integrated_cardiac_assessment.cardiac_risk_level}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 border border-gray-200">
                    <p className="text-xs text-gray-400">追蹤時程</p>
                    <p className="text-sm text-gray-800 mt-1">
                      {followUpLabel[displayResult.integrated_cardiac_assessment.follow_up_priority]}
                    </p>
                  </div>
                </div>
                {displayResult.integrated_cardiac_assessment.red_flags.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-400 mb-2">紅旗訊號</p>
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
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">數據驅動建議</p>
                {displayResult.data_driven_recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {displayResult.data_driven_recommendations.map((item, index) => (
                      <div key={`${item.title_zh}-${index}`} className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">{item.title_zh}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 uppercase">
                            {item.domain}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8F5F2] text-[#0D7A66] uppercase">
                            {item.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed">{item.why_zh}</p>
                        {item.target_metric && (
                          <p className="text-xs text-gray-400 mt-2">目標：{item.target_metric}</p>
                        )}
                        {item.actions.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {item.actions.map((action) => (
                              <span key={action} className="text-xs px-2 py-1 rounded-lg bg-white text-gray-600 border border-gray-200">
                                {action}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">目前沒有額外的數據驅動建議。</p>
                )}
              </Card>
            </div>
            </FadeIn>

            <FadeIn>
              <div>
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  指標解讀與改善
                </h2>
                <MetricExplanationPanel items={displayResult.metric_explanations ?? []} />
              </div>
            </FadeIn>

            {/* HRV */}
            {health?.hrv && health.hrv.sdnn > 0 && (
              <FadeIn>
                <div>
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                    心率變異性（HRV）
                  </h2>
                  <HRVMetricsPanel hrv={health.hrv} analysis={displayResult.hrv_analysis} />
                </div>
              </FadeIn>
            )}

            {/* ECG */}
            {health?.ecg_readings && health.ecg_readings.length > 0 && (
              <FadeIn>
                <div>
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
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
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                    睡眠分析
                  </h2>
                  <SleepSummaryCard sleep={health.sleep} />
                </div>
              </FadeIn>
            )}

            {/* Recommendations */}
            <FadeIn>
              <div>
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  中醫視角調養建議
                </h2>
                <p className="text-sm text-gray-500 mb-3">
                  不以九種體質分類呈現，而是直接從中醫觀點整理你目前較需要留意的身體狀態與調整方向。
                </p>
                <RecommendationList recommendations={displayResult.recommendations} />
              </div>
            </FadeIn>

            {/* AI Chat Panel */}
            <FadeIn>
              <div>
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  AI 追問助理
                </h2>
                <p className="text-sm text-gray-500 mb-3">
                  對報告有任何疑問？直接問 AI，它已完整讀取您的分析結果。
                </p>
                <ChatPanel sessionId={sessionId} />
              </div>
            </FadeIn>

            {/* Actions */}
            <FadeIn>
            <div className="flex gap-3 flex-wrap justify-end pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={() => printReport(
                  displayResult,
                  health,
                  sessionId,
                  new Date().toLocaleDateString("zh-TW"),
                )}
              >
                🖨 匯出就醫報告 PDF
              </Button>
              <Link href="/questionnaire">
                <Button variant="secondary">重新問卷</Button>
              </Link>
              <Link href="/upload">
                <Button variant="secondary">上傳新資料</Button>
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
