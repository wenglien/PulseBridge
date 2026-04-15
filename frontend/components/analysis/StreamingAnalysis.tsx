"use client"
import { useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/ui/Spinner"
import type { AnalysisResult } from "@/types/analysis"
import { api } from "@/lib/api"

interface StreamingAnalysisProps {
  sessionId: string
  onComplete: (result: AnalysisResult) => void
  onError: (error: string) => void
}

export function StreamingAnalysis({ sessionId, onComplete, onError }: StreamingAnalysisProps) {
  const [text, setText] = useState("")
  const [phase, setPhase] = useState<"connecting" | "streaming" | "done">("connecting")
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const url = api.getAnalysisStreamUrl(sessionId)
    const es = new EventSource(url)

    es.onopen = () => setPhase("streaming")

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.error) {
          onError(data.error)
          es.close()
          return
        }
        if (data.done && data.result) {
          setPhase("done")
          onComplete(data.result as AnalysisResult)
          es.close()
          return
        }
        if (data.chunk) {
          setText((prev) => prev + data.chunk)
          setTimeout(() => {
            textRef.current?.scrollTo({ top: textRef.current.scrollHeight, behavior: "smooth" })
          }, 50)
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      if (phase !== "done") {
        onError("分析連接中斷，請重試")
        es.close()
      }
    }

    return () => es.close()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        {phase !== "done" && <Spinner size="sm" />}
        {phase === "done" && <div className="w-2 h-2 rounded-full bg-green-500" />}
        <div>
          <p className="text-sm font-medium text-gray-900">
            {phase === "connecting" ? "連接 AI 分析引擎..." :
             phase === "streaming" ? "正在生成中西醫整合分析..." :
             "分析完成！"}
          </p>
          <p className="text-xs text-gray-400">Claude AI · 中西醫整合模型</p>
        </div>
      </div>

      {text && (
        <div
          ref={textRef}
          className="max-h-64 overflow-y-auto rounded-xl bg-gray-50 border border-gray-200 p-4"
        >
          <pre
            className={`text-sm text-gray-600 font-mono whitespace-pre-wrap leading-relaxed ${phase === "streaming" ? "cursor-blink" : ""}`}
          >
            {text}
          </pre>
        </div>
      )}

      {phase === "connecting" && (
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`h-3 rounded-full bg-gray-200 ${i % 2 === 0 ? "w-full" : "w-3/4"}`} />
          ))}
        </div>
      )}
    </div>
  )
}
