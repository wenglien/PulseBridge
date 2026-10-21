"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { API_BASE } from "@/lib/constants"
import { sessionHeaders } from "@/lib/api"
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
      content: "你好，我已經讀過你的報告。哪個數字看不懂、哪個建議不知道怎麼開始，都可以問我。",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll the message list itself — scrollIntoView would drag the whole page down to the chat.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
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
        headers: { "Content-Type": "application/json", ...sessionHeaders(sessionId) },
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
    <div className="flex flex-col bg-[var(--surface)] border border-[var(--line)] rounded-[24px] shadow-[var(--shadow-soft)] overflow-hidden">
      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 space-y-4 min-h-[300px] max-h-[460px]" aria-live="polite">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            {msg.role === "assistant" && (
              <span className="w-7 h-7 rounded-full bg-[var(--sage)] shrink-0 mt-1 shadow-[inset_-3px_-3px_0_color-mix(in_oklab,var(--primary)_55%,transparent)]" aria-hidden />
            )}
            <div
              className={cn(
                "max-w-[85%] px-4 py-3 rounded-[20px] text-[15px] whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-[var(--primary)] text-[var(--surface)] rounded-br-md"
                  : "bg-[var(--wash)] text-[var(--ink)] rounded-bl-md",
              )}
            >
              {msg.content || (msg.streaming && (
                <span className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-4)] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-4)] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-4)] animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              ))}
              {msg.streaming && msg.content && (
                <span className="inline-block w-0.5 h-4 bg-[var(--ink-4)] animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {[
            "我的 HRV 偏低要緊嗎？",
            "多久該再檢視一次？",
            "第一個建議要怎麼開始？",
            "什麼情況要去看醫生？",
          ].map((q) => (
            <button
              key={q}
              onClick={() => { setInput(q); textareaRef.current?.focus() }}
              type="button"
              className="text-sm px-4 rounded-full border border-[var(--line)] text-[var(--ink-2)] bg-[var(--surface)] hover:border-[var(--primary-line)] hover:text-[var(--primary)] transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 sm:px-4 py-3 border-t border-[var(--line)] flex gap-2 items-end">
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
          aria-label="輸入你的問題"
          placeholder="問問看這份報告…"
          className="flex-1 resize-none bg-[var(--wash)] border border-transparent rounded-[22px] px-4 py-2.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--primary-line)] disabled:opacity-50 overflow-hidden"
          style={{ minHeight: "44px" }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          type="button"
          aria-label="送出"
          className="flex-shrink-0 w-11 h-11 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed justify-center transition-colors"
        >
          {loading ? (
            <svg className="w-4 h-4 text-[var(--surface)] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-[var(--surface)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
