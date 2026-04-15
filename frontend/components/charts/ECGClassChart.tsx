"use client"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts"
import { ECG_CLASSIFICATION_LABELS } from "@/lib/constants"
import type { ECGAnalysis } from "@/types/analysis"
import type { ECGReading } from "@/types/health"

interface Props {
  ecgReadings: ECGReading[]
  analysis?: ECGAnalysis
}

const CLASS_COLORS: Record<string, string> = {
  sinusRhythm:           "#0D7A66",
  atrialFibrillation:    "#DC2626",
  sinusBradycardia:      "#3B82F6",
  sinusTachycardia:      "#F59E0B",
  inconclusiveHighHR:    "#8B5CF6",
  inconclusiveLowHR:     "#EC4899",
  notClassified:         "#9CA3AF",
  other:                 "#6B7280",
}

function getClassColor(cls: string): string {
  return CLASS_COLORS[cls] ?? "#9CA3AF"
}

const RADIAN = Math.PI / 180
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number
  percent: number; name: string
}) {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function ECGClassChart({ ecgReadings, analysis }: Props) {
  const dist = analysis?.rhythm_summary.classification_distribution
    ?? ecgReadings.reduce((acc, r) => {
      acc[r.classification] = (acc[r.classification] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

  const pieData = Object.entries(dist)
    .filter(([, v]) => v > 0)
    .map(([cls, count]) => ({
      name: ECG_CLASSIFICATION_LABELS[cls] ?? cls,
      value: count,
      cls,
    }))
    .sort((a, b) => b.value - a.value)

  const total = pieData.reduce((a, d) => a + d.value, 0)

  if (pieData.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">無 ECG 分類資料</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {/* Donut */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">心律分類分布</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              dataKey="value"
              strokeWidth={0}
              labelLine={false}
              label={CustomLabel as never}
            >
              {pieData.map((entry) => (
                <Cell key={entry.cls} fill={getClassColor(entry.cls)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(v: unknown, name: unknown) => [`${v} 次 (${(((v as number) / total) * 100).toFixed(1)}%)`, String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="space-y-1.5 mt-2">
          {pieData.map((d) => (
            <div key={d.cls} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getClassColor(d.cls) }} />
              <span className="text-xs text-gray-600 flex-1">{d.name}</span>
              <span className="text-xs font-semibold text-gray-800">{d.value} 次</span>
              <span className="text-xs text-gray-400 w-10 text-right">{((d.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Horizontal bar chart */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">各類型次數</p>
        <ResponsiveContainer width="100%" height={Math.max(140, pieData.length * 36)}>
          <BarChart
            data={pieData}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
            barSize={16}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
            <XAxis type="number" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              formatter={(v: unknown) => [`${v} 次`, "次數"]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {pieData.map((entry) => (
                <Cell key={entry.cls} fill={getClassColor(entry.cls)} fillOpacity={0.85} />
              ))}
              <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: "#6B7280", fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
