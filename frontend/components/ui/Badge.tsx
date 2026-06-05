import { cn } from "@/lib/utils"

type BadgeVariant = "default" | "jade" | "gold" | "red" | "muted"

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  default: "bg-[var(--surface-muted)] text-[var(--text-2)]",
  jade: "bg-[#E8F5F2] text-[#0D7A66] border border-[#9FD1C8]",
  gold: "bg-[#FEF3DC] text-[#855D16] border border-[#D4A54A]",
  red: "bg-red-50 text-red-600 border border-red-200",
  muted: "bg-[var(--surface-muted)] text-[var(--text-2)]",
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      variants[variant],
      className,
    )}>
      {children}
    </span>
  )
}
