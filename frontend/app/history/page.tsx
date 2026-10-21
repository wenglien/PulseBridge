"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, Trash2 } from "lucide-react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/Button"
import { BreathOrb } from "@/components/ui/BreathOrb"
import { HistoryTrend } from "@/components/charts/HistoryTrend"
import { api } from "@/lib/api"
import type { ConstitutionType, Session } from "@/types/analysis"
import { constitutionColor } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"

function monthKey(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "更早" : d.toLocaleDateString("zh-TW", { year: "numeric", month: "long" })
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const auth = useAuth()

  useEffect(() => {
    api.getSessions()
      .then(setSessions)
      .catch(() => { setFailed(true); setSessions([]) })
  }, [auth?.token])

  const handleDelete = async (s: Session) => {
    const when = new Date(s.created_at).toLocaleDateString("zh-TW")
    if (!confirm(`要刪除 ${when} 的這份紀錄嗎？刪除後無法復原。`)) return
    setDeletingId(s.session_id)
    try {
      await api.deleteSession(s.session_id)
      setSessions((prev) => prev?.filter((x) => x.session_id !== s.session_id) ?? null)
    } catch {
      alert("沒有刪除成功，請稍後再試。")
    } finally {
      setDeletingId(null)
    }
  }

  const groups = (sessions ?? []).reduce<Record<string, Session[]>>((acc, s) => {
    (acc[monthKey(s.created_at)] ??= []).push(s)
    return acc
  }, {})

  return (
    <PageWrapper maxWidth="md">
      <PageHeader
        title="我的報告"
        description="每次檢視都會留下一份報告。隔幾週再看一次，比較身體的變化。"
        aside={<Link href="/upload"><Button size="sm">開始新的檢視</Button></Link>}
      />

      {!auth && (sessions?.length ?? 0) > 0 && (
        <p className="mt-6 rounded-2xl bg-[var(--sand-wash)] px-5 py-3.5 text-[15px] text-[var(--ink-2)]">
          這些報告只存在這台裝置的瀏覽器裡。
          <Link href="/account" className="text-link text-[var(--primary)] underline underline-offset-4">登入</Link>
          後會存進帳號，換裝置也看得到。
        </p>
      )}

      {sessions === null ? (
        <div className="flex justify-center py-20"><BreathOrb className="w-20" /></div>
      ) : sessions.length === 0 ? (
        <div className="mt-8 rounded-[24px] bg-[var(--surface)] border border-[var(--line)] px-6 py-14 flex flex-col items-center text-center gap-4">
          <BreathOrb className="w-24" />
          <h2 className="text-2xl text-[var(--ink)]">{failed ? "暫時讀不到報告" : "還沒有任何報告"}</h2>
          <p className="text-[var(--ink-3)] max-w-[24em]">
            {failed ? "連線好像出了點問題，稍後重新整理這個頁面再試一次。" : "完成第一次檢視大約需要五分鐘，報告會出現在這裡。"}
          </p>
          {!failed && <Link href="/upload"><Button>開始第一次檢視</Button></Link>}
        </div>
      ) : (
        <>
        <HistoryTrend sessions={sessions} />
        <div className="mt-8 space-y-8">
          {Object.entries(groups).map(([month, list]) => (
            <section key={month} aria-label={month}>
              <h2 className="text-lg text-[var(--ink-3)] mb-3">{month}</h2>
              <ul className="space-y-3">
                {list.map((s) => {
                  const d = new Date(s.created_at)
                  const done = s.status === "completed"
                  // Questionnaire already in: the next step is (re)generating the report.
                  const readyForReport = done || ["questionnaire_submitted", "analyzing", "error"].includes(s.status)
                  const type = s.primary_constitution as ConstitutionType | ""
                  return (
                    <li key={s.session_id} className="group flex items-stretch rounded-[20px] bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow-soft)]">
                      <Link
                        href={
                          done ? `/analysis?session=${s.session_id}`
                          : readyForReport ? `/analysis?session=${s.session_id}&start=1`
                          : `/questionnaire?session=${s.session_id}`
                        }
                        className="flex flex-1 items-center gap-4 sm:gap-5 px-5 py-4 min-w-0 rounded-l-[20px] hover:bg-[var(--wash)] transition-colors"
                      >
                        <div className="w-12 text-center shrink-0">
                          <p className="font-display text-3xl leading-none text-[var(--ink)]">{d.getDate()}</p>
                          <p className="text-xs text-[var(--ink-4)] mt-1">
                            {d.toLocaleDateString("zh-TW", { weekday: "short" })}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          {done && type ? (
                            <p className="font-display text-xl" style={{ color: constitutionColor(type) }}>{type}</p>
                          ) : (
                            <p className="text-[17px] text-[var(--ink-2)]">{done ? "報告已完成" : "還沒完成"}</p>
                          )}
                          <p className="text-sm text-[var(--ink-4)]">
                            {done ? "打開報告" : s.status === "error" ? "報告沒有產生成功，可以接著再試" : "接著填完問卷就能產生報告"}
                          </p>
                        </div>
                        <ChevronRight size={20} className="text-[var(--ink-4)] shrink-0" aria-hidden />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.session_id}
                        aria-label={`刪除 ${d.toLocaleDateString("zh-TW")} 的紀錄`}
                        className="px-4 justify-center border-l border-[var(--line)] text-[var(--ink-4)] hover:text-red-700 hover:bg-red-50 rounded-r-[20px] transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={18} aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
        </>
      )}
    </PageWrapper>
  )
}
