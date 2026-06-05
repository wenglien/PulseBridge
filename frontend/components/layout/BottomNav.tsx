"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardCheck, Clock3, Home, UploadCloud } from "lucide-react"
import { cn } from "@/lib/utils"

const BOTTOM_NAV_LINKS = [
  {
    href: "/",
    label: "首頁",
    icon: Home,
    exact: true,
  },
  {
    href: "/upload",
    label: "上傳",
    icon: UploadCloud,
    exact: false,
  },
  {
    href: "/questionnaire",
    label: "問卷",
    icon: ClipboardCheck,
    exact: false,
  },
  {
    href: "/history",
    label: "紀錄",
    icon: Clock3,
    exact: false,
  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)]/95 border-t border-[var(--border)] pb-safe backdrop-blur-xl">
      <div className="grid grid-cols-4 h-16">
        {BOTTOM_NAV_LINKS.map((link) => {
          const Icon = link.icon
          const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href) && link.href !== "/"
            ? pathname.startsWith(link.href)
            : pathname === link.href

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                isActive
                  ? "text-[#0D7A66]"
                  : "text-[var(--text-3)] hover:text-[var(--text-2)]",
              )}
            >
              <span className={cn(
                "p-1 rounded-lg transition-colors",
                isActive ? "bg-[var(--surface-accent)]" : "",
              )}>
                <Icon className="h-5 w-5" />
              </span>
              <span>{link.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
