import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Right-aligned actions or meta (buttons, dates). */
  aside?: ReactNode
}

export function PageHeader({ title, description, aside }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-5 border-b border-[var(--line)]">
      <div className="min-w-0">
        <h1 className="text-3xl sm:text-4xl text-[var(--ink)]">{title}</h1>
        {description && (
          <div className="mt-2 max-w-[40em] text-[15px] text-[var(--ink-3)] leading-relaxed">{description}</div>
        )}
      </div>
      {aside && <div className="flex items-center gap-3 shrink-0">{aside}</div>}
    </header>
  )
}
