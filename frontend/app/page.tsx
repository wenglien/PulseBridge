"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/FadeIn"
import { api } from "@/lib/api"
import type { Session } from "@/types/analysis"
import { formatDate, constitutionColor } from "@/lib/utils"

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hasHistory = !loading && sessions.length > 0

  return (
    <PageWrapper>
      {/* ── Hero ── */}
      <section className="py-10 sm:py-16 text-center space-y-5">
        <FadeIn delay={0.05}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E8F5F2] text-[#0D7A66] text-xs font-semibold mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0D7A66] animate-pulse" />
            中西醫整合 · AI 分析
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            <span className="text-gray-900">Pulse</span>
            <span className="text-[#0D7A66]">Bridge</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.18}>
          <p className="text-base sm:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed px-2">
            透過 Apple Watch 的 ECG、HRV 與睡眠數據，結合中醫體質辨識，
            為您提供個人化健康建議
          </p>
        </FadeIn>
        <FadeIn delay={0.26}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/upload" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto min-w-[180px]">
                上傳 Apple Watch 資料
              </Button>
            </Link>
            <Link href="/questionnaire" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto min-w-[160px]">
                直接填寫問卷
              </Button>
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* ── Features ── */}
      <Stagger className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-12" delay={0.05}>
        {[
          {
            title: "ECG 心電圖分析",
            desc: "偵測心房顫動、ST 段異常等心臟風險指標",
            color: "#0D7A66",
            bg: "#E8F5F2",
          },
          {
            title: "HRV 自律神經評估",
            desc: "計算 SDNN、RMSSD，評估自律神經功能與壓力",
            color: "#2563eb",
            bg: "#EFF6FF",
          },
          {
            title: "中醫體質辨識",
            desc: "九種體質分類，結合問卷提供中西醫整合建議",
            color: "#855D16",
            bg: "#FEF3DC",
          },
        ].map((f) => (
          <StaggerItem key={f.title}>
            <Card className="space-y-2 hover:shadow-md transition-shadow duration-200 h-full">
              <div
                className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: f.bg, color: f.color }}
              >
                {f.title}
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      {/* ── Recent sessions ── */}
      {hasHistory && (
        <section className="mb-12">
          <FadeIn>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">最近分析紀錄</h2>
              <Link href="/history" className="text-sm text-[#0D7A66] hover:text-[#1A9479]">
                查看全部 →
              </Link>
            </div>
          </FadeIn>
          <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" stagger={0.07}>
            {sessions.slice(0, 3).map((s) => (
              <StaggerItem key={s.session_id}>
                <Link href={`/analysis?session=${s.session_id}`}>
                  <Card className="hover:shadow-md transition-all duration-200 cursor-pointer space-y-3 h-full">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-mono truncate">{s.session_id.slice(0, 16)}…</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                        s.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {s.status === "completed" ? "已完成" : s.status}
                      </span>
                    </div>
                    {s.primary_constitution && (
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: constitutionColor(s.primary_constitution as Parameters<typeof constitutionColor>[0]) }}
                        />
                        <span
                          className="font-semibold text-sm"
                          style={{ color: constitutionColor(s.primary_constitution as Parameters<typeof constitutionColor>[0]) }}
                        >
                          {s.primary_constitution}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-400">{formatDate(s.created_at)}</p>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {/* ── How it works ── */}
      <FadeIn>
        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 text-center mb-6">使用流程</h2>
          <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-4" stagger={0.09}>
            {[
              { step: "01", title: "匯出健康資料", desc: "從 iPhone 健康 App 匯出 XML" },
              { step: "02", title: "填寫症狀問卷", desc: "記錄能量、消化、睡眠等症狀" },
              { step: "03", title: "AI 整合分析", desc: "Claude AI 結合中西醫知識" },
              { step: "04", title: "獲得個人化建議", desc: "體質分析、風險提醒" },
            ].map((item) => (
              <StaggerItem key={item.step} from="up">
                <div className="text-center space-y-2">
                  <span className="inline-block text-xs text-[#0D7A66] font-mono font-bold bg-[#E8F5F2] px-3 py-1 rounded-full">
                    {item.step}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      </FadeIn>
    </PageWrapper>
  )
}
