import { API_BASE } from "./constants"
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

export type XmlUploadResponse = {
  session_id: string
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
          resolve(JSON.parse(xhr.responseText) as XmlUploadResponse)
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
        const err = JSON.parse(xhr.responseText) as { detail?: string }
        reject(new Error(err.detail ?? `HTTP ${xhr.status}`))
      } catch {
        reject(new Error(xhr.statusText || `HTTP ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error("網路錯誤，上傳中斷"))
    xhr.onabort = () => reject(new Error("上傳已取消"))

    xhr.open("POST", `${API_BASE}/api/health-data/upload-xml`)
    xhr.send(form)
  })
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase()
  const headers = new Headers(options?.headers)
  if (method !== "GET" && method !== "HEAD" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? "Request failed")
  }
  return res.json()
}

export const api = {
  // Health data — XML (large file, streaming parse)
  uploadXml: (file: File): Promise<XmlUploadResponse> => {
    const form = new FormData()
    form.append("file", file)
    return fetch(`${API_BASE}/api/health-data/upload-xml`, { method: "POST", body: form })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail ?? "Upload failed")
        return r.json()
      })
  },

  scanXml: (sessionId: string): Promise<{
    min_date: string
    max_date: string
    available_types: string[]
  }> => request(`/api/health-data/scan/${sessionId}`),

  extractXml: (
    sessionId: string,
    startDate: string,
    endDate: string,
    dataTypes: string[],
  ): Promise<{ session_id: string; parsed: HealthData; record_counts: Record<string, number> }> =>
    request("/api/health-data/extract", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, start_date: startDate, end_date: endDate, data_types: dataTypes }),
    }),

  addEcgCsv: (sessionId: string, file: File): Promise<{ session_id: string; ecg_count: number }> => {
    const form = new FormData()
    form.append("session_id", sessionId)
    form.append("file", file)
    return fetch(`${API_BASE}/api/health-data/add-ecg-csv`, { method: "POST", body: form })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail ?? "Upload failed")
        return r.json()
      })
  },

  // Health data — CSV
  uploadCsvFiles: (files: File[]): Promise<{ session_id: string; parsed: HealthData }> => {
    const form = new FormData()
    files.forEach((f) => form.append("files", f))
    return fetch(`${API_BASE}/api/health-data/upload-csv`, { method: "POST", body: form })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail ?? "Upload failed")
        return r.json()
      })
  },

  submitManualHealth: (data: ManualHealthInput): Promise<{ session_id: string; data: HealthData }> =>
    request("/api/health-data/manual", { method: "POST", body: JSON.stringify(data) }),

  getHealthData: (sessionId: string): Promise<HealthData> =>
    request(`/api/health-data/${sessionId}`),

  // Questionnaire
  submitQuestionnaire: (data: QuestionnaireResponse): Promise<{ session_id: string; saved: boolean }> =>
    request("/api/questionnaire/submit", { method: "POST", body: JSON.stringify(data) }),

  getQuestionnaire: (sessionId: string): Promise<QuestionnaireResponse> =>
    request(`/api/questionnaire/${sessionId}`),

  // Analysis
  runAnalysis: (sessionId: string): Promise<AnalysisResult> =>
    request("/api/analysis/run", { method: "POST", body: JSON.stringify({ session_id: sessionId }) }),

  getAnalysis: (sessionId: string): Promise<AnalysisResult> =>
    request(`/api/analysis/${sessionId}`),

  getAnalysisStreamUrl: (sessionId: string): string =>
    `${API_BASE}/api/analysis/stream/${sessionId}`,

  // Sessions
  getSessions: (): Promise<Session[]> =>
    request("/api/sessions"),

  getSession: (sessionId: string): Promise<Record<string, unknown>> =>
    request(`/api/sessions/${sessionId}`),

  deleteSession: (sessionId: string): Promise<{ deleted: boolean }> =>
    request(`/api/sessions/${sessionId}`, { method: "DELETE" }),

  // HealthKit sync (requires Authorization header set by caller)
  getHKSyncStatus: (token: string): Promise<Record<string, HKSyncStatusEntry>> =>
    fetch(`${API_BASE}/api/hk/status`, {
      headers: { "Authorization": `Bearer ${token}` },
    }).then(async (r) => {
      if (!r.ok) throw new Error((await r.json()).detail ?? "Failed")
      return r.json()
    }),

  getHKAnchor: (dataType: string, token: string): Promise<HKAnchorInfo> =>
    fetch(`${API_BASE}/api/hk/anchor/${dataType}`, {
      headers: { "Authorization": `Bearer ${token}` },
    }).then((r) => r.json()),
}
