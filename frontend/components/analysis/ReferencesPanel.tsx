"use client"
import { ChevronDown } from "lucide-react"
import { refAnchor } from "@/components/analysis/CitationChips"

interface Props {
  references?: Record<string, string>
}

export function ReferencesPanel({ references }: Props) {
  if (!references || Object.keys(references).length === 0) return null
  const entries = Object.entries(references).sort(([a], [b]) => a.localeCompare(b))

  return (
    <details className="group rounded-[20px] border border-[var(--line)] bg-[var(--surface)] px-5 sm:px-6">
      <summary className="flex items-center justify-between gap-3 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="text-[15px] text-[var(--ink-2)]">這份報告引用的資料（{entries.length}）</span>
        <ChevronDown size={18} className="text-[var(--ink-4)] transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ol className="pb-5 space-y-2.5 text-sm text-[var(--ink-2)]">
        {entries.map(([code, text]) => (
          <li key={code} id={refAnchor(code)} className="scroll-mt-24 target:bg-[var(--sand-wash)] rounded-lg px-2 -mx-2 py-1">
            {text}
          </li>
        ))}
      </ol>
    </details>
  )
}
