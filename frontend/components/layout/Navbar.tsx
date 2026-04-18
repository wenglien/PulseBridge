"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
    <nav className="sticky top-0 z-50 bg-[var(--surface)] border-b border-[var(--border)] shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center flex-shrink-0">
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
                    ? "bg-[#E8F5F2] text-[#0D7A66] font-semibold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
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
            className="inline-flex items-center px-4 py-2 rounded-xl bg-[#0D7A66] text-white text-sm font-semibold hover:bg-[#1A9479] transition-colors shadow-sm"
          >
            開始分析
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
