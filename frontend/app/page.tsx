"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle2,
  FileText,
  HeartPulse,
  LineChart,
  Moon,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/FadeIn"
import { api } from "@/lib/api"
import type { Session } from "@/types/analysis"
import { formatDate, constitutionColor } from "@/lib/utils"

const previewBars = [34, 46, 42, 58, 52, 66, 63, 74, 68, 82]

function ReportPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[440px]">
      <div className="absolute -inset-3 rounded-[18px] bg-[#0D7A66]/10 blur-2xl" />
      <Card glow className="relative overflow-hidden p-0">
        <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--text-3)]">Daily Insight</p>
              <h2 className="mt-1 text-lg font-bold text-[var(--text-1)]">健康分析報告</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0D7A66]/25 bg-[#E8F5F2] px-3 py-1 text-xs font-semibold text-[#0D7A66]">
              <ShieldCheck className="h-3.5 w-3.5" />
              低風險
            </span>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "RMSSD", value: "42", unit: "ms", tone: "text-[#0D7A66]" },
              { label: "睡眠", value: "7.1", unit: "h", tone: "text-blue-600" },
              { label: "體質", value: "氣虛", unit: "質", tone: "text-amber-700" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-[11px] font-medium text-[var(--text-3)]">{item.label}</p>
                <p className={`mt-1 text-xl font-bold ${item.tone}`}>
                  {item.value}<span className="ml-0.5 text-xs font-semibold text-[var(--text-3)]">{item.unit}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[var(--text-1)]">HRV 恢復趨勢</p>
                <p className="text-[11px] text-[var(--text-3)]">近 10 日自律神經恢復狀態</p>
              </div>
              <LineChart className="h-4 w-4 text-[#0D7A66]" />
            </div>
            <div className="flex h-24 items-end gap-2">
              {previewBars.map((height, index) => (
                <div key={index} className="flex-1 rounded-t bg-[#0D7A66]/20">
                  <div
                    className="rounded-t bg-[#0D7A66]"
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {[
              "睡眠深度不足時，隔日 HRV 下降較明顯",
              "建議先調整晚間刺激與入睡時間",
              "若胸悶或心悸持續，請安排醫療評估",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-[var(--text-2)]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0D7A66]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}

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
      <section className="grid items-center gap-10 py-8 sm:py-12 lg:grid-cols-[1.02fr_0.98fr] lg:py-14">
        <div className="space-y-7">
          <FadeIn delay={0.05}>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0D7A66]/20 bg-[#E8F5F2] px-3 py-1.5 text-xs font-semibold text-[#0D7A66]">
              <Sparkles className="h-3.5 w-3.5" />
              Apple Watch 數據 · 中醫體質 · AI 報告
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight text-[var(--text-1)] sm:text-5xl lg:text-6xl">
                把 Apple Watch 數據轉成看得懂的健康報告
              </h1>
              <p className="max-w-2xl text-base leading-8 text-[var(--text-2)] sm:text-lg">
                PulseBridge 整合 ECG、HRV、睡眠與症狀問卷，將生理指標轉譯成風險提醒、體質洞察與可執行的調養建議。
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.18}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/upload" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  <UploadCloud className="h-4 w-4" />
                  上傳健康資料
                </Button>
              </Link>
              <Link href="/questionnaire" className="w-full sm:w-auto">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  先填症狀問卷
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.26}>
            <div className="grid max-w-2xl grid-cols-3 gap-3">
              {[
                { value: "ECG", label: "心電圖風險" },
                { value: "HRV", label: "自律神經恢復" },
                { value: "9", label: "中醫體質分類" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
                  <p className="text-lg font-bold text-[var(--text-1)]">{item.value}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-3)]">{item.label}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.2} from="right">
          <ReportPreview />
        </FadeIn>
      </section>

      <Stagger className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" delay={0.05}>
        {[
          {
            icon: HeartPulse,
            title: "心血管訊號整合",
            desc: "彙整 ECG 分類、心率與紅旗症狀，讓風險提醒更有上下文。",
          },
          {
            icon: Activity,
            title: "HRV 與睡眠洞察",
            desc: "用趨勢和參考範圍看恢復狀態，而不是只看單次數字。",
          },
          {
            icon: Brain,
            title: "體質與行動建議",
            desc: "把問卷症狀轉成體質傾向，再產出可執行的調養重點。",
          },
        ].map((f) => {
          const Icon = f.icon
          return (
            <StaggerItem key={f.title}>
              <Card className="h-full space-y-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8F5F2] text-[#0D7A66]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-1)]">{f.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{f.desc}</p>
                </div>
              </Card>
            </StaggerItem>
          )
        })}
      </Stagger>

      {hasHistory && (
        <section className="mb-12">
          <FadeIn>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--text-1)]">最近分析紀錄</h2>
              <Link href="/history" className="text-sm font-medium text-[#0D7A66] hover:text-[#1A9479]">
                查看全部
              </Link>
            </div>
          </FadeIn>
          <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" stagger={0.07}>
            {sessions.slice(0, 3).map((s) => (
              <StaggerItem key={s.session_id}>
                <Link href={`/analysis?session=${s.session_id}`}>
                  <Card className="h-full cursor-pointer space-y-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                    <div className="flex items-center justify-between">
                      <span className="truncate font-mono text-xs text-[var(--text-3)]">{s.session_id.slice(0, 16)}...</span>
                      <span className={`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        s.status === "completed" ? "bg-green-100 text-green-700" : "bg-[var(--surface-muted)] text-[var(--text-2)]"
                      }`}>
                        {s.status === "completed" ? "已完成" : s.status}
                      </span>
                    </div>
                    {s.primary_constitution && (
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: constitutionColor(s.primary_constitution as Parameters<typeof constitutionColor>[0]) }}
                        />
                        <span
                          className="text-sm font-semibold"
                          style={{ color: constitutionColor(s.primary_constitution as Parameters<typeof constitutionColor>[0]) }}
                        >
                          {s.primary_constitution}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-[var(--text-3)]">{formatDate(s.created_at)}</p>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      <FadeIn>
        <section className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase text-[#0D7A66]">Workflow</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--text-1)]">四步完成個人化分析</h2>
            </div>
            <p className="max-w-lg text-sm text-[var(--text-2)]">
              從資料匯入到 AI 報告，每一步都保留清楚的進度與下一步行動。
            </p>
          </div>
          <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-4" stagger={0.09}>
            {[
              { icon: UploadCloud, title: "匯入資料", desc: "上傳 Apple Health XML" },
              { icon: Moon, title: "選擇範圍", desc: "擷取 ECG、HRV、睡眠" },
              { icon: Brain, title: "填寫問卷", desc: "補上症狀與體感脈絡" },
              { icon: FileText, title: "取得報告", desc: "產出摘要、建議與 PDF" },
            ].map((item, index) => {
              const Icon = item.icon
              return (
                <StaggerItem key={item.title} from="up">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#0D7A66]">{String(index + 1).padStart(2, "0")}</span>
                      <Icon className="h-4 w-4 text-[var(--text-3)]" />
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--text-1)]">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">{item.desc}</p>
                  </div>
                </StaggerItem>
              )
            })}
          </Stagger>
        </section>
      </FadeIn>
    </PageWrapper>
  )
}
