import { AlertTriangle, Info, ShieldCheck } from "lucide-react"
import type { RiskAlert, RiskLevel } from "@/types/analysis"
import { cn } from "@/lib/utils"

interface RiskAlertBannerProps {
  alerts: RiskAlert[]
}

const RISK_ORDER: RiskLevel[] = ["critical", "high", "medium", "low"]

const STYLE: Record<RiskLevel, { box: string; icon: string; label: string }> = {
  critical: { box: "bg-red-50 border-red-300",       icon: "text-red-700",    label: "請盡快就醫" },
  high:     { box: "bg-orange-50 border-orange-300", icon: "text-orange-700", label: "建議近期就醫" },
  medium:   { box: "bg-amber-50 border-amber-200",   icon: "text-amber-700",  label: "值得留意" },
  low:      { box: "bg-[var(--surface)] border-[var(--line)]", icon: "text-[var(--ink-3)]", label: "參考" },
}

export function RiskAlertBanner({ alerts }: RiskAlertBannerProps) {
  if (!alerts.length) {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-[20px] bg-[var(--primary-wash)]">
        <ShieldCheck size={20} className="text-[var(--primary)] shrink-0" aria-hidden />
        <p className="text-[15px] text-[var(--ink)]">心電圖與心率變異沒有看到需要特別處理的異常。</p>
      </div>
    )
  }

  const sorted = [...alerts].sort(
    (a, b) => RISK_ORDER.indexOf(a.risk_level) - RISK_ORDER.indexOf(b.risk_level),
  )

  return (
    <ul className="space-y-3">
      {sorted.map((alert) => {
        const st = STYLE[alert.risk_level] ?? STYLE.low
        const urgent = alert.risk_level === "critical" || alert.risk_level === "high"
        const Icon = urgent ? AlertTriangle : Info
        return (
          <li
            key={alert.id}
            role={urgent ? "alert" : undefined}
            className={cn("flex gap-3 px-5 py-4 rounded-[20px] border", st.box)}
          >
            <Icon size={20} className={cn("shrink-0 mt-[3px]", st.icon)} aria-hidden />
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", st.icon)}>{st.label}</p>
              <p className="mt-0.5 text-[17px] font-medium text-[var(--ink)]">{alert.title_zh}</p>
              <p className="mt-1 text-[15px] text-[var(--ink-2)]">{alert.description_zh}</p>
              {alert.recommendation && (
                <p className="mt-2 text-[15px] text-[var(--ink)]">
                  <span className="text-[var(--ink-3)]">建議：</span>{alert.recommendation}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
