import type { RiskAlert, RiskLevel } from "@/types/analysis"
import { riskLevelColor } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface RiskAlertBannerProps {
  alerts: RiskAlert[]
}

const RISK_ORDER: RiskLevel[] = ["critical", "high", "medium", "low"]

export function RiskAlertBanner({ alerts }: RiskAlertBannerProps) {
  if (!alerts.length) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        <div>
          <p className="text-green-700 font-medium text-sm">無重大風險警示</p>
          <p className="text-green-600 text-xs mt-0.5 opacity-80">您的 ECG 和 HRV 數據未見明顯異常</p>
        </div>
      </div>
    )
  }

  const sorted = [...alerts].sort(
    (a, b) => RISK_ORDER.indexOf(a.risk_level) - RISK_ORDER.indexOf(b.risk_level)
  )

  return (
    <div className="space-y-3">
      {sorted.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "flex gap-4 p-4 rounded-xl border",
            riskLevelColor(alert.risk_level),
          )}
          role="alert"
          aria-live="polite"
        >
          <div className="flex-shrink-0 mt-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              alert.risk_level === "critical" ? "bg-red-500" :
              alert.risk_level === "high" ? "bg-orange-500" :
              alert.risk_level === "medium" ? "bg-yellow-500" :
              "bg-green-500",
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{alert.title_zh}</p>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium uppercase",
                alert.risk_level === "critical" ? "bg-red-100 text-red-700" :
                alert.risk_level === "high" ? "bg-orange-100 text-orange-700" :
                alert.risk_level === "medium" ? "bg-yellow-100 text-yellow-700" :
                "bg-green-100 text-green-700",
              )}>
                {alert.risk_level === "critical" ? "緊急" : alert.risk_level === "high" ? "高風險" : alert.risk_level === "medium" ? "中風險" : "低風險"}
              </span>
            </div>
            <p className="text-sm mt-1 leading-relaxed opacity-80">{alert.description_zh}</p>
            {alert.recommendation && (
              <p className="text-xs mt-2 font-medium opacity-70">
                建議：{alert.recommendation}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
