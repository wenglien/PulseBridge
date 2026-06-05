"use client"
import { cn } from "@/lib/utils"
import { type HTMLAttributes, forwardRef } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 shadow-[var(--shadow-card)]",
        glow && "ring-1 ring-[#0D7A66]/25 shadow-[0_18px_46px_rgba(13,122,102,0.13)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
)
Card.displayName = "Card"
