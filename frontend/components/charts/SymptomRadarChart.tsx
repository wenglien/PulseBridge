"use client"
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from "recharts"
import type { QuestionnaireResponse } from "@/types/questionnaire"

interface Props {
  data: Omit<QuestionnaireResponse, "session_id">
  compact?: boolean
}

const CATEGORY_MAX: Record<string, number> = {
  能量: 18, // 6 items × 3
  消化: 18,
  情緒: 15, // 5 items × 3
  疼痛: 15,
  睡眠: 12, // 4 items × 3
}

function categoryScore(values: Record<string, number>): number {
  return Object.values(values).reduce((a, v) => a + v, 0)
}

function toPercent(score: number, max: number): number {
  return Math.round((score / max) * 100)
}

const SEVERITY_GRADIENT = [
  { offset: "0%", color: "#0D7A66" },
  { offset: "60%", color: "#F59E0B" },
  { offset: "100%", color: "#DC2626" },
]

export function SymptomRadarChart({ data, compact = false }: Props) {
  const chartData = [
    {
      subject: "能量",
      value: toPercent(categoryScore(data.energy as unknown as Record<string, number>), CATEGORY_MAX["能量"]),
      fullMark: 100,
    },
    {
      subject: "消化",
      value: toPercent(categoryScore(data.digestion as unknown as Record<string, number>), CATEGORY_MAX["消化"]),
      fullMark: 100,
    },
    {
      subject: "情緒",
      value: toPercent(categoryScore(data.mood as unknown as Record<string, number>), CATEGORY_MAX["情緒"]),
      fullMark: 100,
    },
    {
      subject: "疼痛",
      value: toPercent(categoryScore(data.pain as unknown as Record<string, number>), CATEGORY_MAX["疼痛"]),
      fullMark: 100,
    },
    {
      subject: "睡眠",
      value: toPercent(categoryScore(data.sleep as unknown as Record<string, number>), CATEGORY_MAX["睡眠"]),
      fullMark: 100,
    },
  ]

  const totalScore = chartData.reduce((a, d) => a + d.value, 0)
  const hasAnySymptom = totalScore > 0

  const height = compact ? 180 : 240

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={chartData} margin={{ top: 8, right: 28, bottom: 8, left: 28 }}>
          <defs>
            <radialGradient id="symptomFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#DC2626" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#DC2626" stopOpacity={0.05} />
            </radialGradient>
          </defs>
          <PolarGrid
            stroke="#E5E7EB"
            strokeDasharray="3 3"
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fontSize: compact ? 11 : 12,
              fontWeight: 600,
              fill: "#374151",
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "#9CA3AF" }}
            tickCount={4}
            axisLine={false}
          />
          <Radar
            name="症狀嚴重度"
            dataKey="value"
            stroke="#DC2626"
            strokeWidth={2}
            fill="url(#symptomFill)"
            dot={{ fill: "#DC2626", strokeWidth: 0, r: 3 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            formatter={(v: unknown, name: unknown) => [
              `${v}%`,
              String(name),
            ]}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Category score bars */}
      <div className="space-y-2 mt-1 px-1">
        {chartData.map((d) => (
          <div key={d.subject} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-8 text-right shrink-0">{d.subject}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${d.value}%`,
                  backgroundColor:
                    d.value === 0 ? "#D1D5DB"
                    : d.value < 30 ? "#0D7A66"
                    : d.value < 60 ? "#F59E0B"
                    : "#DC2626",
                }}
              />
            </div>
            <span className="text-xs font-mono text-gray-400 w-8 shrink-0">{d.value}%</span>
          </div>
        ))}
      </div>

      {!hasAnySymptom && (
        <p className="text-xs text-gray-400 text-center mt-2">尚未填寫任何症狀</p>
      )}
    </div>
  )
}
