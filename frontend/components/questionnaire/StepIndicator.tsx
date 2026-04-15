import { cn } from "@/lib/utils"
import { QUESTIONNAIRE_STEPS } from "@/lib/constants"

interface StepIndicatorProps {
  currentStep: number
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {QUESTIONNAIRE_STEPS.map((step, i) => {
        const isDone = i < currentStep
        const isActive = i === currentStep
        return (
          <div key={step.id} className="flex items-center gap-1 sm:gap-2">
            <div className={cn(
              "flex items-center justify-center rounded-xl transition-all duration-300",
              "text-xs sm:text-sm font-medium",
              isActive
                ? "w-auto px-3 py-1.5 bg-[#0D7A66] text-white shadow-sm"
                : isDone
                ? "w-7 h-7 bg-[#E8F5F2] text-[#0D7A66]"
                : "w-7 h-7 bg-gray-100 text-gray-400",
            )}>
              {isDone ? (
                <div className="w-2 h-2 rounded-full bg-[#0D7A66]" />
              ) : isActive ? (
                <span className="hidden sm:inline">{step.label}</span>
              ) : (
                <span className="text-xs">{i + 1}</span>
              )}
            </div>
            {i < QUESTIONNAIRE_STEPS.length - 1 && (
              <div className={cn(
                "h-px w-4 sm:w-6 transition-colors duration-300",
                isDone ? "bg-[#0D7A66]/40" : "bg-gray-200",
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
