"use client"
import { Activity, HeartPulse, LineChart, Moon, ShieldAlert, Sparkles } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { minutesToHM } from "@/lib/utils"
import type { AnalysisResult, RiskLevel } from "@/types/analysis"
import type { HealthData, SDNNRecord } from "@/types/health"
import type { QuestionnaireResponse } from "@/types/questionnaire"

interface DataObservationPanelProps {
  health: HealthData | null
  result: AnalysisResult
  questionnaire: QuestionnaireResponse | null
}

type Tone = "good" | "watch" | "risk" | "neutral"

function toneClass(tone: Tone): string {
  return {
    good: "border-[#0D7A66]/25 bg-[#E8F5F2] text-[#0D7A66]",
    watch: "border-amber-200 bg-amber-50 text-amber-700",
    risk: "border-red-200 bg-red-50 text-red-600",
    neutral: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-2)]",
  }[tone]
}

function riskTone(level: RiskLevel): Tone {
  if (level === "critical" || level === "high") return "risk"
  if (level === "medium") return "watch"
  return "good"
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, v) => a + v, 0) / values.length
}

function trendLabel(series?: SDNNRecord[]): { label: string; tone: Tone; detail: string } {
  if (!series || series.length < 3) {
    return { label: "資料不足", tone: "neutral", detail: "需要至少 3 筆 HRV 趨勢資料" }
  }
  const sorted = [...series].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
  const split = Math.max(1, Math.floor(sorted.length / 2))
  const first = avg(sorted.slice(0, split).map((d) => d.value_ms))
  const last = avg(sorted.slice(-split).map((d) => d.value_ms))
  const delta = last - first

  if (delta > 5) return { label: "回升", tone: "good", detail: `後段平均比前段高 ${delta.toFixed(1)} ms` }
  if (delta < -5) return { label: "下降", tone: "watch", detail: `後段平均比前段低 ${Math.abs(delta).toFixed(1)} ms` }
  return { label: "穩定", tone: "neutral", detail: "前後段平均差異不大" }
}

function symptomCount(questionnaire: QuestionnaireResponse | null): number {
  if (!questionnaire) return 0
  return ["energy", "digestion", "mood", "pain", "sleep"].reduce((total, key) => {
    const values = Object.values(questionnaire[key as keyof QuestionnaireResponse] as unknown as Record<string, number>)
    return total + values.filter((v) => v > 0).length
  }, 0)
}

function buildObservations(
  health: HealthData | null,
  result: AnalysisResult,
  questionnaire: QuestionnaireResponse | null,
): string[] {
  const observations: string[] = []
  const hrv = health?.hrv
  const sleep = health?.sleep ?? []
  const riskLevel = result.executive_summary.overall_risk_level

  if (hrv && hrv.sdnn > 0) {
    if (hrv.sdnn < 30) observations.push("HRV SDNN 偏低，恢復狀態可能承受壓力。")
    else if (hrv.sdnn >= 50) observations.push("HRV SDNN 位於較穩定區間，可作為恢復狀態基準。")
  }

  if (result.hrv_analysis?.autonomic_balance.sympathetic_dominance) {
    observations.push("LF/HF 與 HRV 判讀顯示交感偏強，建議搭配睡眠與壓力描述一起看。")
  }

  if (sleep.length > 0) {
    const avgSleep = avg(sleep.map((s) => s.total_sleep_minutes))
    const avgEfficiency = avg(sleep.map((s) => s.sleep_efficiency))
    if (avgSleep < 360) observations.push("平均睡眠低於 6 小時，可能影響隔日 HRV 與疲勞感。")
    if (avgEfficiency > 0 && avgEfficiency < 80) observations.push("睡眠效率偏低，建議觀察夜醒、壓力與睡前刺激。")
  }

  if (result.ecg_analysis?.rhythm_summary.afib_detected) {
    observations.push("ECG 有偵測到 AFib 訊號，應優先查看心血管風險與追蹤建議。")
  }

  if (questionnaire?.additional_notes) {
    observations.push("使用者症狀描述已納入報告，可和 HRV、睡眠、ECG 的時間變化交叉觀察。")
  }

  if (riskLevel === "high" || riskLevel === "critical") {
    observations.unshift("整體風險層級偏高，建議先閱讀風險提醒與就醫追蹤時程。")
  }

  return observations.slice(0, 5)
}

export function DataObservationPanel({ health, result, questionnaire }: DataObservationPanelProps) {
  const hrv = health?.hrv
  const sleep = health?.sleep ?? []
  const ecg = health?.ecg_readings ?? []
  const hrvTrend = trendLabel(hrv?.sdnn_series)
  const avgSleepMinutes = avg(sleep.map((s) => s.total_sleep_minutes))
  const avgSleepEfficiency = avg(sleep.map((s) => s.sleep_efficiency))
  const symptoms = symptomCount(questionnaire)
  const observations = buildObservations(health, result, questionnaire)

  const cards = [
    {
      icon: LineChart,
      label: "HRV 趨勢",
      value: hrvTrend.label,
      detail: hrv ? `${hrv.sdnn.toFixed(0)} ms SDNN · ${hrvTrend.detail}` : "尚無 HRV 資料",
      tone: hrvTrend.tone,
    },
    {
      icon: Moon,
      label: "睡眠觀察",
      value: avgSleepMinutes > 0 ? minutesToHM(avgSleepMinutes) : "N/A",
      detail: avgSleepEfficiency > 0 ? `平均效率 ${avgSleepEfficiency.toFixed(0)}% · ${sleep.length} 晚資料` : "尚無睡眠資料",
      tone: avgSleepMinutes >= 420 ? "good" : avgSleepMinutes > 0 ? "watch" : "neutral",
    },
    {
      icon: HeartPulse,
      label: "ECG 訊號",
      value: ecg.length > 0 ? `${ecg.length} 筆` : "N/A",
      detail: result.ecg_analysis?.rhythm_summary.afib_detected
        ? `AFib burden ${result.ecg_analysis.rhythm_summary.afib_burden_pct.toFixed(1)}%`
        : result.ecg_analysis?.rhythm_summary.dominant_rhythm
          ? `主要節律：${result.ecg_analysis.rhythm_summary.dominant_rhythm}`
          : "尚無 ECG 資料",
      tone: result.ecg_analysis?.rhythm_summary.afib_detected ? "risk" : ecg.length > 0 ? "good" : "neutral",
    },
    {
      icon: Activity,
      label: "症狀線索",
      value: symptoms > 0 ? `${symptoms} 項` : questionnaire?.additional_notes ? "文字描述" : "N/A",
      detail: questionnaire?.additional_notes ? "已納入自由輸入症狀描述" : "尚無症狀描述",
      tone: symptoms > 0 || questionnaire?.additional_notes ? "watch" : "neutral",
    },
  ] satisfies Array<{
    icon: typeof Activity
    label: string
    value: string
    detail: string
    tone: Tone
  }>

  return (
    <Card className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0D7A66]">Data observation</p>
          <h2 className="mt-1 text-xl font-bold text-[var(--text-1)]">數據觀察總覽</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">
            先把資料品質、趨勢與症狀線索放在同一個畫面，幫助你看出哪些數據值得優先追蹤。
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${toneClass(riskTone(result.executive_summary.overall_risk_level))}`}>
          <ShieldAlert className="h-3.5 w-3.5" />
          {result.executive_summary.overall_risk_level.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`rounded-lg border p-4 ${toneClass(card.tone)}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase opacity-80">{card.label}</p>
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-2xl font-bold">{card.value}</p>
              <p className="mt-2 text-xs leading-5 opacity-85">{card.detail}</p>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#0D7A66]" />
          <p className="text-sm font-semibold text-[var(--text-1)]">優先觀察重點</p>
        </div>
        {observations.length > 0 ? (
          <div className="grid gap-2">
            {observations.map((item) => (
              <div key={item} className="flex gap-2 text-sm leading-6 text-[var(--text-2)]">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#0D7A66]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-3)]">目前資料量較少，完成上傳、症狀描述與分析後會顯示觀察重點。</p>
        )}
      </div>
    </Card>
  )
}
