"use client"
import { Card } from "@/components/ui/Card"

interface Props {
  references?: Record<string, string>
}

export function ReferencesPanel({ references }: Props) {
  if (!references || Object.keys(references).length === 0) return null
  const entries = Object.entries(references).sort(([a], [b]) => a.localeCompare(b))

  return (
    <Card>
      <p className="text-xs text-gray-400 uppercase tracking-wider">參考文獻</p>
      <ol className="mt-2 space-y-1.5 text-xs text-gray-600 leading-relaxed list-none">
        {entries.map(([code, text]) => (
          <li key={code} className="flex gap-2">
            <span className="text-[#0D7A66] font-medium flex-shrink-0">[{code}]</span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}
