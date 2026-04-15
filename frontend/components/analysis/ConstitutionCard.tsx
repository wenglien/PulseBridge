import type { ConstitutionType, ConstitutionScore } from "@/types/analysis"
import {
  constitutionColor,
  constitutionCommonFeelings,
  constitutionDescription,
  constitutionQuickActions,
} from "@/lib/utils"
import { Badge } from "@/components/ui/Badge"
import { ProgressBar } from "@/components/ui/ProgressBar"

interface ConstitutionCardProps {
  primary: ConstitutionType
  secondary: ConstitutionType | null
  scores: ConstitutionScore[]
}

export function ConstitutionCard({ primary, secondary, scores }: ConstitutionCardProps) {
  const primaryScore = scores.find((s) => s.type === primary)
  const secondaryScore = secondary ? scores.find((s) => s.type === secondary) : null
  const primaryFeelings = constitutionCommonFeelings(primary)
  const primaryActions = constitutionQuickActions(primary)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Primary */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">主要體質</p>
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ backgroundColor: constitutionColor(primary) + "18", border: `1px solid ${constitutionColor(primary)}30` }}
          >
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: constitutionColor(primary) }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className="text-2xl font-bold"
                style={{ color: constitutionColor(primary) }}
              >
                {primary}
              </h2>
              {primaryScore && (
                <Badge variant="jade">{primaryScore.score.toFixed(0)} 分</Badge>
              )}
            </div>
            <p className="text-gray-500 text-sm mt-2 leading-relaxed">
              {constitutionDescription(primary)}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              體質是傾向，不是診斷；可透過作息與生活習慣逐步改善。
            </p>
            {primaryScore?.key_indicators?.length ? (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {primaryScore.key_indicators.map((ind) => (
                  <span key={ind} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {ind}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200 space-y-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">你可能常有的感受</p>
          <div className="flex flex-wrap gap-2">
            {primaryFeelings.map((item) => (
              <span key={item} className="text-xs px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-700">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">你可以先做這三件事</p>
          <div className="space-y-1.5">
            {primaryActions.map((item, idx) => (
              <p key={item} className="text-sm text-gray-700 leading-relaxed">
                <span className="font-semibold text-[#0D7A66] mr-1">{idx + 1}.</span>
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary */}
      {secondary && secondaryScore && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">次要體質</p>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: constitutionColor(secondary) + "15" }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: constitutionColor(secondary) }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold" style={{ color: constitutionColor(secondary) }}>
                  {secondary}
                </span>
                <Badge variant="muted">{secondaryScore.score.toFixed(0)} 分</Badge>
              </div>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed line-clamp-2">
                {constitutionDescription(secondary)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All scores mini bars */}
      <div className="pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">九種體質分數</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {scores.map((s) => (
            <ProgressBar
              key={s.type}
              label={s.type}
              value={s.score}
              color={constitutionColor(s.type)}
              showValue
            />
          ))}
        </div>
      </div>
    </div>
  )
}
