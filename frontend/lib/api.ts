import { API_BASE } from "./constants"
import { sessionVault } from "./sessionVault"
import { authHeader, getAuth, setAuth } from "./auth"
import type { HealthData, ManualHealthInput } from "@/types/health"
import type { QuestionnaireResponse } from "@/types/questionnaire"
import type { AnalysisResult, Session } from "@/types/analysis"

export interface HKSyncStatusEntry {
  last_sync_at: string | null
  has_anchor: boolean
  record_count: number
}

export interface HKAnchorInfo {
  data_type: string
  anchor_value: string | null
  last_sync_at: string | null
}

export type XmlScanPayload = {
  min_date: string
  max_date: string
  available_types: string[]
}

export const SESSION_TOKEN_HEADER = "X-Session-Token"

/** Headers proving access to the session: its token and/or the signed-in account. */
export function sessionHeaders(sessionId: string): Record<string, string> {
  const token = sessionVault.token(sessionId)
  return { ...authHeader(), ...(token ? { [SESSION_TOKEN_HEADER]: token } : {}) }
}

/** Responses that create a session carry its access token exactly once. */
function remember<T extends { session_id: string; session_token?: string }>(body: T): T {
  if (body.session_token) sessionVault.save(body.session_id, body.session_token)
  return body
}

export type XmlUploadResponse = {
  session_id: string
  session_token?: string
  file_size_mb: number
  upload_size_mb?: number
  was_gzip_upload?: boolean
  /** 與上傳同一回應內完成掃描時由後端附帶，可避免第二個 GET 打到不同實例而 404 */
  scan?: XmlScanPayload
}

/** 使用 XHR 以取得 upload 進度（fetch 無法讀取 body 上傳進度） */
export function uploadXmlWithProgress(
  file: File,
  onProgress: (loaded: number, total: number) => void,
): Promise<XmlUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append("file", file)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(e.loaded, e.total)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(remember(JSON.parse(xhr.responseText) as XmlUploadResponse))
        } catch {
          reject(new Error("伺服器回應格式錯誤"))
        }
        return
      }
      if (xhr.status === 413) {
        reject(
          new Error(
            "檔案過大被拒絕（HTTP 413）。Google Cloud Run 單次請求約 32MB（HTTP/1）或 64MB（HTTP/2）上限；gzip 後若仍過大，請縮短匯出日期或改用桌機／後續分塊上傳方案。",
          ),
        )
        return
      }
      try {
        const err = JSON.parse(xhr.responseText) as { detail?: unknown }
        reject(new Error(formatDetail(err.detail) ?? `HTTP ${xhr.status}`))
      } catch {
        reject(new Error(xhr.statusText || `HTTP ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error("網路錯誤，上傳中斷"))
    xhr.onabort = () => reject(new Error("上傳已取消"))

    xhr.open("POST", `${API_BASE}/api/health-data/upload-xml`)
    for (const [k, v] of Object.entries(authHeader())) xhr.setRequestHeader(k, v)
    xhr.send(form)
  })
}

async function request<T>(path: string, options?: RequestInit, sessionId?: string): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase()
  const headers = new Headers(options?.headers)
  if (!headers.has("Authorization")) {
    for (const [k, v] of Object.entries(authHeader())) headers.set(k, v)
  }
  if (sessionId) {
    for (const [k, v] of Object.entries(sessionHeaders(sessionId))) headers.set(k, v)
  }
  const isForm = options?.body instanceof FormData  // browser sets the multipart boundary
  if (method !== "GET" && method !== "HEAD" && !isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })
  if (res.status === 401 && getAuth()) setAuth(null)   // expired or revoked login
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(formatDetail(err.detail) ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/** FastAPI returns `detail` as a string, or a list of validation errors (422). */
function formatDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => (d as { msg?: string })?.msg).filter(Boolean).join("; ") || undefined
  }
  return undefined
}

const postForm = <T>(path: string, form: FormData, sessionId?: string): Promise<T> =>
  request<T>(path, { method: "POST", body: form }, sessionId)

const authHeaders = (token: string): HeadersInit => ({ Authorization: `Bearer ${token}` })

type SessionLookup = { sessions: Session[]; forget: string[] }

/** Sign in, then attach this browser's anonymous check-ins to the account. */
async function signIn(path: string, email: string, password: string): Promise<void> {
  const res = await request<{ access_token: string; email: string }>(path, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  setAuth({ token: res.access_token, email: res.email })
  const keys = sessionVault.all()
  if (keys.length) {
    await request("/api/sessions/claim", { method: "POST", body: JSON.stringify({ sessions: keys.slice(-200) }) })
      .catch(() => {})   // claiming is best-effort; the reports stay reachable via their tokens
  }
}

export const api = {
  // Health data — XML (large file uploads go through uploadXmlWithProgress)
  scanXml: (sessionId: string): Promise<XmlScanPayload> =>
    request(`/api/health-data/scan/${sessionId}`, undefined, sessionId),

  extractXml: (
    sessionId: string,
    startDate: string,
    endDate: string,
    dataTypes: string[],
  ): Promise<{ session_id: string; parsed: HealthData; record_counts: Record<string, number> }> =>
    request("/api/health-data/extract", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, start_date: startDate, end_date: endDate, data_types: dataTypes }),
    }, sessionId),

  extractProgress: (sessionId: string): Promise<{ pct: number }> =>
    request(`/api/health-data/extract-progress/${sessionId}`, undefined, sessionId),

  addEcgCsv: (sessionId: string, file: File): Promise<{ session_id: string; ecg_count: number }> => {
    const form = new FormData()
    form.append("session_id", sessionId)
    form.append("file", file)
    return postForm("/api/health-data/add-ecg-csv", form, sessionId)
  },

  // Health data — CSV
  uploadCsvFiles: async (files: File[]): Promise<{ session_id: string; parsed: HealthData }> => {
    const form = new FormData()
    files.forEach((f) => form.append("files", f))
    return remember(await postForm<{ session_id: string; session_token?: string; parsed: HealthData }>(
      "/api/health-data/upload-csv", form))
  },

  submitManualHealth: async (data: ManualHealthInput): Promise<{ session_id: string; data: HealthData }> =>
    remember(await request<{ session_id: string; session_token?: string; data: HealthData }>(
      "/api/health-data/manual", { method: "POST", body: JSON.stringify(data) }, data.session_id ?? undefined)),

  getHealthData: (sessionId: string): Promise<HealthData> =>
    request(`/api/health-data/${sessionId}`, undefined, sessionId),

  // Questionnaire — omit session_id to start a questionnaire-only check-in
  submitQuestionnaire: async (data: QuestionnaireResponse): Promise<{ session_id: string; saved: boolean }> =>
    remember(await request<{ session_id: string; session_token?: string; saved: boolean }>(
      "/api/questionnaire/submit", { method: "POST", body: JSON.stringify(data) }, data.session_id || undefined)),

  getQuestionnaire: (sessionId: string): Promise<QuestionnaireResponse> =>
    request(`/api/questionnaire/${sessionId}`, undefined, sessionId),

  // Analysis
  runAnalysis: (sessionId: string): Promise<AnalysisResult> =>
    request("/api/analysis/run", { method: "POST", body: JSON.stringify({ session_id: sessionId }) }, sessionId),

  getAnalysis: (sessionId: string): Promise<AnalysisResult> =>
    request(`/api/analysis/${sessionId}`, undefined, sessionId),

  /** Open the analysis SSE stream (fetch, not EventSource, so the token travels in a header). */
  streamAnalysis: (sessionId: string, signal: AbortSignal): Promise<Response> =>
    fetch(`${API_BASE}/api/analysis/stream/${sessionId}`, {
      headers: { Accept: "text/event-stream", ...sessionHeaders(sessionId) },
      signal,
    }),

  // Sessions — this browser's check-ins plus the signed-in account's, newest first
  getSessions: async (): Promise<Session[]> => {
    const keys = sessionVault.all()
    const [local, owned] = await Promise.all([
      keys.length
        ? request<SessionLookup>("/api/sessions/lookup", {
            method: "POST",
            body: JSON.stringify({ sessions: keys.slice(-200) }),
          })
        : Promise.resolve<SessionLookup>({ sessions: [], forget: [] }),
      getAuth() ? request<Session[]>("/api/sessions").catch(() => [] as Session[]) : Promise.resolve([] as Session[]),
    ])
    const ownedIds = new Set(owned.map((s) => s.session_id))
    sessionVault.forget(local.forget.filter((id) => !ownedIds.has(id)))
    const merged = new Map([...owned, ...local.sessions].map((s) => [s.session_id, s]))
    return [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  // Account
  register: (email: string, password: string) => signIn("/api/auth/register", email, password),
  login: (email: string, password: string) => signIn("/api/auth/login", email, password),
  logout: () => setAuth(null),

  getSession: (sessionId: string): Promise<Record<string, unknown>> =>
    request(`/api/sessions/${sessionId}`, undefined, sessionId),

  deleteSession: async (sessionId: string): Promise<{ deleted: boolean }> => {
    const res = await request<{ deleted: boolean }>(`/api/sessions/${sessionId}`, { method: "DELETE" }, sessionId)
    sessionVault.forget([sessionId])
    return res
  },

  // HealthKit sync (requires a signed-in user's bearer token)
  getHKSyncStatus: (token: string): Promise<Record<string, HKSyncStatusEntry>> =>
    request("/api/hk/status", { headers: authHeaders(token) }),

  getHKAnchor: (dataType: string, token: string): Promise<HKAnchorInfo> =>
    request(`/api/hk/anchor/${dataType}`, { headers: authHeaders(token) }),
}
