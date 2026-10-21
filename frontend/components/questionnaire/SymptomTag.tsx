"use client"
import { cn } from "@/lib/utils"
import type { SymptomSeverity } from "@/types/questionnaire"

interface SymptomTagProps {
  label: string
  value: SymptomSeverity
  onChange: (v: SymptomSeverity) => void
}

const LEVELS: { v: SymptomSeverity; label: string; active: string }[] = [
  { v: 0, label: "無", active: "bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-soft)]" },
  { v: 1, label: "輕", active: "bg-amber-200 text-[var(--ink)]" },
  { v: 2, label: "中", active: "bg-orange-300 text-[var(--ink)]" },
  { v: 3, label: "重", active: "bg-[var(--brick)] text-white" },
]

/** One symptom with an explicit 無／輕／中／重 choice (a radio group). */
export function SymptomTag({ label, value, onChange }: SymptomTagProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center justify-between gap-3 py-3"
    >
      <span className={cn("text-[15px]", value > 0 ? "text-[var(--ink)] font-medium" : "text-[var(--ink-2)]")}>
        {label}
      </span>
      <div className="flex shrink-0 rounded-full bg-[var(--wash-2)] p-1">
        {LEVELS.map((l) => {
          const checked = value === l.v
          return (
            <button
              key={l.v}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${label}：${["無", "輕微", "中等", "嚴重"][l.v]}`}
              onClick={() => onChange(l.v)}
              className={cn(
                "w-10 sm:w-11 min-h-9 justify-center rounded-full text-sm transition-colors",
                checked ? l.active : "text-[var(--ink-4)] hover:text-[var(--ink)]",
              )}
            >
              {l.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
