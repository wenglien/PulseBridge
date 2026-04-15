"use client"
import { cn, severityLabel, severityColor } from "@/lib/utils"
import type { SymptomSeverity } from "@/types/questionnaire"

interface SymptomTagProps {
  label: string
  value: SymptomSeverity
  onChange: (v: SymptomSeverity) => void
}

export function SymptomTag({ label, value, onChange }: SymptomTagProps) {
  const cycle = () => onChange(((value + 1) % 4) as SymptomSeverity)

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all duration-200 select-none w-full text-left",
        value === 0
          ? "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
          : "border-gray-300 bg-gray-50 text-gray-800",
      )}
    >
      <span
        className={cn(
          "w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors duration-200",
          severityColor(value),
        )}
      />
      <span>{label}</span>
      {value > 0 && (
        <span className={cn(
          "ml-auto text-xs px-1.5 py-0.5 rounded-md",
          value === 1 ? "bg-yellow-100 text-yellow-700" :
          value === 2 ? "bg-orange-100 text-orange-700" :
          "bg-red-100 text-red-700",
        )}>
          {severityLabel(value)}
        </span>
      )}
    </button>
  )
}
