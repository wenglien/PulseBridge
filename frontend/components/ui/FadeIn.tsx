import type { ReactNode } from "react"

/*
 * Entrance animations were removed in the redesign: content appears at once,
 * and the only orchestrated motion is the ECG trace on the home page.
 * These wrappers keep their old API so call sites stay unchanged.
 */

interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
  from?: "up" | "left" | "right" | "none"
  distance?: number
  once?: boolean
  duration?: number
}

export function FadeIn({ children, className }: FadeInProps) {
  return <div className={className}>{children}</div>
}

interface StaggerProps {
  children: ReactNode
  className?: string
  delay?: number
  stagger?: number
  once?: boolean
}

export function Stagger({ children, className }: StaggerProps) {
  return <div className={className}>{children}</div>
}

export function StaggerItem({ children, className }: Omit<FadeInProps, "delay" | "once">) {
  return <div className={className}>{children}</div>
}
