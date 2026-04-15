"use client"
import { motion } from "framer-motion"
import type { ReactNode } from "react"

interface FadeInProps {
  children: ReactNode
  className?: string
  /** delay in seconds */
  delay?: number
  /** slide direction: "up" (default) | "left" | "right" | "none" */
  from?: "up" | "left" | "right" | "none"
  /** how far to slide (px) */
  distance?: number
  /** re-animate every time it enters viewport, or only once */
  once?: boolean
  duration?: number
}

export function FadeIn({
  children,
  className,
  delay = 0,
  from = "up",
  distance = 24,
  once = true,
  duration = 0.55,
}: FadeInProps) {
  const initial = {
    opacity: 0,
    y: from === "up"    ?  distance : from === "none" ? 0 : 0,
    x: from === "left"  ? -distance : from === "right" ? distance : 0,
  }

  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once, amount: 0.12 }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** Wraps a list of children and staggers their fade-in */
interface StaggerProps {
  children: ReactNode
  className?: string
  stagger?: number   // seconds between each child
  delay?: number
  once?: boolean
}

export function Stagger({
  children,
  className,
  stagger = 0.08,
  delay = 0,
  once = true,
}: StaggerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.1 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Must be a direct child of <Stagger> */
export function StaggerItem({
  children,
  className,
  from = "up",
  distance = 20,
  duration = 0.5,
}: Omit<FadeInProps, "delay" | "once">) {
  const initial = {
    opacity: 0,
    y: from === "up"   ?  distance : 0,
    x: from === "left" ? -distance : from === "right" ? distance : 0,
  }
  return (
    <motion.div
      className={className}
      variants={{
        hidden: initial,
        visible: { opacity: 1, y: 0, x: 0, transition: { duration, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  )
}
