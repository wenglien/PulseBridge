"use client"
import { useEffect, useState } from "react"

type Theme = "light" | "dark"

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") root.setAttribute("data-theme", "dark")
  else root.removeAttribute("data-theme")
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) ?? "light"
    setTheme(stored)
    applyTheme(stored)
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
      className={`w-10 h-10 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--surface)] hover:opacity-80 transition ${className}`}
    >
      <span className="text-base" aria-hidden>
        {theme === "dark" ? "☀️" : "🌙"}
      </span>
    </button>
  )
}
