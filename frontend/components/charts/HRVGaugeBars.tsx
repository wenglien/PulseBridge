"use client"
import {
  Tooltip, ResponsiveContainer, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts"
import type { HRVMetrics } from "@/types/health"
import type { HRVAnalysis } from "@/types/analysis"
import { hrvBand, lfhfBand, type Band } from "@/lib/hrvRanges"

interface Props {
  hrv: HRVMetrics
  analysis?: HRVAnalysis
}

// Reference ranges for each metric (min_display, danger_lo, warn_lo, good_lo, good_hi, warn_hi, max_display)
interface MetricRange {
  key: string
  label: string
  unit: string
  value: number
  goodMin: number
  goodMax: number
  warnMin: number
  warnMax: number
  displayMin: number
  displayMax: number
  higherIsBetter: boolean
  /** Band taken from the person's age bracket (open-ended upwards). */
  ageAdjusted?: boolean
}

function getRangeBand(value: number, r: MetricRange): "good" | "warning" | "danger" {
  if (value >= r.goodMin && value <= r.goodMax) return "good"
  if (value >= r.warnMin && value <= r.warnMax) return "warning"
  return "danger"
}

function bandColor(band: "good" | "warning" | "danger"): string {
  return band === "good" ? "var(--primary)" : band === "warning" ? "var(--honey)" : "var(--brick)"
}

function bandBg(band: "good" | "warning" | "danger"): string {
  return band === "good" ? "bg-[var(--primary-wash)] text-[var(--primary)] border-[var(--primary-line)]"
       : band === "warning" ? "bg-yellow-50 text-yellow-700 border-yellow-200"
       : "bg-red-50 text-red-700 border-red-200"
}

function bandLabel(band: "good" | "warning" | "danger"): string {
  return band === "good" ? "正常" : band === "warning" ? "注意" : "異常"
}

/** Renders a horizontal range bar with colored zones and a value pointer */
function RangeBar({ metric }: { metric: MetricRange }) {
  const { value, displayMin, displayMax, goodMin, goodMax, warnMin, warnMax } = metric
  const range = displayMax - displayMin

  // clamp position 0-100%
  const pct = Math.min(100, Math.max(0, ((value - displayMin) / range) * 100))

  // zone widths as percentages
  const warnLoPct = ((warnMin - displayMin) / range) * 100
  const goodLoPct = ((goodMin - displayMin) / range) * 100
  const goodHiPct = ((goodMax - displayMin) / range) * 100
  const warnHiPct = ((warnMax - displayMin) / range) * 100

  const band = getRangeBand(value, metric)
  const color = bandColor(band)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{metric.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">
            {value % 1 === 0 ? value : value.toFixed(2)}{metric.unit}
          </span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${bandBg(band)}`}>
            {bandLabel(band)}
          </span>
        </div>
      </div>

      {/* Zone bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-gray-100">
        {/* danger left zone */}
        <div className="absolute top-0 left-0 h-full bg-red-100" style={{ width: `${warnLoPct}%` }} />
        {/* warning left zone */}
        <div className="absolute top-0 h-full bg-yellow-100" style={{ left: `${warnLoPct}%`, width: `${goodLoPct - warnLoPct}%` }} />
        {/* good zone */}
        <div className="absolute top-0 h-full bg-[var(--primary-wash)]" style={{ left: `${goodLoPct}%`, width: `${goodHiPct - goodLoPct}%` }} />
        {/* warning right zone */}
        <div className="absolute top-0 h-full bg-yellow-100" style={{ left: `${goodHiPct}%`, width: `${warnHiPct - goodHiPct}%` }} />
        {/* danger right zone */}
        <div className="absolute top-0 h-full bg-red-100" style={{ left: `${warnHiPct}%`, right: 0 }} />

        {/* Value pointer */}
        <div
          className="absolute top-0 h-full w-0.5"
          style={{ left: `${pct}%`, backgroundColor: color, transition: "left 0.4s ease" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[var(--surface)] shadow-md"
          style={{ left: `calc(${pct}% - 6px)`, backgroundColor: color, transition: "left 0.4s ease" }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-400">
        <span>{displayMin}{metric.unit}</span>
        <span className="text-[var(--primary)]">
          {metric.ageAdjusted ? `同齡正常 ${goodMin} 以上` : `正常 ${goodMin}–${goodMax}`}
        </span>
        <span>{displayMax}{metric.unit}</span>
      </div>
    </div>
  )
}

// Radar normalisation helper (0-100 scale where 100 = optimal)
function normalizeHRV(hrv: HRVMetrics, analysis?: HRVAnalysis): Record<string, number> {
  const sdnn = analysis?.time_domain.sdnn_ms ?? hrv.sdnn
  const rmssd = analysis?.time_domain.rmssd_ms ?? hrv.rmssd
  const pnn50 = analysis?.time_domain.pnn50_pct ?? hrv.pnn50
  const lfhf = analysis?.frequency_domain.lf_hf_ratio ?? hrv.lf_hf_ratio

  return {
    sdnn:  Math.min(100, (sdnn / 80) * 100),      // 80ms = excellent
    rmssd: Math.min(100, (rmssd / 50) * 100),     // 50ms = excellent
    pnn50: Math.min(100, (pnn50 / 25) * 100),     // 25% = excellent
    lfhf:  Math.max(0, 100 - Math.abs(lfhf - 1.5) * 20), // 1.5 is optimal
  }
}

export function HRVGaugeBars({ hrv, analysis }: Props) {
  const td  = analysis?.time_domain
  const fd  = analysis?.frequency_domain
  const sdnn  = td?.sdnn_ms ?? hrv.sdnn
  const rmssd = td?.rmssd_ms ?? hrv.rmssd
  const pnn50 = td?.pnn50_pct ?? hrv.pnn50
  const lfhf  = fd?.lf_hf_ratio ?? hrv.lf_hf_ratio
  const meanRR = td?.mean_rr_ms ?? hrv.mean_rr

  const ref = analysis?.reference_range
  const withBand = (m: MetricRange, band: Band | null): MetricRange =>
    band ? { ...m, goodMin: band.goodMin, goodMax: band.goodMax, warnMin: band.warnMin, warnMax: band.warnMax,
             displayMax: Math.max(m.displayMax, band.displayMax), ageAdjusted: band.ageAdjusted } : m

  const metrics: MetricRange[] = [
    withBand({
      key: "sdnn", label: "SDNN（整體自律神經調節）", unit: "ms",
      value: sdnn, goodMin: 50, goodMax: 100, warnMin: 25, warnMax: 120,
      displayMin: 0, displayMax: 150, higherIsBetter: true,
    }, hrvBand("sdnn", ref)),
    withBand({
      key: "rmssd", label: "RMSSD（副交感活性）", unit: "ms",
      value: rmssd, goodMin: 25, goodMax: 60, warnMin: 15, warnMax: 80,
      displayMin: 0, displayMax: 100, higherIsBetter: true,
    }, hrvBand("rmssd", ref)),
    {
      key: "pnn50", label: "pNN50（短期心率調節）", unit: "%",
      value: pnn50, goodMin: 5, goodMax: 30, warnMin: 2, warnMax: 40,
      displayMin: 0, displayMax: 50, higherIsBetter: true,
    },
    withBand({
      key: "lfhf", label: "LF/HF 比值（交感/副交感平衡）", unit: "",
      value: lfhf, goodMin: 0.5, goodMax: 3.0, warnMin: 0.2, warnMax: 5.0,
      displayMin: 0, displayMax: 8, higherIsBetter: false,
    }, lfhfBand(ref)),
  ]

  const norm = normalizeHRV(hrv, analysis)
  const radarData = [
    { subject: "SDNN",  value: Math.round(norm.sdnn),  fullMark: 100 },
    { subject: "RMSSD", value: Math.round(norm.rmssd), fullMark: 100 },
    { subject: "pNN50", value: Math.round(norm.pnn50), fullMark: 100 },
    { subject: "LF/HF\n平衡", value: Math.round(norm.lfhf),  fullMark: 100 },
  ]

  const meanHR = meanRR > 0 ? Math.round(60000 / meanRR) : 0

  return (
    <div className="space-y-6">
      {/* Radar overview + mean HR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-2">HRV 綜合評分</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <defs>
                <radialGradient id="hrvFill">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.05} />
                </radialGradient>
              </defs>
              <PolarGrid stroke="var(--line)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fontWeight: 600, fill: "var(--ink-700)" }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "var(--ink-4)" }} tickCount={3} axisLine={false} />
              <Radar dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="url(#hrvFill)"
                dot={{ fill: "var(--primary)", strokeWidth: 0, r: 3 }} name="評分" />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-soft)" }}
                formatter={(v: unknown) => [`${v} 分`, ""]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 content-start pt-2">
          {[
            { label: "平均心率", value: meanHR > 0 ? `${meanHR} bpm` : "—", note: "由 RR 間期換算" },
            { label: "平均 RR", value: meanRR > 0 ? `${meanRR.toFixed(0)} ms` : "—", note: "心跳間隔均值" },
            {
              label: "恢復狀態",
              value: analysis?.autonomic_balance.overall_recovery_state === "good" ? "良好"
                   : analysis?.autonomic_balance.overall_recovery_state === "fair" ? "普通" : "差",
              note: "整體自律神經評估",
            },
            {
              label: "副交感活性",
              value: analysis?.autonomic_balance.parasympathetic_activity === "high" ? "偏高"
                   : analysis?.autonomic_balance.parasympathetic_activity === "low" ? "偏低" : "正常",
              note: "迷走神經張力",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-[var(--wash)] p-3">
              <p className="text-xs text-gray-400">{item.note}</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{item.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Range bars */}
      <div className="space-y-4">
        <p className="text-xs text-gray-400">各指標參考區間</p>
        {metrics.map((m) => (
          <RangeBar key={m.key} metric={m} />
        ))}
      </div>
    </div>
  )
}
