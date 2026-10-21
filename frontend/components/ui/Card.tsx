"use client"
import { cn } from "@/lib/utils"
import { type HTMLAttributes, forwardRef } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Emphasised card: soft sage tint for the one thing on a page that matters most. */
  glow?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[20px] border p-5 sm:p-6 shadow-[var(--shadow-soft)]",
        glow
          ? "bg-[var(--primary-wash)] border-[var(--primary-line)]"
          : "bg-[var(--surface)] border-[var(--line)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
)
Card.displayName = "Card"
