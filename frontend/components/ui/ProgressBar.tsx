"use client"
import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number       // 0–100
  label?: string
  color?: string
  className?: string
  showValue?: boolean
  /** 無法取得精確百分比時（例如 gzip 壓縮中） */
  indeterminate?: boolean
}

export function ProgressBar({
  value,
  label,
  color = "#3D8B7A",
  className,
  showValue,
  indeterminate = false,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className={cn("w-full", className)}>
      {(label || (showValue && !indeterminate)) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs text-gray-600">{label}</span>}
          {showValue && !indeterminate && (
            <span className="text-xs text-gray-700 font-medium">{pct.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden relative">
        {indeterminate ? (
          <div className="pb-indeterminate-bar" />
        ) : (
          <div
            className="h-full rounded-full transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        )}
      </div>
    </div>
  )
}
