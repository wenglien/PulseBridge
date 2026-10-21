"use client"
import { useState } from "react"
import type { HealthRecommendation } from "@/types/analysis"
import { cn, categoryIcon, categoryLabel } from "@/lib/utils"
import { RECOMMENDATION_CATEGORIES } from "@/lib/constants"
import { CitationChips } from "@/components/analysis/CitationChips"

interface RecommendationListProps {
  recommendations: HealthRecommendation[]
  references?: Record<string, string>
}

const ALL = "all"
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const
const BASIS = {
  tcm:         { label: "中醫", cls: "bg-[var(--sand-wash)] text-[var(--sand-deep)]" },
  western:     { label: "西醫", cls: "bg-[var(--mist-wash)] text-[var(--mist)]" },
  integrative: { label: "中西整合", cls: "bg-[var(--primary-wash)] text-[var(--primary)]" },
} as const

export function RecommendationList({ recommendations, references }: RecommendationListProps) {
  const [picked, setPicked] = useState<string>(ALL)

  if (!recommendations.length) {
    return (
      <div className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--ink-3)]">
        這次沒有額外的調養建議。
      </div>
    )
  }

  const cats = RECOMMENDATION_CATEGORIES.filter((c) => recommendations.some((r) => r.category === c))
  const shown = [...recommendations]
    .filter((r) => picked === ALL || r.category === picked)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  return (
    <div className="space-y-4">
      {cats.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="依類別篩選">
          {[ALL, ...cats].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={picked === c}
              onClick={() => setPicked(c)}
              className={cn(
                "px-4 rounded-full text-sm border transition-colors",
                picked === c
                  ? "bg-[var(--ink)] border-[var(--ink)] text-[var(--surface)]"
                  : "bg-[var(--surface)] border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--line-2)]",
              )}
            >
              {c === ALL ? "全部" : categoryLabel(c)}
            </button>
          ))}
        </div>
      )}

      <ul className="grid sm:grid-cols-2 gap-3">
        {shown.map((rec, i) => {
          const basis = BASIS[rec.evidence_basis as keyof typeof BASIS] ?? BASIS.integrative
          return (
            <li key={`${rec.title_zh}-${i}`} className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-3">
                <span
                  className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-[var(--sand-wash)] text-[var(--sand-deep)] font-display text-lg"
                  aria-hidden
                >
                  {categoryIcon(rec.category)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-[var(--ink-3)]">
                    {categoryLabel(rec.category)}
                    {rec.priority === "high" && <span className="ml-2 text-[var(--clay)]">優先</span>}
                  </p>
                  <h3 className="text-[17px] font-medium text-[var(--ink)]">{rec.title_zh}</h3>
                </div>
              </div>
              <p className="mt-3 text-[15px] text-[var(--ink-2)]">{rec.content_zh}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs", basis.cls)}>{basis.label}</span>
              </div>
              <CitationChips codes={rec.citations} references={references} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
