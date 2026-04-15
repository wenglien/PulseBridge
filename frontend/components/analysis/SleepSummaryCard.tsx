"use client"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import type { SleepData } from "@/types/health"
import { minutesToHM } from "@/lib/utils"

interface SleepSummaryCardProps {
  sleep: SleepData[]
}

const SLEEP_COLORS: Record<string, string> = {
  deep: "#6B4E9B",
  rem: "#0D7A66",
  core: "#2563eb",
  awake: "#9ca3af",
  asleep: "#4ade80",
}

const SLEEP_LABELS: Record<string, string> = {
  deep: "深眠", rem: "REM 睡眠", core: "核心睡眠", awake: "清醒", asleep: "入睡",
}

export function SleepSummaryCard({ sleep }: SleepSummaryCardProps) {
  if (!sleep.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">睡眠分析</p>
        <p className="text-gray-400 text-sm text-center py-8">無睡眠數據</p>
      </div>
    )
  }

  const avg = {
    total: sleep.reduce((a, s) => a + s.total_sleep_minutes, 0) / sleep.length,
    deep: sleep.reduce((a, s) => a + s.deep_sleep_minutes, 0) / sleep.length,
    rem: sleep.reduce((a, s) => a + s.rem_sleep_minutes, 0) / sleep.length,
    core: sleep.reduce((a, s) => a + s.core_sleep_minutes, 0) / sleep.length,
    awake: sleep.reduce((a, s) => a + s.awake_minutes, 0) / sleep.length,
    efficiency: sleep.reduce((a, s) => a + s.sleep_efficiency, 0) / sleep.length,
  }

  const pieData = [
    { name: "deep", value: Math.round(avg.deep) },
    { name: "rem", value: Math.round(avg.rem) },
    { name: "core", value: Math.round(avg.core) },
    { name: "awake", value: Math.round(avg.awake) },
  ].filter((d) => d.value > 0)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">
        睡眠分析（近 {sleep.length} 晚平均）
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut chart */}
        <div className="w-full sm:w-48 h-48 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="85%"
                dataKey="value"
                strokeWidth={0}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={SLEEP_COLORS[entry.name] ?? "#9ca3af"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  color: "#111827",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
                formatter={(value, name) => [minutesToHM(Number(value)), SLEEP_LABELS[String(name)] ?? String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3 w-full">
          <div className="text-center sm:text-left">
            <p className="text-3xl font-bold text-gray-900">{minutesToHM(avg.total)}</p>
            <p className="text-sm text-gray-400">平均睡眠時間</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: SLEEP_COLORS[d.name] ?? "#9ca3af" }}
                />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">{SLEEP_LABELS[d.name]}</p>
                  <p className="text-sm text-gray-800 font-medium">{minutesToHM(d.value)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="text-sm text-gray-500">睡眠效率</span>
            <span className={`text-sm font-bold ${avg.efficiency >= 0.85 ? "text-green-600" : avg.efficiency >= 0.75 ? "text-amber-600" : "text-red-600"}`}>
              {(avg.efficiency * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
