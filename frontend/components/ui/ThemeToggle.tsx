"use client"
import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

type Theme = "light" | "dark"

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") root.setAttribute("data-theme", "dark")
  else root.removeAttribute("data-theme")
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = localStorage.getItem("theme") === "dark" ? "dark" : "light"
      setTheme(stored)
      applyTheme(stored)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    applyTheme(next)
    localStorage.setItem("theme", next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="切換深色模式"
      className={`w-10 h-10 rounded-xl flex items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)] transition ${className}`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
