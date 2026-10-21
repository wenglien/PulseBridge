"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Minus, TrendingDown, TrendingUp } from "lucide-react"
import { api } from "@/lib/api"
import { METRICS, compare, formatDelta, metricValue } from "@/lib/metrics"
import { cn } from "@/lib/utils"
import type { Session } from "@/types/analysis"

const TREND_STYLE = {
  better: { cls: "text-[var(--good-deep)] bg-green-50", word: "變好" },
  worse:  { cls: "text-[var(--clay)] bg-orange-50", word: "變差" },
  same:   { cls: "text-[var(--ink-3)] bg-[var(--wash)]", word: "持平" },
} as const

/** "和上次比": the same headline numbers from this browser's previous completed check-in. */
export function CompareWithLast({ sessionId }: { sessionId: string }) {
  const [pair, setPair] = useState<{ now: Session; before: Session | null } | null>(null)

  useEffect(() => {
    api.getSessions()
      .then((list) => {
        const now = list.find((s) => s.session_id === sessionId)
        if (!now) return
        const before = list.find(
          (s) => s.session_id !== sessionId && s.status === "completed" && s.created_at < now.created_at,
        ) ?? null
        setPair({ now, before })
      })
      .catch(() => {})
  }, [sessionId])

  if (!pair) return null

  if (!pair.before) {
    return (
      <p className="rounded-[20px] bg-[var(--sand-wash)] px-5 py-4 text-[15px] text-[var(--ink-2)]">
        這是你的第一份報告。兩週後再做一次檢視，這裡會顯示和這次相比的變化。
      </p>
    )
  }

  const rows = METRICS.flatMap((def) => {
    const now = metricValue(pair.now.metrics, def.key)
    const before = metricValue(pair.before!.metrics, def.key)
    return now !== undefined && before !== undefined ? [{ def, now, before, ...compare(def, now, before) }] : []
  })
  if (!rows.length) return null

  const when = new Date(pair.before.created_at).toLocaleDateString("zh-TW", { month: "long", day: "numeric" })

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl text-[var(--ink)]">和上次比</h2>
          <p className="text-sm text-[var(--ink-3)] mt-0.5">上次檢視是 {when}</p>
        </div>
        <Link href={`/analysis?session=${pair.before.session_id}`} className="text-link text-sm text-[var(--primary)] underline underline-offset-4">
          打開上次的報告
        </Link>
      </div>
      <ul className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)] divide-y divide-[var(--line)]">
        {rows.map(({ def, now, before, delta, trend }) => {
          const Icon = trend === "same" ? Minus : delta > 0 ? TrendingUp : TrendingDown
          const st = TREND_STYLE[trend]
          return (
            <li key={def.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[10rem_1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5">
              <span className="text-[15px] text-[var(--ink)]">{def.label}</span>
              <span className="order-3 sm:order-none col-span-2 sm:col-span-1 text-sm text-[var(--ink-3)]">
                {def.format(before)} <span aria-hidden>→</span><span className="sr-only">變成</span>{" "}
                <span className="text-[var(--ink)] font-medium">{def.format(now)}</span>
              </span>
              <span className={cn("inline-flex items-center gap-1 justify-self-end rounded-full px-2.5 py-0.5 text-sm", st.cls)}>
                <Icon size={15} aria-hidden />
                {trend === "same" ? st.word : `${formatDelta(def, delta)}，${st.word}`}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
