import { cn } from "@/lib/utils"

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl"
}

const maxWidths = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  "2xl": "max-w-7xl",
}

export function PageWrapper({ children, className, maxWidth = "xl" }: PageWrapperProps) {
  return (
    <main className={cn("min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)] px-4 sm:px-6 py-6 sm:py-8", className)}>
      <div className={cn("mx-auto", maxWidths[maxWidth])}>
        {children}
      </div>
    </main>
  )
}
