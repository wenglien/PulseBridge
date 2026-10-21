import type { SessionMetrics } from "@/types/analysis"
import { minutesToHM } from "@/lib/utils"

export type MetricKey = "sdnn" | "rmssd" | "resting_hr" | "sleep_minutes" | "symptom_load"

export interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  /** +1: higher is better, -1: lower is better */
  better: 1 | -1
  format: (v: number) => string
  /** Changes smaller than this are shown as "持平". */
  noise: number
}

export const METRICS: MetricDef[] = [
  { key: "sdnn",          label: "心率變異 SDNN", unit: "ms",  better: 1,  noise: 2,  format: (v) => `${v.toFixed(1)} ms` },
  { key: "rmssd",         label: "心率變異 RMSSD", unit: "ms", better: 1,  noise: 2,  format: (v) => `${v.toFixed(1)} ms` },
  { key: "resting_hr",    label: "靜息心率",      unit: "bpm", better: -1, noise: 1.5, format: (v) => `${Math.round(v)} bpm` },
  { key: "sleep_minutes", label: "平均睡眠",      unit: "",    better: 1,  noise: 10, format: (v) => minutesToHM(v) },
  { key: "symptom_load",  label: "症狀負擔",      unit: "分",  better: -1, noise: 0.5, format: (v) => `${Math.round(v)} 分` },
]

export type Trend = "better" | "worse" | "same"

export function compare(def: MetricDef, now: number, before: number): { delta: number; trend: Trend } {
  const delta = now - before
  if (Math.abs(delta) < def.noise) return { delta, trend: "same" }
  return { delta, trend: Math.sign(delta) === def.better ? "better" : "worse" }
}

export function formatDelta(def: MetricDef, delta: number): string {
  const sign = delta > 0 ? "+" : "−"
  const abs = Math.abs(delta)
  if (def.key === "sleep_minutes") return `${sign}${minutesToHM(abs)}`
  return `${sign}${def.unit === "ms" ? abs.toFixed(1) : Math.round(abs)} ${def.unit}`.trim()
}

export const metricValue = (m: SessionMetrics | undefined, key: MetricKey) => {
  const v = m?.[key]
  return typeof v === "number" ? v : undefined
}
