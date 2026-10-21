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
  primary: "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--surface)]",
  secondary: "bg-[var(--surface)] hover:bg-[var(--wash)] text-[var(--ink)] border border-[var(--line-2)]",
  ghost: "hover:bg-[var(--wash)] text-[var(--ink-2)] hover:text-[var(--ink)]",
  danger: "bg-[var(--surface)] hover:bg-red-50 text-red-700 border border-red-300",
}

const sizes: Record<ButtonSize, string> = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-6 py-2.5 text-[15px]",
  lg: "px-8 py-3.5 text-base",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
      )}
      {children}
    </button>
  )
)
Button.displayName = "Button"
