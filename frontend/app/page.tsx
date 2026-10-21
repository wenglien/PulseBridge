"use client"
import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/Button"
import { BreathOrb } from "@/components/ui/BreathOrb"
import { api } from "@/lib/api"
import type { ConstitutionType, Session } from "@/types/analysis"
import { constitutionColor, constitutionDescription } from "@/lib/utils"

const STEPS = [
  { title: "匯入資料", time: "約 2 分鐘", desc: "上傳 iPhone「健康」App 匯出的檔案，選擇要看的期間。沒有手錶也可以略過。" },
  { title: "身體感受", time: "約 3 分鐘", desc: "最近容易累嗎？睡得好嗎？勾選這兩週真的有感覺的症狀就好。" },
  { title: "你的報告", time: "約 1 分鐘", desc: "西醫的數據解讀和中醫的調養方向放在一起看，不懂的地方可以直接追問。" },
]

function greetingFor(hour: number) {
  if (hour < 5) return "夜深了"
  if (hour < 11) return "早安"
  if (hour < 14) return "午安"
  if (hour < 18) return "下午好"
  return "晚安"
}

// Static export renders "你好" at build time; notify once after mount so the
// store re-reads the visitor's local hour.
const subscribeOnce = (notify: () => void) => {
  const id = setTimeout(notify, 0)
  return () => clearTimeout(id)
}

export default function Home() {
  const greeting = useSyncExternalStore(subscribeOnce, () => greetingFor(new Date().getHours()), () => "你好")
  const [last, setLast] = useState<Session | null>(null)

  useEffect(() => {
    api.getSessions()
      .then((list) => setLast(list.find((s) => s.status === "completed") ?? null))
      .catch(() => {})
  }, [])

  const lastType = last?.primary_constitution as ConstitutionType | undefined

  return (
    <PageWrapper maxWidth="lg">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="grid md:grid-cols-[1.15fr_1fr] items-center gap-6 md:gap-10 pt-2 md:pt-10 pb-12">
        <div className="order-2 md:order-1">
          <h1 className="text-[2.1rem] leading-[1.3] sm:text-5xl sm:leading-[1.3] text-[var(--ink)]">
            {greeting}，<br />今天身體還好嗎？
          </h1>
          <p className="mt-5 max-w-[30em] text-base sm:text-[17px] text-[var(--ink-2)]">
            用 Apple Watch 的心率變異、心電圖和睡眠紀錄，加上幾題身體感受，整理出一份西醫數據與中醫調養並列的報告。
          </p>
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <Link href="/upload">
              <Button size="lg" className="w-full sm:w-auto">開始今天的檢視</Button>
            </Link>
            <Link
              href="/questionnaire"
              className="justify-center text-[15px] text-[var(--primary)] underline decoration-[var(--primary-line)] underline-offset-[6px] hover:decoration-[var(--primary)]"
            >
              沒有 Apple Watch？從問卷開始
            </Link>
          </div>
        </div>

        <figure className="order-1 md:order-2 flex flex-col items-center">
          <BreathOrb guide className="w-36 sm:w-56 md:w-72" />
          <figcaption className="mt-3 text-center text-sm text-[var(--ink-3)] max-w-[19em]">
            開始之前，跟著圓圈慢慢呼吸三次。放慢吐氣，心率變異會跟著升高。
          </figcaption>
        </figure>
      </section>

      {/* ── Last report ──────────────────────────────────────── */}
      {last && (
        <section aria-labelledby="last-heading" className="mb-12">
          <div className="rounded-[20px] bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow-soft)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h2 id="last-heading" className="flex gap-3 text-sm text-[var(--ink-3)]" style={{ fontFamily: "var(--font-zh)" }}>
                <span>上次的報告</span>
                <span>{new Date(last.created_at).toLocaleDateString("zh-TW", { month: "long", day: "numeric" })}</span>
              </h2>
              {lastType ? (
                <>
                  <p className="mt-1 font-display text-2xl" style={{ color: constitutionColor(lastType) }}>{lastType}</p>
                  <p className="mt-1 text-[15px] text-[var(--ink-2)]">{constitutionDescription(lastType)}</p>
                </>
              ) : (
                <p className="mt-1 font-display text-2xl text-[var(--ink)]">報告已完成</p>
              )}
            </div>
            <Link href={`/analysis?session=${last.session_id}`} className="shrink-0">
              <Button variant="secondary" className="w-full sm:w-auto">打開報告</Button>
            </Link>
          </div>
        </section>
      )}

      {/* ── The three steps ──────────────────────────────────── */}
      <section aria-labelledby="steps-heading" className="mb-12">
        <h2 id="steps-heading" className="text-2xl text-[var(--ink)]">一次檢視，三個步驟</h2>
        <ol className="mt-5 grid md:grid-cols-3 gap-3 md:gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-[20px] bg-[var(--surface)] border border-[var(--line)] p-5">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-8 h-8 rounded-full bg-[var(--primary-wash)] text-[var(--primary)] font-display">
                  {i + 1}
                </span>
                <h3 className="text-base font-medium text-[var(--ink)]">{s.title}</h3>
                <span className="ml-auto text-sm text-[var(--ink-4)]">{s.time}</span>
              </div>
              <p className="mt-3 text-[15px] text-[var(--ink-2)]">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="mb-8 rounded-2xl bg-[var(--sand-wash)] px-5 py-4 text-sm text-[var(--ink-2)]">
        脈橋提供健康資訊參考，不能取代醫師診斷。若出現胸痛、昏厥、呼吸困難等症狀，請直接就醫或撥打 119。
      </p>
    </PageWrapper>
  )
}
