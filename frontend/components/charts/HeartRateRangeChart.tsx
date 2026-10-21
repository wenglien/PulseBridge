"use client"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts"
import type { ECGAnalysis } from "@/types/analysis"
import type { ECGReading } from "@/types/health"

interface Props {
  ecgReadings: ECGReading[]
  analysis?: ECGAnalysis
}

export function HeartRateRangeChart({ ecgReadings, analysis }: Props) {
  const profile = analysis?.heart_rate_profile
  const avgHR = profile?.mean_hr_bpm
    ?? (ecgReadings.length > 0 ? ecgReadings.reduce((a, r) => a + r.average_heart_rate, 0) / ecgReadings.length : 0)
  const minHR = profile?.min_hr_bpm
    ?? (ecgReadings.length > 0 ? Math.min(...ecgReadings.map((r) => r.average_heart_rate)) : 0)
  const maxHR = profile?.max_hr_bpm
    ?? (ecgReadings.length > 0 ? Math.max(...ecgReadings.map((r) => r.average_heart_rate)) : 0)
  const medHR = profile?.median_hr_bpm ?? 0

  const barData = [
    { label: "最低", value: Math.round(minHR),  fill: "var(--mist)" },
    { label: "平均", value: Math.round(avgHR),  fill: "var(--primary)" },
    { label: "中位", value: Math.round(medHR),  fill: "var(--sage)" },
    { label: "最高", value: Math.round(maxHR),  fill: "var(--brick)" },
  ].filter((d) => d.value > 0)

  if (barData.length === 0) return null

  const rangeSpan = maxHR - minHR

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">心率分布</p>

      {/* Visual range bar */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-500">心率範圍</span>
          <span className="text-xs text-gray-800 font-bold">
            {Math.round(minHR)} – {Math.round(maxHR)} bpm
          </span>
        </div>
        <div className="relative h-4 rounded-full bg-gray-100 overflow-hidden">
          {/* Normal zone 60-100 */}
          {maxHR > 0 && (
            <div
              className="absolute top-0 h-full bg-[var(--primary-wash)]"
              style={{
                left: `${Math.max(0, ((60 - minHR) / rangeSpan) * 100)}%`,
                width: `${Math.min(100, ((Math.min(maxHR, 100) - Math.max(minHR, 60)) / rangeSpan) * 100)}%`,
              }}
            />
          )}
          {/* Actual range fill */}
          <div
            className="absolute top-1/4 h-1/2 rounded-full"
            style={{
              left: "0%",
              width: "100%",
              background: "linear-gradient(to right, var(--mist), var(--sage), var(--clay))",
              opacity: 0.7,
            }}
          />
          {/* Avg marker */}
          {maxHR > minHR && (
            <div
              className="absolute top-0 w-0.5 h-full bg-[var(--surface)] shadow-md"
              style={{ left: `${((avgHR - minHR) / rangeSpan) * 100}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>最低 {Math.round(minHR)} bpm</span>
          <span className="text-[var(--primary)]">正常 60–100 bpm</span>
          <span>最高 {Math.round(maxHR)} bpm</span>
        </div>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={barData} margin={{ top: 0, right: 20, bottom: 0, left: 0 }} barSize={32}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--wash-2)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[Math.max(0, Math.round(minHR) - 10), Math.round(maxHR) + 10]}
            tick={{ fontSize: 10, fill: "var(--ink-4)" }}
            axisLine={false}
            tickLine={false}
            unit=" bpm"
          />
          <ReferenceLine y={60}  stroke="var(--primary)" strokeDasharray="4 2" strokeOpacity={0.5} />
          <ReferenceLine y={100} stroke="var(--honey)" strokeDasharray="4 2" strokeOpacity={0.5} />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-soft)" }}
            formatter={(v: unknown) => [`${v} bpm`, "心率"]}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {barData.map((d, i) => (
              <Cell key={i} fill={d.fill} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
