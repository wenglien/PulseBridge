"use client"

interface Props {
  codes?: string[]
  references?: Record<string, string>
}

export function CitationChips({ codes, references }: Props) {
  if (!codes || codes.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {codes.map((c) => (
        <span
          key={c}
          title={references?.[c] ?? c}
          className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#E8F5F2] text-[#0D7A66] border border-[#9FD1C8] cursor-help"
        >
          [{c}]
        </span>
      ))}
    </div>
  )
}
