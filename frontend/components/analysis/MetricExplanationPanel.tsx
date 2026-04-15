"use client"
import { useState } from "react"
import type { MetricExplanation } from "@/types/analysis"
import { MetricRangeMeter } from "@/components/charts/MetricRangeMeter"
import { cn } from "@/lib/utils"

interface MetricExplanationPanelProps {
  items: MetricExplanation[]
}

function priorityStyle(priority: MetricExplanation["priority"]): string {
  if (priority === "high")   return "bg-red-50 text-red-700 border-red-200"
  if (priority === "medium") return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-[#E8F5F2] text-[#0D7A66] border-[#9FD1C8]"
}

function priorityLabel(priority: MetricExplanation["priority"]): string {
  if (priority === "high")   return "高優先"
  if (priority === "medium") return "中優先"
  return "低優先"
}

function priorityDot(priority: MetricExplanation["priority"]): string {
  if (priority === "high")   return "bg-red-500"
  if (priority === "medium") return "bg-amber-400"
  return "bg-[#0D7A66]"
}

export function MetricExplanationPanel({ items }: MetricExplanationPanelProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(
    // Auto-expand first high-priority item
    items.find((i) => i.priority === "high")?.metric_key ?? null,
  )

  if (!items.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">指標解讀與改善</p>
        <p className="text-sm text-gray-500">本次分析尚未產生逐項指標說明。</p>
      </div>
    )
  }

  const high   = items.filter((i) => i.priority === "high")
  const medium = items.filter((i) => i.priority === "medium")
  const low    = items.filter((i) => i.priority === "low")
  const sorted = [...high, ...medium, ...low]

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-400 uppercase tracking-wider">指標解讀與改善</p>
        <div className="flex gap-2 text-[10px]">
          {high.length   > 0 && <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-200">高優先 {high.length}</span>}
          {medium.length > 0 && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-200">中優先 {medium.length}</span>}
          {low.length    > 0 && <span className="px-2 py-0.5 bg-[#E8F5F2] text-[#0D7A66] rounded-full border border-[#9FD1C8]">低優先 {low.length}</span>}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((item) => {
          const isExpanded = expandedKey === item.metric_key
          return (
            <div
              key={item.metric_key}
              className={cn(
                "rounded-xl border transition-all duration-200",
                isExpanded ? "border-gray-300 bg-gray-50/80" : "border-gray-200 bg-gray-50/40",
              )}
            >
              {/* Header row (always visible) */}
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpandedKey(isExpanded ? null : item.metric_key)}
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", priorityDot(item.priority))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{item.metric_label_zh}</p>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-bold", priorityStyle(item.priority))}>
                      {priorityLabel(item.priority)}
                    </span>
                  </div>
                  {!isExpanded && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{item.interpretation_zh}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-700">
                    {item.current_value || "—"}
                  </span>
                  <span className="text-xs text-gray-400 select-none">{isExpanded ? "收起" : "展開"}</span>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-3">
                  {/* Range meter */}
                  <MetricRangeMeter metricKey={item.metric_key} currentValue={item.current_value} />

                  <div className="space-y-3">
                    {[
                      { label: "解讀",    text: item.interpretation_zh   },
                      { label: "代表意義", text: item.clinical_meaning_zh  },
                      { label: "改善目標", text: item.improvement_goal_zh  },
                    ].map(({ label, text }) => (
                      <div key={label}>
                        <p className="text-xs font-semibold text-gray-400 mb-1">{label}</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
                      </div>
                    ))}

                    {item.actionable_steps.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 mb-2">可採取行動</p>
                        <div className="flex flex-wrap gap-2">
                          {item.actionable_steps.map((step) => (
                            <span
                              key={step}
                              className="text-xs px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600"
                            >
                              {step}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
