import { cn } from "@/lib/utils"

type OrbTone = "calm" | "caution" | "urgent"

const TONES: Record<OrbTone, { core: string; halo: string }> = {
  calm:    { core: "var(--sage)",  halo: "var(--sand)" },
  caution: { core: "var(--honey)", halo: "var(--sand)" },
  urgent:  { core: "var(--brick)", halo: "var(--clay)" },
}

interface BreathOrbProps {
  tone?: OrbTone
  /** Show the 吸氣／吐氣 cue inside the orb. */
  guide?: boolean
  className?: string
}

/**
 * A slow 10 s breathing cycle (4 s in, 6 s out). Slow exhale-weighted
 * breathing measurably raises HRV, so the orb doubles as a tiny exercise.
 */
export function BreathOrb({ tone = "calm", guide = false, className }: BreathOrbProps) {
  const t = TONES[tone]
  return (
    <div className={cn("relative aspect-square", className)} aria-hidden={!guide}>
      <div
        className="breath absolute inset-0 rounded-full opacity-50"
        style={{ background: `radial-gradient(circle, color-mix(in oklab, ${t.halo} 70%, transparent) 30%, transparent 70%)` }}
      />
      <div
        className="breath absolute inset-[14%] rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${t.core} 55%, var(--surface)) 0%, ${t.core} 75%)`,
          animationDelay: "-.15s",
        }}
      />
      {guide && (
        <p className="absolute inset-0 grid place-items-center font-display text-lg text-white/95 [text-shadow:0_1px_6px_rgb(0_0_0/.18)]" aria-live="off">
          <span className="breath-in col-start-1 row-start-1">吸氣</span>
          <span className="breath-out col-start-1 row-start-1">吐氣</span>
        </p>
      )}
    </div>
  )
}
