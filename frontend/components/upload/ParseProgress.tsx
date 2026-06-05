"use client"
import { useEffect, useState } from "react"
import { Spinner } from "@/components/ui/Spinner"

const STEPS = [
  "讀取 CSV 檔案...",
  "解析心電圖（ECG）分類...",
  "計算心率變異（HRV）指標...",
  "整合健康數據...",
]

interface ParseProgressProps {
  fileNames: string[]
  done?: boolean
}

export function ParseProgress({ fileNames, done }: ParseProgressProps) {
  const [step, setStep] = useState(0)
  const visibleStep = done ? STEPS.length : step

  useEffect(() => {
    if (done) return
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
    }, 600)
    return () => clearInterval(id)
  }, [done])

  return (
    <div className="space-y-5">
      <div className="px-4 py-3 rounded-lg bg-[#3D8B7A]/10 border border-[#3D8B7A]/30 space-y-1">
        {fileNames.map((name) => (
          <div key={name} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#3D8B7A] flex-shrink-0" />
            <p className="text-sm text-[var(--text-1)] font-mono truncate">{name}</p>
          </div>
        ))}
        <p className="text-xs text-[var(--text-3)] pt-0.5">正在處理...</p>
      </div>

      <div className="space-y-2">
        {STEPS.map((label, i) => {
          const isDone = i < visibleStep
          const isActive = i === visibleStep && !done
          return (
            <div
              key={label}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300 ${
                isDone ? "bg-[#3D8B7A]/10" : isActive ? "bg-[var(--surface-muted)]" : "opacity-30"
              }`}
            >
              <div className="w-5 h-5 flex-shrink-0">
                {isDone ? (
                  <div className="w-3 h-3 rounded-full bg-[#3D8B7A]" />
                ) : isActive ? (
                  <Spinner size="sm" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-[var(--border)] block" />
                )}
              </div>
              <span className={`text-sm ${isDone ? "text-[var(--text-2)]" : isActive ? "text-[var(--text-1)]" : "text-[var(--text-3)]"}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
