"use client"
import type { RiskLevel } from "@/types/analysis"

interface Props {
  riskLevel: RiskLevel
  score?: number
}

const RISK_CONFIG: Record<RiskLevel, { color: string; label: string; defaultScore: number }> = {
  low:      { color: "#0D7A66", label: "低風險",   defaultScore: 15 },
  medium:   { color: "#F59E0B", label: "中度風險",  defaultScore: 50 },
  high:     { color: "#F97316", label: "高風險",   defaultScore: 75 },
  critical: { color: "#DC2626", label: "嚴重風險",  defaultScore: 92 },
}

// Background zone ranges (0–100) and their fill colours
const ZONES = [
  { from: 0,  to: 33,  fill: "#DCFCE7" },
  { from: 33, to: 67,  fill: "#FEF3C7" },
  { from: 67, to: 100, fill: "#FEE2E2" },
]

// SVG canvas
const CX = 100
const CY = 97        // arc centre (sits near the bottom of the viewBox)
const R_OUT = 84     // outer radius
const R_IN  = 54     // inner radius

/**
 * Converts a gauge percentage (0 = leftmost, 100 = rightmost)
 * to an (x, y) point on a semicircle centred at (CX, CY).
 *
 * Angles go from 180° (left / 9 o'clock) to 0° (right / 3 o'clock)
 * through the top (90° / 12 o'clock).
 *   angle_rad = π × (1 − pct/100)
 */
function pt(r: number, pct: number) {
  const a = Math.PI * (1 - pct / 100)
  return {
    x: +(CX + r * Math.cos(a)).toFixed(3),
    y: +(CY - r * Math.sin(a)).toFixed(3),
  }
}

/**
 * Builds an SVG path for an annular sector between two percentages.
 * Outer arc goes clockwise (sweep=1), inner arc goes counterclockwise (sweep=0).
 */
function sector(p1: number, p2: number, rIn: number, rOut: number): string {
  const os = pt(rOut, p1), oe = pt(rOut, p2)
  const is = pt(rIn,  p1), ie = pt(rIn,  p2)
  const lg = p2 - p1 > 50 ? 1 : 0
  return [
    `M ${os.x} ${os.y}`,
    `A ${rOut} ${rOut} 0 ${lg} 1 ${oe.x} ${oe.y}`,
    `L ${ie.x} ${ie.y}`,
    `A ${rIn} ${rIn} 0 ${lg} 0 ${is.x} ${is.y}`,
    "Z",
  ].join(" ")
}

export function RiskArcGauge({ riskLevel, score }: Props) {
  const cfg = RISK_CONFIG[riskLevel]
  const val = Math.min(100, Math.max(0, score ?? cfg.defaultScore))

  // Needle tip position
  const tip = pt(R_OUT - 10, val)

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Pure-SVG gauge — no recharts, no z-index fights */}
      <svg
        viewBox="0 0 200 104"
        className="w-full max-w-[240px]"
        aria-label={`風險分數 ${val}，${cfg.label}`}
      >
        {/* ── Background zone sectors ── */}
        {ZONES.map((z) => (
          <path key={z.from} d={sector(z.from, z.to, R_IN, R_OUT)} fill={z.fill} />
        ))}

        {/* ── Value fill sector ── */}
        {val > 0 && (
          <path
            d={sector(0, val, R_IN + 4, R_OUT - 4)}
            fill={cfg.color}
            opacity={0.88}
          />
        )}

        {/* ── Divider ticks at zone boundaries ── */}
        {[33, 67].map((p) => {
          const outer = pt(R_OUT + 2, p)
          const inner = pt(R_IN - 2, p)
          return (
            <line
              key={p}
              x1={outer.x} y1={outer.y}
              x2={inner.x} y2={inner.y}
              stroke="white" strokeWidth={1.5} strokeOpacity={0.6}
            />
          )
        })}

        {/* ── Needle ── */}
        <line
          x1={CX} y1={CY}
          x2={tip.x} y2={tip.y}
          stroke={cfg.color}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={5} fill={cfg.color} />
        <circle cx={CX} cy={CY} r={2.5} fill="white" />

        {/* ── Centre text (score + label) — always on top ── */}
        <text
          x={CX} y={CY - 18}
          textAnchor="middle"
          fontSize="26"
          fontWeight="700"
          fill={cfg.color}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {val}
        </text>
        <text
          x={CX} y={CY - 4}
          textAnchor="middle"
          fontSize="9"
          fill="#9CA3AF"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          風險分數
        </text>

        {/* ── Edge labels ── */}
        <text x={CX - R_OUT - 2} y={CY + 14} textAnchor="middle" fontSize="8" fill="#9CA3AF" fontFamily="ui-sans-serif">低</text>
        <text x={CX + R_OUT + 2} y={CY + 14} textAnchor="middle" fontSize="8" fill="#9CA3AF" fontFamily="ui-sans-serif">高</text>
      </svg>

      {/* Risk label badge */}
      <span
        className="text-sm font-bold px-4 py-1.5 rounded-full"
        style={{ color: cfg.color, backgroundColor: `${cfg.color}1A` }}
      >
        {cfg.label}
      </span>

      {/* Zone legend */}
      <div className="flex items-center gap-4">
        {[
          { label: "低風險", color: "#0D7A66" },
          { label: "中度",  color: "#F59E0B" },
          { label: "高風險", color: "#DC2626" },
        ].map((z) => (
          <div key={z.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: z.color }} />
            <span className="text-xs text-gray-400">{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
