"use client"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, Legend,
} from "recharts"
import type { SDNNRecord } from "@/types/health"
import type { HRVReferenceRange } from "@/types/analysis"

interface Props {
  series: SDNNRecord[]
  reference?: HRVReferenceRange | null
}

function shortDate(ts: string): string {
  if (!ts) return ""
  // Accept "YYYY-MM-DD HH:MM:SS +0000" or ISO
  const m = ts.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ts.slice(0, 10)
  return `${m[2]}/${m[3]}`
}

export function HRVTrendChart({ series, reference }: Props) {
  if (!series || series.length === 0) return null

  const sorted = [...series].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
  const data = sorted.map((r) => ({
    label: shortDate(r.timestamp),
    full: r.timestamp,
    sdnn: Math.round(r.value_ms * 10) / 10,
  }))

  const values = data.map((d) => d.sdnn)
  const dataMax = Math.max(...values)
  const dataMin = Math.min(...values)
  const refP75 = reference?.sdnn_p75 ?? 0
  const refP50 = reference?.sdnn_p50 ?? 0
  const refP25 = reference?.sdnn_p25 ?? 0

  const yMax = Math.max(dataMax, refP75) * 1.15
  const yMin = Math.max(0, Math.min(dataMin, refP25) * 0.85)

  const userAvg = Math.round((values.reduce((a, v) => a + v, 0) / values.length) * 10) / 10

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">SDNN 趨勢</p>
          <p className="text-xs text-gray-500 mt-0.5">
            共 {series.length} 筆記錄，平均 {userAvg} ms
            {reference && (
              <span className="ml-1">
                · 同齡層（{reference.age_bracket}）中位數 {reference.sdnn_p50} ms
              </span>
            )}
          </p>
        </div>
        {reference?.sdnn_percentile != null && (
          <span className="text-xs px-2 py-1 rounded-lg bg-[#E8F5F2] text-[#0D7A66] border border-[#9FD1C8]">
            平均落在第 {reference.sdnn_percentile} 百分位
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid stroke="#F3F4F6" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#6B7280" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: "#6B7280" }}
            label={{ value: "ms", angle: -90, position: "insideLeft", fontSize: 10, fill: "#9CA3AF" }}
          />

          {reference && refP25 > 0 && refP75 > 0 && (
            <ReferenceArea
              y1={refP25}
              y2={refP75}
              fill="#0D7A66"
              fillOpacity={0.08}
              ifOverflow="extendDomain"
              label={{ value: "同齡層 P25–P75", position: "insideTopRight", fontSize: 9, fill: "#0D7A66" }}
            />
          )}
          {reference && refP50 > 0 && (
            <ReferenceLine
              y={refP50}
              stroke="#0D7A66"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: `P50 ${refP50}`, position: "right", fontSize: 9, fill: "#0D7A66" }}
            />
          )}

          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            labelFormatter={(_, payload) => {
              const full = payload?.[0]?.payload?.full
              return full ? full.slice(0, 16) : ""
            }}
            formatter={(v) => [`${v} ms`, "SDNN"]}
          />

          <Line
            type="monotone"
            dataKey="sdnn"
            stroke="#0D7A66"
            strokeWidth={2}
            dot={{ r: 2, fill: "#0D7A66", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            name="SDNN"
          />
        </LineChart>
      </ResponsiveContainer>

      {reference && (
        <p className="text-[10px] text-gray-400">
          參考資料：{reference.sources.join("、")}。
          綠色帶為同齡層 P25–P75 正常範圍。
        </p>
      )}
    </div>
  )
}
