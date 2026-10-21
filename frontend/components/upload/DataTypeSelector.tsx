"use client"
import { cn } from "@/lib/utils"

export const DATA_TYPE_OPTIONS = [
  { key: "hrv",               label: "HRV 心率變異",  desc: "SDNN 及逐拍 RR 間期" },
  { key: "heart_rate",        label: "心率",          desc: "每分鐘心跳記錄" },
  { key: "resting_hr",        label: "靜息心率",      desc: "每日靜息心率均值" },
  { key: "sleep",             label: "睡眠分析",      desc: "Core / Deep / REM 分層" },
  { key: "respiratory_rate",  label: "呼吸速率",      desc: "每分鐘呼吸次數" },
  { key: "oxygen_saturation", label: "血氧飽和度",    desc: "SpO₂ 百分比" },
  { key: "ecg",               label: "ECG 心電圖",    desc: "心電圖分類記錄" },
  { key: "wrist_temp",        label: "手腕溫度",      desc: "睡眠時手腕皮膚溫度" },
  { key: "vo2_max",           label: "VO₂ Max",       desc: "最大攝氧量估算" },
] as const

export type DataTypeKey = (typeof DATA_TYPE_OPTIONS)[number]["key"]

interface DataTypeSelectorProps {
  available:  string[]    // keys returned by scan
  selected:   string[]
  onChange:   (keys: string[]) => void
}

export function DataTypeSelector({ available, selected, onChange }: DataTypeSelectorProps) {
  const toggle = (key: string) => {
    onChange(
      selected.includes(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key],
    )
  }

  const selectAll = () => onChange(available)
  const clearAll  = () => onChange([])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-[var(--ink)]">要分析哪些資料？</h3>
          <p className="text-xs text-gray-500 mt-0.5">預設已選好檔案裡有的種類。灰色的代表檔案中沒有這項資料。</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium px-3 py-1.5 rounded-full border border-[var(--primary)]/35 bg-[var(--surface)] text-[var(--primary)] hover:bg-[var(--primary-wash)] hover:border-[var(--primary)]/55 transition-colors"
          >
            全選
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-[var(--surface)] text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            清除
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {DATA_TYPE_OPTIONS.map((opt) => {
          const isAvailable = available.includes(opt.key)
          const isSelected  = selected.includes(opt.key)

          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => isAvailable && toggle(opt.key)}
              disabled={!isAvailable}
              className={cn(
                "flex items-start gap-3 px-4 py-3 rounded-2xl border text-left transition-colors",
                isAvailable
                  ? isSelected
                    ? "border-[var(--primary)] bg-[var(--primary-wash)]"
                    : "border-gray-200 bg-[var(--surface)] hover:border-[var(--primary)]/35 hover:bg-gray-50/80"
                  : "border-gray-100 bg-gray-50/60 text-gray-400 opacity-75 cursor-not-allowed",
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded flex-shrink-0 mt-0.5 border-2 transition-colors",
                isSelected
                  ? "bg-[var(--primary)] border-[var(--primary)]"
                  : "border-gray-300 bg-[var(--surface)]",
                !isAvailable && "border-gray-200 bg-gray-100",
              )}>
                {isSelected && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--surface)]" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-gray-900" : "text-gray-800",
                  !isAvailable && "text-gray-500",
                )}>
                  {opt.label}
                  {!isAvailable && (
                    <span className="ml-1.5 text-xs font-normal text-gray-400">無資料</span>
                  )}
                </p>
                <p className={cn(
                  "text-xs mt-0.5",
                  isSelected ? "text-gray-600" : "text-gray-500",
                  !isAvailable && "text-gray-400",
                )}>{opt.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      {selected.length === 0 && (
        <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2 text-center">
          請至少選擇一個資料類型
        </p>
      )}
    </div>
  )
}
