import { cn } from "@/lib/utils"
import { type ButtonHTMLAttributes, forwardRef } from "react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[#0D7A66] hover:bg-[#1A9479] text-white border border-[#0D7A66] shadow-sm shadow-[#0D7A66]/15",
  secondary: "bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--text-1)] border border-[var(--border-mid)]",
  ghost: "hover:bg-[var(--surface-muted)] text-[var(--text-2)] hover:text-[var(--text-1)]",
  danger: "bg-[var(--surface)] hover:bg-red-50 text-red-600 border border-red-200",
}

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A66]/35",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
)
Button.displayName = "Button"
