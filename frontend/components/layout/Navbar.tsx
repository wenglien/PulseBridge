"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { UserRound } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

const FLOW_PATHS = ["/upload", "/questionnaire", "/analysis"]

const NAV_LINKS = [
  { href: "/",        label: "首頁",     match: (p: string) => p === "/" },
  { href: "/upload",  label: "開始檢視", match: (p: string) => FLOW_PATHS.some((f) => p.startsWith(f)) },
  { href: "/history", label: "我的報告", match: (p: string) => p.startsWith("/history") },
]

export function Navbar() {
  const pathname = usePathname()
  const auth = useAuth()

  return (
    <nav className="sticky top-0 z-50 bg-[var(--bg)]/85 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0" aria-label="脈橋 PulseBridge 首頁">
          <span className="w-6 h-6 rounded-full bg-[var(--sage)] shadow-[inset_-3px_-3px_0_color-mix(in_oklab,var(--primary)_60%,transparent)]" aria-hidden />
          <span className="font-display text-xl leading-none text-[var(--ink)]">脈橋</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = link.match(pathname)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "px-4 py-2 rounded-full text-[15px] transition-colors",
                  active
                    ? "bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-soft)]"
                    : "text-[var(--ink-3)] hover:text-[var(--ink)]",
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/account"
            aria-label={auth ? `帳號：${auth.email}` : "登入"}
            aria-current={pathname.startsWith("/account") ? "page" : undefined}
            className={cn(
              "h-10 rounded-full justify-center gap-1.5 text-[15px] transition-colors",
              auth
                ? "w-10 bg-[var(--primary-wash)] text-[var(--primary)]"
                : "px-4 text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--wash)]",
            )}
          >
            {auth ? <span className="font-display text-base uppercase">{auth.email[0]}</span> : <><UserRound size={17} aria-hidden />登入</>}
          </Link>
        </div>
      </div>
    </nav>
  )
}
