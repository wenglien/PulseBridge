"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/FadeIn"
import { api } from "@/lib/api"
import type { Session } from "@/types/analysis"
import { formatDate, constitutionColor } from "@/lib/utils"

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.getSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm(`確定要刪除會話 ${id} 嗎？`)) return
    setDeletingId(id)
    try {
      await api.deleteSession(id)
      setSessions((prev) => prev.filter((s) => s.session_id !== id))
    } catch {
      alert("刪除失敗")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <PageWrapper>
      <div className="space-y-6">
        <FadeIn delay={0.05}>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">歷史紀錄</h1>
            <Link href="/upload">
              <Button size="sm">新增分析</Button>
            </Link>
          </div>
        </FadeIn>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : sessions.length === 0 ? (
          <FadeIn delay={0.1}>
            <Card className="text-center py-16 space-y-4">
              <p className="text-gray-500">尚無分析紀錄</p>
              <Link href="/upload">
                <Button>開始第一次分析</Button>
              </Link>
            </Card>
          </FadeIn>
        ) : (
          <Stagger className="space-y-3" stagger={0.06} delay={0.08}>
            {sessions.map((s) => (
              <StaggerItem key={s.session_id}>
                <Card className="flex items-center gap-4 flex-wrap hover:shadow-md transition-shadow">
                  {/* Constitution */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {s.primary_constitution ? (
                      <>
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: constitutionColor(s.primary_constitution as Parameters<typeof constitutionColor>[0]) }}
                        />
                        <div className="min-w-0">
                          <p
                            className="font-semibold"
                            style={{ color: constitutionColor(s.primary_constitution as Parameters<typeof constitutionColor>[0]) }}
                          >
                            {s.primary_constitution}
                          </p>
                          <p className="text-xs text-gray-400 font-mono truncate">{s.session_id}</p>
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="text-gray-500 text-sm">未完成分析</p>
                        <p className="text-xs text-gray-400 font-mono">{s.session_id}</p>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${
                    s.status === "completed" ? "bg-green-100 text-green-700" :
                    s.status === "error" ? "bg-red-100 text-red-600" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {s.status === "completed" ? "已完成" :
                     s.status === "error" ? "錯誤" :
                     s.status}
                  </span>

                  {/* Date */}
                  <p className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                    {formatDate(s.created_at)}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/analysis?session=${s.session_id}`}>
                      <Button size="sm" variant="secondary">查看</Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deletingId === s.session_id}
                      onClick={() => handleDelete(s.session_id)}
                    >
                      刪除
                    </Button>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </PageWrapper>
  )
}
