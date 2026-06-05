"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/ui/ThemeToggle"

const NAV_LINKS = [
  { href: "/",              label: "首頁",    exact: true  },
  { href: "/upload",        label: "上傳資料", exact: false },
  { href: "/questionnaire", label: "症狀問卷", exact: false },
  { href: "/history",       label: "歷史紀錄", exact: false },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/90 shadow-sm backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D7A66] text-white shadow-sm shadow-[#0D7A66]/25">
            <Activity className="h-4 w-4" />
          </span>
          <span className="font-bold text-[var(--text-1)] text-base tracking-tight">
            Pulse<span className="text-[#0D7A66]">Bridge</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {NAV_LINKS.map((link) => {
            const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-[var(--surface-accent)] text-[#0D7A66] font-semibold"
                    : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-muted)]",
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <ThemeToggle />
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D7A66] text-white text-sm font-semibold hover:bg-[#1A9479] transition-colors shadow-sm shadow-[#0D7A66]/20"
          >
            開始分析
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile: compact CTA only (bottom nav handles navigation) */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle className="w-9 h-9" />
          <Link
            href="/upload"
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#0D7A66] text-white text-sm font-semibold hover:bg-[#1A9479] transition-colors"
          >
            開始分析
          </Link>
        </div>
      </div>
    </nav>
  )
}
