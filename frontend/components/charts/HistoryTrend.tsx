"use client"
import { useState } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { METRICS, metricValue, type MetricKey } from "@/lib/metrics"
import { cn } from "@/lib/utils"
import type { Session } from "@/types/analysis"

/** One line per metric across this browser's check-ins (oldest → newest). */
export function HistoryTrend({ sessions }: { sessions: Session[] }) {
  const ordered = [...sessions].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const available = METRICS.filter(
    (def) => ordered.filter((s) => metricValue(s.metrics, def.key) !== undefined).length >= 2,
  )
  const [picked, setPicked] = useState<MetricKey | null>(null)
  if (!available.length) return null

  const def = available.find((d) => d.key === picked) ?? available[0]
  const data = ordered.flatMap((s) => {
    const v = metricValue(s.metrics, def.key)
    if (v === undefined) return []
    const d = new Date(s.created_at)
    return [{ label: `${d.getMonth() + 1}/${d.getDate()}`, full: d.toLocaleDateString("zh-TW"), value: v }]
  })

  return (
    <section aria-labelledby="trend-heading" className="mt-8 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="trend-heading" className="text-xl text-[var(--ink)]">這段時間的變化</h2>
        {available.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="選擇指標">
            {available.map((d) => (
              <button
                key={d.key}
                type="button"
                aria-pressed={d.key === def.key}
                onClick={() => setPicked(d.key)}
                className={cn(
                  "px-3 min-h-9 rounded-full text-sm border transition-colors",
                  d.key === def.key
                    ? "bg-[var(--ink)] border-[var(--ink)] text-[var(--surface)]"
                    : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--line-2)]",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1 text-sm text-[var(--ink-3)]">{def.better === 1 ? "越高越好" : "越低越好"}</p>

      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--wash-2)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
            <YAxis
              width={44}
              domain={["auto", "auto"]}
              allowDecimals={false}
              tickFormatter={(v: number) => (def.key === "sleep_minutes" ? `${(v / 60).toFixed(1)}h` : String(Math.round(v)))}
              tick={{ fontSize: 12, fill: "var(--ink-3)" }} axisLine={false} tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13 }}
              labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ""}
              formatter={(v) => [def.format(Number(v)), def.label]}
            />
            <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5}
                  dot={{ r: 4, fill: "var(--surface)", stroke: "var(--primary)", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
