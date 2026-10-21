import type { HRVReferenceRange } from "@/types/analysis"

export interface Band {
  goodMin: number
  goodMax: number
  warnMin: number
  warnMax: number
  displayMax: number
  /** True when the band comes from the person's age bracket rather than adult defaults. */
  ageAdjusted: boolean
}

// z-score of the 10th percentile; the backend publishes 25/50/75th percentiles
// of a normal approximation, so the spread is recovered from the IQR.
const Z10 = 1.2816
const IQR_TO_SD = 1.349

/**
 * Age-adjusted band for SDNN / RMSSD (higher is better):
 *   below p10 → 異常, p10–p25 → 注意, p25 and above → 正常.
 * Returns null when no usable reference is available.
 */
export function hrvBand(metric: "sdnn" | "rmssd", ref?: HRVReferenceRange | null): Band | null {
  if (!ref) return null
  const p25 = metric === "sdnn" ? ref.sdnn_p25 : ref.rmssd_p25
  const p50 = metric === "sdnn" ? ref.sdnn_p50 : ref.rmssd_p50
  const p75 = metric === "sdnn" ? ref.sdnn_p75 : ref.rmssd_p75
  if (!(p25 > 0 && p75 > p25)) return null
  const sd = (p75 - p25) / IQR_TO_SD
  const p10 = Math.max(0, p50 - Z10 * sd)
  const displayMax = Math.ceil((p75 + 3 * sd) / 10) * 10
  return { goodMin: round(p25), goodMax: displayMax, warnMin: round(p10), warnMax: displayMax, displayMax, ageAdjusted: true }
}

/** LF/HF has no age table; the backend still publishes its normal band. */
export function lfhfBand(ref?: HRVReferenceRange | null): Band | null {
  if (!ref || !(ref.lf_hf_normal_high > ref.lf_hf_normal_low)) return null
  const lo = ref.lf_hf_normal_low
  const hi = ref.lf_hf_normal_high
  return { goodMin: lo, goodMax: hi, warnMin: lo * 0.5, warnMax: hi * 1.6, displayMax: 8, ageAdjusted: false }
}

const round = (v: number) => Math.round(v * 10) / 10
