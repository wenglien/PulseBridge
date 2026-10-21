"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { useAuth } from "@/hooks/useAuth"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

type Mode = "login" | "register"

const INPUT =
  "w-full rounded-2xl border px-4 py-3 text-[15px] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--primary)]"

export default function AccountPage() {
  const auth = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await (mode === "login" ? api.login(email, password) : api.register(email, password))
      router.push("/history")
    } catch (err) {
      setError(err instanceof Error ? err.message : "沒有成功，請再試一次")
    } finally {
      setBusy(false)
    }
  }

  if (auth) {
    return (
      <PageWrapper maxWidth="sm">
        <PageHeader title="帳號" />
        <Card className="mt-8 space-y-4">
          <p className="text-[var(--ink-3)] text-sm">目前登入</p>
          <p className="font-display text-2xl text-[var(--ink)] break-all">{auth.email}</p>
          <p className="text-[15px] text-[var(--ink-2)]">
            登入時做的檢視會存到這個帳號，在其他裝置登入同一個帳號，就能在「我的報告」看到。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href="/history"><Button className="w-full">看我的報告</Button></Link>
            <Button variant="secondary" onClick={() => api.logout()}>登出</Button>
          </div>
        </Card>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper maxWidth="sm">
      <PageHeader
        title={mode === "login" ? "登入" : "建立帳號"}
        description="不登入也能使用。登入後，報告會跟著帳號走，換手機或電腦也看得到；這台裝置上已有的報告會一併存進帳號。"
      />

      <div className="mt-6 inline-flex rounded-full bg-[var(--wash-2)] p-1" role="tablist" aria-label="登入或註冊">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => { setMode(m); setError(null) }}
            className={cn(
              "px-5 rounded-full text-[15px] transition-colors",
              mode === m ? "bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-soft)]" : "text-[var(--ink-3)]",
            )}
          >
            {m === "login" ? "登入" : "建立帳號"}
          </button>
        ))}
      </div>

      <Card className="mt-4">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[15px] text-[var(--ink-2)] mb-1.5">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email}
                   onChange={(e) => setEmail(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="password" className="block text-[15px] text-[var(--ink-2)] mb-1.5">密碼</label>
            <input id="password" type="password" required minLength={mode === "register" ? 8 : undefined} maxLength={72}
                   autoComplete={mode === "login" ? "current-password" : "new-password"} value={password}
                   onChange={(e) => setPassword(e.target.value)} className={INPUT} />
            {mode === "register" && <p className="mt-1.5 text-sm text-[var(--ink-4)]">至少 8 個字元</p>}
          </div>
          {error && <p role="alert" className="rounded-2xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</p>}
          <Button type="submit" loading={busy} className="w-full" size="lg">
            {mode === "login" ? "登入" : "建立帳號並登入"}
          </Button>
        </form>
      </Card>
    </PageWrapper>
  )
}
