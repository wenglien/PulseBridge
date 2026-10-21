import Link from "next/link"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type FlowStep = "data" | "feel" | "report"

const STEPS: { id: FlowStep; label: string; href: string }[] = [
  { id: "data",   label: "匯入資料", href: "/upload" },
  { id: "feel",   label: "身體感受", href: "/questionnaire" },
  { id: "report", label: "你的報告", href: "/analysis" },
]

interface FlowStepsProps {
  current: FlowStep
  /** Steps the person chose to skip (e.g. no Apple Watch). */
  skipped?: FlowStep[]
  sessionId?: string | null
}

/** The three-step guide shown at the top of every page in the check-in flow. */
export function FlowSteps({ current, skipped = [], sessionId }: FlowStepsProps) {
  const currentIdx = STEPS.findIndex((s) => s.id === current)

  return (
    <nav aria-label="檢視進度" className="mb-8">
      <ol className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((step, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          const isSkipped = skipped.includes(step.id)
          const href = sessionId && step.id !== "data" ? `${step.href}?session=${sessionId}` : step.href
          const content = (
            <>
              <span
                className={cn(
                  "grid place-items-center w-7 h-7 rounded-full text-sm shrink-0 font-display",
                  active && "bg-[var(--primary)] text-[var(--surface)]",
                  done && !isSkipped && "bg-[var(--primary-wash)] text-[var(--primary)]",
                  (isSkipped || (!active && !done)) && "bg-[var(--wash-2)] text-[var(--ink-4)]",
                )}
              >
                {done && !isSkipped ? <Check size={15} strokeWidth={2.5} aria-hidden /> : i + 1}
              </span>
              <span className={cn(
                "text-sm whitespace-nowrap",
                active ? "text-[var(--ink)] font-medium" : "text-[var(--ink-3)]",
                "hidden sm:inline",
                active && "inline",
              )}>
                {step.label}
                {isSkipped && <span className="text-[var(--ink-4)]">（略過）</span>}
              </span>
            </>
          )
          return (
            <li key={step.id} className="flex items-center gap-2 sm:gap-3 min-w-0" aria-current={active ? "step" : undefined}>
              {done && !isSkipped ? (
                <Link href={href} className="flex items-center gap-2 min-h-0 hover:opacity-80">{content}</Link>
              ) : (
                <span className="flex items-center gap-2">{content}</span>
              )}
              {i < STEPS.length - 1 && (
                <span
                  className={cn("h-px w-6 sm:w-12", i < currentIdx ? "bg-[var(--primary-line)]" : "bg-[var(--line-2)]")}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
