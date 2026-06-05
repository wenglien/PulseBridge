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
          ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--border-mid)] hover:text-[var(--text-2)]"
          : "border-[var(--border-mid)] bg-[var(--surface-muted)] text-[var(--text-1)]",
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
