"use client"
import type { ECGReading } from "@/types/health"
import type { ECGAnalysis, WesternFlags } from "@/types/analysis"
import { ECGClassChart } from "@/components/charts/ECGClassChart"
import { HeartRateRangeChart } from "@/components/charts/HeartRateRangeChart"
import { cn } from "@/lib/utils"

interface ECGSummaryPanelProps {
  ecgReadings: ECGReading[]
  flags: WesternFlags
  analysis?: ECGAnalysis
}

export function ECGSummaryPanel({ ecgReadings, flags, analysis }: ECGSummaryPanelProps) {
  if (!ecgReadings.length) return null

  const hasAFib     = analysis?.rhythm_summary.afib_detected ?? flags.afib_detected
  const quality     = analysis?.signal_quality
  const waveform    = analysis?.waveform_findings
  const risk        = analysis?.ecg_risk_assessment
  const afibBurden  = analysis?.rhythm_summary.afib_burden_pct ?? 0
  const qualityPct  = Math.round((quality?.quality_score ?? 1) * 100)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-400 uppercase tracking-wider">ECG 深度分析</p>
        {risk && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border uppercase ${
            risk.risk_level === "low"    ? "bg-[#E8F5F2] text-[#0D7A66] border-[#9FD1C8]"
          : risk.risk_level === "medium" ? "bg-yellow-50 text-yellow-700 border-yellow-200"
          : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {risk.risk_level === "low" ? "低風險" : risk.risk_level === "medium" ? "中風險" : "高風險"}
          </span>
        )}
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="ECG 記錄數"
          value={`${quality?.total_readings ?? ecgReadings.length}`}
          sub="筆"
        />
        <StatTile
          label="可用訊號"
          value={`${qualityPct}%`}
          color={qualityPct >= 80 ? "green" : qualityPct >= 60 ? "yellow" : "red"}
        />
        <StatTile
          label="心律狀態"
          value={hasAFib ? "異常" : "正常"}
          color={hasAFib ? "red" : "green"}
          sub={hasAFib ? `AFib ${afibBurden.toFixed(1)}%` : "竇性心律"}
        />
        <StatTile
          label="ST 段"
          value={waveform?.st_deviation_detected ? "偏移" : "穩定"}
          color={waveform?.st_deviation_detected ? "orange" : "green"}
          sub={waveform?.st_deviation_detected ? `${waveform.st_deviation_max_uv.toFixed(0)} uV` : ""}
        />
      </div>

      {/* Signal quality bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">訊號品質</span>
          <span className="text-xs font-semibold text-gray-700">{qualityPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${qualityPct}%`,
              backgroundColor: qualityPct >= 80 ? "#0D7A66" : qualityPct >= 60 ? "#F59E0B" : "#DC2626",
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>可用 {quality?.usable_readings ?? "—"} 筆</span>
          <span>不可用 {quality?.inconclusive_readings ?? "—"} 筆</span>
        </div>
      </div>

      {/* Classification donut + bar */}
      <ECGClassChart ecgReadings={ecgReadings} analysis={analysis} />

      {/* Heart rate chart */}
      <HeartRateRangeChart ecgReadings={ecgReadings} analysis={analysis} />

      {/* Flags */}
      {(flags.autonomic_imbalance || flags.sleep_apnea_risk || flags.bradycardia || flags.tachycardia) && (
        <div>
          <p className="text-xs text-gray-400 mb-2">其他提示</p>
          <div className="flex flex-wrap gap-2">
            {flags.autonomic_imbalance && (
              <Flag label="自律神經失衡" color="yellow" />
            )}
            {flags.sleep_apnea_risk && (
              <Flag label="睡眠呼吸中止風險" color="orange" />
            )}
            {flags.bradycardia && (
              <Flag label="心跳過緩" color="blue" />
            )}
            {flags.tachycardia && (
              <Flag label="心跳過速" color="red" />
            )}
          </div>
        </div>
      )}

      {/* Evidence tags */}
      {risk?.evidence && risk.evidence.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">ECG 證據摘要</p>
          <div className="flex flex-wrap gap-2">
            {risk.evidence.map((item) => (
              <span key={item} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({
  label, value, sub, color = "gray",
}: {
  label: string; value: string; sub?: string; color?: "green" | "red" | "yellow" | "orange" | "blue" | "gray"
}) {
  const colorMap = {
    green:  "text-green-700",
    red:    "text-red-600",
    yellow: "text-yellow-700",
    orange: "text-orange-600",
    blue:   "text-blue-700",
    gray:   "text-gray-900",
  }
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
      <p className={cn("text-xl font-bold", colorMap[color])}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}

function Flag({ label, color }: { label: string; color: "yellow" | "orange" | "blue" | "red" }) {
  const styles = {
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    red:    "bg-red-50 text-red-700 border-red-200",
  }
  return (
    <span className={cn("text-xs px-2 py-1 rounded-lg border", styles[color])}>{label}</span>
  )
}
