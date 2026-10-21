"use client"
import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { HRVReferenceRange, MetricExplanation } from "@/types/analysis"
import { MetricRangeMeter } from "@/components/charts/MetricRangeMeter"
import { CitationChips } from "@/components/analysis/CitationChips"
import { cn } from "@/lib/utils"

interface MetricExplanationPanelProps {
  items: MetricExplanation[]
  references?: Record<string, string>
  hrvReference?: HRVReferenceRange | null
}

const PRIORITY: Record<MetricExplanation["priority"], { label: string; dot: string }> = {
  high:   { label: "優先改善", dot: "bg-[var(--clay)]" },
  medium: { label: "值得留意", dot: "bg-[var(--honey)]" },
  low:    { label: "維持即可", dot: "bg-[var(--sage)]" },
}
const ORDER = { high: 0, medium: 1, low: 2 } as const

export function MetricExplanationPanel({ items, references, hrvReference }: MetricExplanationPanelProps) {
  const sorted = [...items].sort((a, b) => ORDER[a.priority] - ORDER[b.priority])
  const [open, setOpen] = useState<string | null>(sorted[0]?.metric_key ?? null)

  if (!items.length) {
    return (
      <div className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--ink-3)]">
        這次沒有產生逐項的指標說明。
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {sorted.map((item) => {
        const isOpen = open === item.metric_key
        const p = PRIORITY[item.priority] ?? PRIORITY.low
        const panelId = `metric-${item.metric_key}`
        return (
          <li key={item.metric_key} className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : item.metric_key)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-[var(--ink-3)]">
                  <span className={cn("w-2 h-2 rounded-full", p.dot)} aria-hidden />
                  {p.label}
                </div>
                <p className="mt-0.5 text-[17px] font-medium text-[var(--ink)]">{item.metric_label_zh}</p>
                {!isOpen && <p className="text-sm text-[var(--ink-3)] mt-0.5 truncate">{item.interpretation_zh}</p>}
              </div>
              <span className="font-display text-2xl text-[var(--ink)] whitespace-nowrap">{item.current_value || "—"}</span>
              <ChevronDown
                size={18}
                className={cn("text-[var(--ink-4)] shrink-0 transition-transform", isOpen && "rotate-180")}
                aria-hidden
              />
            </button>

            {isOpen && (
              <div id={panelId} className="px-5 pb-5 space-y-5">
                <MetricRangeMeter metricKey={item.metric_key} currentValue={item.current_value} reference={hrvReference} />
                <dl className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "你目前的狀態", text: item.interpretation_zh },
                    { label: "這代表什麼", text: item.clinical_meaning_zh },
                    { label: "改善目標", text: item.improvement_goal_zh },
                  ].map(({ label, text }) => (
                    <div key={label}>
                      <dt className="text-sm text-[var(--ink-3)]">{label}</dt>
                      <dd className="mt-1 text-[15px] text-[var(--ink)]">{text}</dd>
                    </div>
                  ))}
                </dl>
                {item.actionable_steps.length > 0 && (
                  <div className="rounded-2xl bg-[var(--primary-wash)] px-4 py-3">
                    <p className="text-sm text-[var(--primary)]">可以這樣做</p>
                    <ul className="mt-1.5 space-y-1">
                      {item.actionable_steps.map((step) => (
                        <li key={step} className="flex gap-2 text-[15px] text-[var(--ink)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--sage)] shrink-0 mt-[11px]" aria-hidden />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <CitationChips codes={item.citations} references={references} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
