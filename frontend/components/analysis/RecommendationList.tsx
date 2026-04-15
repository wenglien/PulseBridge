"use client"
import { useState } from "react"
import type { HealthRecommendation } from "@/types/analysis"
import { cn, categoryLabel } from "@/lib/utils"
import { RECOMMENDATION_CATEGORIES } from "@/lib/constants"

interface RecommendationListProps {
  recommendations: HealthRecommendation[]
}

export function RecommendationList({ recommendations }: RecommendationListProps) {
  const [activeTab, setActiveTab] = useState("diet")

  const byCat = RECOMMENDATION_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = recommendations.filter((r) => r.category === cat)
    return acc
  }, {} as Record<string, HealthRecommendation[]>)

  const tabsWithData = RECOMMENDATION_CATEGORIES.filter((c) => byCat[c].length > 0)

  if (!recommendations.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <p className="text-gray-400 text-sm text-center py-8">暫無調養建議</p>
      </div>
    )
  }

  const active = activeTab as (typeof RECOMMENDATION_CATEGORIES)[number]

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">調養建議</p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {tabsWithData.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all duration-200",
              activeTab === cat
                ? "bg-[#0D7A66] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900",
            )}
          >
            <span>{categoryLabel(cat)}</span>
            <span className="text-xs opacity-70">({byCat[cat].length})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {(byCat[active] ?? []).map((rec, i) => (
          <div
            key={i}
            className="flex gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <div className="flex-shrink-0 mt-0.5">
              <span
                className={cn(
                  "inline-block w-2 h-2 rounded-full mt-1",
                  rec.priority === "high" ? "bg-red-500" :
                  rec.priority === "medium" ? "bg-amber-500" :
                  "bg-[#0D7A66]",
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-medium text-gray-900">{rec.title_zh}</p>
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-md",
                  rec.evidence_basis === "tcm" ? "bg-[#FEF3DC] text-[#855D16]" :
                  rec.evidence_basis === "western" ? "bg-blue-50 text-blue-700" :
                  "bg-[#E8F5F2] text-[#0D7A66]",
                )}>
                  {rec.evidence_basis === "tcm" ? "中醫" : rec.evidence_basis === "western" ? "西醫" : "整合"}
                </span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{rec.content_zh}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
