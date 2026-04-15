"use client"
import type { HRVMetrics } from "@/types/health"
import type { HRVAnalysis } from "@/types/analysis"
import { HRVGaugeBars } from "@/components/charts/HRVGaugeBars"

interface HRVMetricsPanelProps {
  hrv: HRVMetrics
  analysis?: HRVAnalysis
}

export function HRVMetricsPanel({ hrv, analysis }: HRVMetricsPanelProps) {
  const risk = analysis?.hrv_risk_assessment

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-400 uppercase tracking-wider">HRV 深度分析</p>
        {risk && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border uppercase ${
            risk.risk_level === "low"    ? "bg-[#E8F5F2] text-[#0D7A66] border-[#9FD1C8]"
          : risk.risk_level === "medium" ? "bg-yellow-50 text-yellow-700 border-yellow-200"
          : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {risk.risk_level === "low" ? "低風險" : risk.risk_level === "medium" ? "中風險" : "高風險"}
            &nbsp;·&nbsp;
            {risk.confidence === "high" ? "高可信度" : risk.confidence === "medium" ? "中可信度" : "低可信度"}
          </span>
        )}
      </div>

      <HRVGaugeBars hrv={hrv} analysis={analysis} />

      {/* Evidence tags */}
      {risk?.evidence && risk.evidence.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">HRV 證據摘要</p>
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
