"use client"
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from "recharts"
import type { ConstitutionScore } from "@/types/analysis"
import { constitutionColor } from "@/lib/utils"
import { ALL_CONSTITUTION_TYPES } from "@/lib/constants"

interface ConstitutionRadarProps {
  scores: ConstitutionScore[]
  primaryType: string
}

export function ConstitutionRadar({ scores, primaryType }: ConstitutionRadarProps) {
  const data = ALL_CONSTITUTION_TYPES.map((type) => {
    const found = scores.find((s) => s.type === type)
    return { subject: type, score: found?.score ?? 0, fullMark: 100 }
  })

  const primaryColor = constitutionColor(primaryType as Parameters<typeof constitutionColor>[0])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">體質雷達圖</p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "#6b7280", fontSize: 11, fontFamily: "Noto Sans SC, sans-serif" }}
            />
            <Radar
              name="體質分數"
              dataKey="score"
              stroke={primaryColor}
              fill={primaryColor}
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                color: "#111827",
                fontSize: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(value) => [`${Number(value).toFixed(0)} 分`, "體質分數"]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
