"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Leaf, NotebookText } from "lucide-react"
import { cn } from "@/lib/utils"

const FLOW_PATHS = ["/upload", "/questionnaire", "/analysis"]

const LINKS = [
  { href: "/",        label: "首頁",     Icon: Home,         match: (p: string) => p === "/" },
  { href: "/upload",  label: "開始檢視", Icon: Leaf,         match: (p: string) => FLOW_PATHS.some((f) => p.startsWith(f)) },
  { href: "/history", label: "我的報告", Icon: NotebookText, match: (p: string) => p.startsWith("/history") },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--line)] pb-safe">
      <div className="grid grid-cols-3 h-16">
        {LINKS.map(({ href, label, Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                active ? "text-[var(--primary)]" : "text-[var(--ink-4)]",
              )}
            >
              <span className={cn("px-4 py-1 rounded-full", active && "bg-[var(--primary-wash)]")}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              </span>
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
