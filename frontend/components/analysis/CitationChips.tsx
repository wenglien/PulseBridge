"use client"
import { BookOpen } from "lucide-react"

interface Props {
  codes?: string[]
  references?: Record<string, string>
}

/** "Watson NF, et al. Recommended…" + code "AASM2017_Sleep" → "Watson NF 2017" */
export function citationLabel(code: string, text?: string): string {
  const year = code.match(/(19|20)\d{2}/)?.[0]
  const lead = text?.split(/[.,，。]/)[0]?.trim()
  if (lead && lead.length <= 24) return year ? `${lead} ${year}` : lead
  return code.replace(/_/g, " ")
}

export const refAnchor = (code: string) => `ref-${code.replace(/[^A-Za-z0-9]/g, "-")}`

export function CitationChips({ codes, references }: Props) {
  if (!codes || codes.length === 0) return null
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--ink-4)]">
      <BookOpen size={14} aria-hidden />
      <span className="sr-only">參考來源：</span>
      {codes.map((c) => (
        <a
          key={c}
          href={`#${refAnchor(c)}`}
          title={references?.[c] ?? c}
          // The source list is collapsed by default; open it so the jump lands.
          onClick={() => document.getElementById(refAnchor(c))?.closest("details")?.setAttribute("open", "")}
          className="text-link text-[var(--ink-3)] underline decoration-[var(--line-2)] underline-offset-4 hover:text-[var(--ink)] hover:decoration-[var(--ink-3)]"
        >
          {citationLabel(c, references?.[c])}
        </a>
      ))}
    </p>
  )
}
