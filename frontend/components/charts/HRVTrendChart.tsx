"use client"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
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
          <h3 className="text-[17px] font-medium text-[var(--ink)]">最近 {series.length} 筆 SDNN</h3>
          <p className="text-sm text-[var(--ink-3)] mt-0.5">
            你的平均 {userAvg} ms
            {reference && <>，同齡層（{reference.age_bracket} 歲）中位數 {reference.sdnn_p50} ms</>}
          </p>
        </div>
        {reference?.sdnn_percentile != null && (
          <span className="text-sm px-3 py-1 rounded-full bg-[var(--mist-wash)] text-[var(--mist)]">
            約在同齡第 {reference.sdnn_percentile} 百分位
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid stroke="var(--wash-2)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--ink-3)" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[Math.floor(yMin), Math.ceil(yMax)]}
            allowDecimals={false}
            tickFormatter={(v: number) => String(Math.round(v))}
            width={36}
            tick={{ fontSize: 11, fill: "var(--ink-3)" }}
            label={{ value: "ms", angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--ink-4)" }}
          />

          {reference && refP25 > 0 && refP75 > 0 && (
            <ReferenceArea
              y1={refP25}
              y2={refP75}
              fill="var(--primary)"
              fillOpacity={0.08}
              ifOverflow="extendDomain"
              label={{ value: "同齡層 P25–P75", position: "insideTopRight", fontSize: 9, fill: "var(--primary)" }}
            />
          )}
          {reference && refP50 > 0 && (
            <ReferenceLine
              y={refP50}
              stroke="var(--primary)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: `P50 ${refP50}`, position: "right", fontSize: 9, fill: "var(--primary)" }}
            />
          )}

          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              fontSize: 12,
              boxShadow: "var(--shadow-soft)",
            }}
            labelFormatter={(_, payload) => {
              const full = payload?.[0]?.payload?.full
              return full
                ? new Date(full).toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "short" })
                : ""
            }}
            formatter={(v) => [`${v} ms`, "SDNN"]}
          />

          <Line
            type="monotone"
            dataKey="sdnn"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 2, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            name="SDNN"
          />
        </LineChart>
      </ResponsiveContainer>

      {reference && (
        <p className="text-sm text-[var(--ink-4)]">
          參考資料：{reference.sources.join("、")}。
          淺色帶為同齡層 P25–P75 範圍。
        </p>
      )}
    </div>
  )
}
