"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { API_BASE } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "assistant"
  content: string
  streaming?: boolean
}

interface ChatPanelProps {
  sessionId: string
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "您好！我已閱讀您的健康分析報告，有任何疑問都可以問我。例如：「我的 HRV 數值正常嗎？」、「為什麼建議我多做有氧運動？」",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: "user", content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    // placeholder for streaming assistant reply
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }])

    try {
      const res = await fetch(`${API_BASE}/api/analysis/chat/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error("伺服器回應錯誤")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let assistantContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === "[DONE]") continue
          try {
            const data = JSON.parse(raw) as { chunk?: string; done?: boolean; error?: string }
            if (data.error) throw new Error(data.error)
            if (data.chunk) {
              assistantContent += data.chunk
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                  streaming: true,
                }
                return updated
              })
            }
            if (data.done) break
          } catch {
            continue
          }
        }
      }

      // finalize — remove streaming flag
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: "assistant", content: assistantContent }
        return updated
      })
    } catch (e) {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: "assistant",
          content: `抱歉，發生錯誤：${e instanceof Error ? e.message : "未知錯誤"}`,
        }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, sessionId])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full bg-[#E8F5F2] flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#0D7A66]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">AI 追問助理</p>
          <p className="text-xs text-gray-400">根據您的報告回答問題</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-400">已讀取報告</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-[280px] max-h-[420px]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-[#E8F5F2] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[#0D7A66] text-xs font-bold">AI</span>
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-[#0D7A66] text-white rounded-tr-sm"
                  : "bg-gray-50 text-gray-800 border border-gray-200 rounded-tl-sm",
              )}
            >
              {msg.content || (msg.streaming && (
                <span className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              ))}
              {msg.streaming && msg.content && (
                <span className="inline-block w-0.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-gray-600 text-xs font-bold">我</span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {[
            "我的 HRV 數值代表什麼？",
            "我應該多久追蹤一次？",
            "這些建議要怎麼開始執行？",
            "我的風險等級嚴重嗎？",
          ].map((q) => (
            <button
              key={q}
              onClick={() => { setInput(q); textareaRef.current?.focus() }}
              className="text-xs px-3 py-1.5 rounded-full border border-[#9FD1C8] text-[#0D7A66] bg-[#E8F5F2] hover:bg-[#d3ede8] transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            e.target.style.height = "auto"
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
          }}
          onKeyDown={handleKey}
          disabled={loading}
          placeholder="輸入問題，按 Enter 送出（Shift+Enter 換行）"
          className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0D7A66] focus:ring-1 focus:ring-[#0D7A66]/20 disabled:opacity-50 transition-all overflow-hidden"
          style={{ minHeight: "42px" }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#0D7A66] hover:bg-[#1A9479] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          {loading ? (
            <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
