"use client"
import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { BreathOrb } from "@/components/ui/BreathOrb"
import { cn } from "@/lib/utils"
import type { AnalysisResult } from "@/types/analysis"
import { api } from "@/lib/api"

const STAGES = ["讀取你的數據", "比對參考範圍與安全規則", "整理西醫與中醫的觀點", "完成"]

interface StreamingAnalysisProps {
  sessionId: string
  onComplete: (result: AnalysisResult) => void
  onError: (error: string) => void
}

export function StreamingAnalysis({ sessionId, onComplete, onError }: StreamingAnalysisProps) {
  const [received, setReceived] = useState(0)
  const [phase, setPhase] = useState<"connecting" | "streaming" | "done">("connecting")

  useEffect(() => {
    const controller = new AbortController()
    let settled = false
    const fail = (msg: string) => {
      if (settled || controller.signal.aborted) return
      settled = true
      onError(msg)
    }

    const handle = (data: { error?: string; done?: boolean; result?: AnalysisResult; chunk?: string }) => {
      if (data.error) return fail(data.error)
      if (data.done && data.result) {
        settled = true
        setPhase("done")
        onComplete(data.result)
        return
      }
      if (data.chunk) setReceived((n) => n + data.chunk!.length)
    }

    ;(async () => {
      try {
        const res = await api.streamAnalysis(sessionId, controller.signal)
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => null) as { detail?: string } | null
          return fail(err?.detail ?? "無法開始分析，請稍後再試")
        }
        setPhase("streaming")
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ""
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += value
          // SSE events are separated by a blank line; keep any partial event in the buffer.
          const events = buffer.split("\n\n")
          buffer = events.pop() ?? ""
          for (const ev of events) {
            const line = ev.split("\n").find((l) => l.startsWith("data: "))
            if (!line) continue
            try {
              handle(JSON.parse(line.slice(6)))
            } catch {
              // ignore a malformed event
            }
          }
        }
        if (!settled) fail("分析連線中斷，請再試一次")
      } catch {
        fail("分析連線中斷，請再試一次")
      }
    })()

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const stage = phase === "connecting" ? 0 : phase === "streaming" ? (received > 0 ? 2 : 1) : 3

  return (
    <div
      className="rounded-[28px] bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow-soft)] px-6 py-10 sm:py-12 flex flex-col items-center text-center"
      aria-live="polite"
    >
      <BreathOrb guide className="w-40 sm:w-48" />
      <h1 className="mt-6 text-2xl text-[var(--ink)]">正在整理你的報告</h1>
      <p className="mt-2 text-[15px] text-[var(--ink-3)] max-w-[26em]">
        大約需要半分鐘。等待的時候，跟著圓圈慢慢呼吸。
      </p>
      <ol className="mt-8 w-full max-w-xs space-y-3 text-left">
        {STAGES.map((label, i) => (
          <li key={label} className="flex items-center gap-3 text-[15px]">
            <span
              className={cn(
                "grid place-items-center w-6 h-6 rounded-full shrink-0",
                i < stage && "bg-[var(--primary)] text-[var(--surface)]",
                i === stage && "border-2 border-[var(--primary)]",
                i > stage && "border-2 border-[var(--line-2)]",
              )}
            >
              {i < stage && <Check size={14} strokeWidth={3} aria-hidden />}
              {i === stage && <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />}
            </span>
            <span className={i <= stage ? "text-[var(--ink)]" : "text-[var(--ink-4)]"}>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
