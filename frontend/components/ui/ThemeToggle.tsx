"use client"
import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"

type Theme = "light" | "dark"

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") root.setAttribute("data-theme", "dark")
  else root.removeAttribute("data-theme")
}

// The inline script in app/layout.tsx applies the stored theme before
// hydration, so the <html data-theme> attribute is the source of truth.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  return () => observer.disconnect()
}

const getTheme = (): Theme =>
  document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore<Theme>(subscribe, getTheme, () => "light")

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    applyTheme(next)
    try {
      localStorage.setItem("theme", next)
    } catch {
      // storage unavailable (private mode) — theme still applies for this visit
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "切換為淺色模式" : "切換為深色模式"}
      className={`w-10 h-10 rounded-lg flex items-center justify-center text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--wash)] transition-colors ${className}`}
    >
      {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  )
}
