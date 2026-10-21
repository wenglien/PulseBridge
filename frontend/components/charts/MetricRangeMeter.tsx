"use client"
import type { HRVReferenceRange } from "@/types/analysis"
import { hrvBand, lfhfBand } from "@/lib/hrvRanges"

/**
 * A compact horizontal range meter that shows where a metric's current value sits
 * within its reference range. Works as a pure CSS/Tailwind component — no chart library needed.
 */

interface RangeConfig {
  min: number
  max: number
  /** Good (optimal) range */
  goodMin: number
  goodMax: number
  /** Warning (borderline) boundaries — defaults to the axis extremes */
  warnMin?: number
  warnMax?: number
  unit?: string
  /** Format function for display */
  format?: (v: number) => string
}

// Pre-defined configs keyed by metric_key
const METRIC_RANGES: Record<string, RangeConfig> = {
  sdnn:              { min: 0, max: 150, goodMin: 50, goodMax: 100, warnMin: 25, warnMax: 120, unit: "ms" },
  rmssd:             { min: 0, max: 100, goodMin: 25, goodMax: 60,  warnMin: 15, warnMax: 80,  unit: "ms" },
  lf_hf:             { min: 0, max: 8,   goodMin: 0.5, goodMax: 3.0, warnMin: 0.2, warnMax: 5.0 },
  pnn50:             { min: 0, max: 50,  goodMin: 5,   goodMax: 30,  warnMin: 2,   warnMax: 40,  unit: "%" },
  mean_rr:           { min: 400, max: 1500, goodMin: 600, goodMax: 1000, warnMin: 500, warnMax: 1200, unit: "ms" },
  avg_hr:            { min: 30, max: 180, goodMin: 60,  goodMax: 100, warnMin: 40,  warnMax: 120, unit: "bpm" },
  max_hr:            { min: 60, max: 220, goodMin: 60,  goodMax: 180, warnMin: 60,  warnMax: 200, unit: "bpm" },
  min_hr:            { min: 30, max: 100, goodMin: 50,  goodMax: 80,  warnMin: 40,  warnMax: 90,  unit: "bpm" },
  afib_burden:       { min: 0, max: 100,  goodMin: 0,   goodMax: 1,   warnMin: 0,   warnMax: 5,   unit: "%" },
  st_deviation:      { min: 0, max: 300,  goodMin: 0,   goodMax: 50,  warnMin: 0,   warnMax: 100, unit: "uV" },
  sleep_efficiency:  { min: 0, max: 100,  goodMin: 85,  goodMax: 100, warnMin: 75,  warnMax: 100, unit: "%" },
  deep_sleep_pct:    { min: 0, max: 40,   goodMin: 13,  goodMax: 23,  warnMin: 10,  warnMax: 30,  unit: "%" },
  rem_pct:           { min: 0, max: 35,   goodMin: 20,  goodMax: 25,  warnMin: 15,  warnMax: 30,  unit: "%" },
}

function parseValue(raw: string): number | null {
  const num = parseFloat(raw.replace(/[^\d.-]/g, ""))
  return isNaN(num) ? null : num
}

function getStatus(value: number, cfg: RangeConfig): "good" | "warning" | "danger" {
  if (value >= cfg.goodMin && value <= cfg.goodMax) return "good"
  const wMin = cfg.warnMin ?? cfg.min
  const wMax = cfg.warnMax ?? cfg.max
  if (value >= wMin && value <= wMax) return "warning"
  return "danger"
}

const STATUS_STYLES = {
  good:    "bg-[var(--primary-wash)] text-[var(--primary)] border-[var(--primary-line)]",
  warning: "bg-yellow-50 text-yellow-700 border-yellow-200",
  danger:  "bg-red-50 text-red-700 border-red-200",
}
const STATUS_FILL = {
  good: "var(--primary)", warning: "var(--honey)", danger: "var(--brick)",
}
const STATUS_LABEL = {
  good: "正常", warning: "注意", danger: "異常",
}

interface Props {
  metricKey: string
  currentValue: string
  /** Age-bracket reference from the analysis; overrides adult defaults for HRV metrics. */
  reference?: HRVReferenceRange | null
}

function resolveConfig(metricKey: string, reference?: HRVReferenceRange | null): (RangeConfig & { ageAdjusted?: boolean }) | undefined {
  const base = METRIC_RANGES[metricKey]
  if (!base) return undefined
  const band =
    metricKey === "sdnn" || metricKey === "rmssd" ? hrvBand(metricKey, reference)
    : metricKey === "lf_hf" ? lfhfBand(reference)
    : null
  if (!band) return base
  return {
    ...base,
    goodMin: band.goodMin, goodMax: band.goodMax,
    warnMin: band.warnMin, warnMax: band.warnMax,
    max: Math.max(base.max, band.displayMax),
    ageAdjusted: band.ageAdjusted,
  }
}

export function MetricRangeMeter({ metricKey, currentValue, reference }: Props) {
  const cfg = resolveConfig(metricKey, reference)
  const value = parseValue(currentValue)

  if (!cfg || value === null) return null

  const range = cfg.max - cfg.min
  const clampPct = (v: number) => Math.min(100, Math.max(0, ((v - cfg.min) / range) * 100))

  const valuePct = clampPct(value)
  const goodLoPct = clampPct(cfg.goodMin)
  const goodHiPct = clampPct(cfg.goodMax)
  const warnLoPct = clampPct(cfg.warnMin ?? cfg.min)
  const warnHiPct = clampPct(cfg.warnMax ?? cfg.max)

  const status = getStatus(value, cfg)
  const fillColor = STATUS_FILL[status]

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">
          {cfg.ageAdjusted && reference ? `同齡參考（${reference.age_bracket}）` : "參考區間"}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* Zone bar */}
      <div className="relative h-3">
        <div className="absolute inset-0 rounded-full overflow-hidden bg-gray-100">
        {/* danger left */}
        <div className="absolute top-0 left-0 h-full bg-red-100" style={{ width: `${warnLoPct}%` }} />
        {/* warning left */}
        <div className="absolute top-0 h-full bg-yellow-100" style={{ left: `${warnLoPct}%`, width: `${goodLoPct - warnLoPct}%` }} />
        {/* good */}
        <div className="absolute top-0 h-full bg-green-200" style={{ left: `${goodLoPct}%`, width: `${goodHiPct - goodLoPct}%` }} />
        {/* warning right */}
        <div className="absolute top-0 h-full bg-yellow-100" style={{ left: `${goodHiPct}%`, width: `${warnHiPct - goodHiPct}%` }} />
        {/* danger right */}
        <div className="absolute top-0 h-full bg-red-100" style={{ left: `${warnHiPct}%`, right: 0 }} />
        </div>

        {/* Value dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-[3px] border-[var(--surface)] shadow-[0_0_0_1px_var(--line-2)]"
          style={{ left: `calc(${valuePct}% - 8px)`, backgroundColor: fillColor }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-400">
        <span>最低 {cfg.min}{cfg.unit ?? ""}</span>
        <span className="text-[var(--primary)] font-medium">
          {cfg.ageAdjusted ? `目標 ${cfg.goodMin}${cfg.unit ?? ""} 以上` : `目標 ${cfg.goodMin}–${cfg.goodMax}${cfg.unit ?? ""}`}
        </span>
        <span>最高 {cfg.max}{cfg.unit ?? ""}</span>
      </div>
    </div>
  )
}
