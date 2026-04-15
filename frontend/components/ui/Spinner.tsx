import { cn } from "@/lib/utils"

interface SpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizes = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12" }

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      className={cn(
        "inline-block border-2 border-gray-200 border-t-[#0D7A66] rounded-full animate-spin",
        sizes[size],
        className,
      )}
    />
  )
}
