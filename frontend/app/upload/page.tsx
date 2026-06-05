"use client"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, CheckCircle2, DatabaseZap, FileHeart, FileUp, ListChecks } from "lucide-react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { DataPreview } from "@/components/upload/DataPreview"
import { DateRangePicker } from "@/components/upload/DateRangePicker"
import { DataTypeSelector } from "@/components/upload/DataTypeSelector"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Spinner } from "@/components/ui/Spinner"
import { ProgressBar } from "@/components/ui/ProgressBar"
import { FadeIn } from "@/components/ui/FadeIn"
import { useHealthData } from "@/hooks/useHealthData"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

// ── Drag-and-drop XML dropzone ──────────────────────────────────────
function XmlDropzone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false)

  const handle = (files: FileList | null) => {
    const list = Array.from(files ?? [])
    const picked = list.find((f) => {
      const n = f.name.toLowerCase()
      return n.endsWith(".xml") || n.endsWith(".gz")
    })
    if (picked) onFile(picked)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files) }}
      className={cn(
        "relative border-2 border-dashed rounded-xl p-8 sm:p-10 text-center transition-all duration-300 cursor-pointer",
        dragging ? "border-[#0D7A66] bg-[#E8F5F2]" : "border-[var(--border-mid)] hover:border-[#0D7A66]/50 hover:bg-[var(--surface-muted)]",
      )}
    >
      <input
        type="file"
        accept=".xml,.gz"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={(e) => handle(e.target.files)}
      />
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#E8F5F2] text-[#0D7A66]">
        <FileUp className="h-6 w-6" />
      </div>
      <p className="text-[var(--text-1)] text-lg font-semibold">拖放 Apple Health XML</p>
      <p className="text-[var(--text-3)] text-sm mt-2">或點擊選擇 export.xml（亦可選已 gzip 的 .xml.gz）</p>
      <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)]">
        <span className="text-[var(--text-3)] text-xs">支援格式：</span>
        <span className="text-[#855D16] text-xs font-mono">.xml / .xml.gz</span>
      </div>
    </div>
  )
}

// ── Spinner card for async steps ──────────────────────────────────────
function StatusCard({ label, sub }: { label: string; sub?: string }) {
  return (
    <Card className="flex items-center gap-4 py-6">
      <Spinner />
      <div>
        <p className="text-[var(--text-1)] font-medium">{label}</p>
        {sub && <p className="text-[var(--text-3)] text-sm mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}

// ── ECG CSV upload block ──────────────────────────────────────────────
type EcgUploadState = "idle" | "uploading" | "done" | "error"

function EcgCsvSection({ sessionId }: { sessionId: string }) {
  const [ecgState,  setEcgState]  = useState<EcgUploadState>("idle")
  const [ecgCount,  setEcgCount]  = useState(0)
  const [addedCount, setAddedCount] = useState(0)
  const [parsedFileCount, setParsedFileCount] = useState(0)
  const [failedFiles, setFailedFiles] = useState<string[]>([])
  const [ecgError,  setEcgError]  = useState("")
  const [dragging,  setDragging]  = useState(false)

  const upload = useCallback(async (files: File[]) => {
    const csvFiles = files.filter((file) => file.name.toLowerCase().endsWith(".csv"))
    if (csvFiles.length === 0) {
      setEcgError("請選擇 .csv 檔案")
      setEcgState("error")
      return
    }

    setEcgState("uploading")
    setEcgError("")
    setFailedFiles([])
    try {
      const res = csvFiles.length === 1
        ? await api.addEcgCsv(sessionId, csvFiles[0]).then((single) => ({
            ...single,
            added_count: single.added_count ?? single.ecg_count,
            parsed_file_count: 1,
            failed_files: [] as string[],
          }))
        : await api.addEcgCsvBatch(sessionId, csvFiles)
      setEcgCount(res.ecg_count)
      setAddedCount(res.added_count)
      setParsedFileCount(res.parsed_file_count)
      setFailedFiles(res.failed_files)
      setEcgState("done")
    } catch (e) {
      setEcgError(e instanceof Error ? e.message : "上傳失敗")
      setEcgState("error")
    }
  }, [sessionId])

  const handleFiles = (files: FileList | null) => {
    upload(Array.from(files ?? []))
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#FEF3DC] text-[#855D16]">
            <FileHeart className="h-4 w-4" />
          </div>
          <div>
          <p className="text-sm font-medium text-[var(--text-2)]">ECG 心電圖資料（選填）</p>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            ECG 資料不在 XML 內，可一次選取多個 Apple Watch ECG CSV
          </p>
          </div>
        </div>
        {ecgState === "done" && (
          <span className="text-xs text-green-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            已加入 {ecgCount} 筆
          </span>
        )}
      </div>

      {/* How to export ECG */}
      <div className="text-xs text-[var(--text-3)] space-y-1 pb-1 border-b border-[var(--border)]">
        <p className="text-[var(--text-2)] font-medium mb-1.5">如何匯出 ECG CSV</p>
            {[
              "開啟「健康」App → 瀏覽 → 心臟 → 心電圖",
          "點選 ECG 記錄 → 右上角「匯出」",
          "把多筆 CSV 存在同一資料夾後一次選取",
          "或使用 Health Auto Export App 批次匯出",
        ].map((s, i) => (
          <p key={i} className="flex gap-1.5">
            <span className="text-[#0D7A66]">{i + 1}.</span>
            <span>{s}</span>
          </p>
        ))}
      </div>

      {ecgState === "idle" || ecgState === "error" ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          className={cn(
            "relative border border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer",
            dragging ? "border-[#855D16]/60 bg-[#FEF3DC]" : "border-[var(--border-mid)] hover:border-[var(--border-mid)] hover:bg-[var(--surface-muted)]",
          )}
        >
          <input
            type="file"
            accept=".csv"
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="text-[var(--text-2)] text-sm">拖放多個 ECG CSV 或點擊選擇</p>
          <p className="mt-1 text-xs text-[var(--text-3)]">支援一次上傳多筆，系統會合併並略過重複記錄</p>
          {ecgState === "error" && (
            <p className="text-red-500 text-xs mt-2">{ecgError}</p>
          )}
        </div>
      ) : ecgState === "uploading" ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)]">
          <Spinner size="sm" />
          <p className="text-sm text-[var(--text-2)]">解析 ECG CSV 中…</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <div>
            <p className="text-sm text-green-700">
              已成功加入 {addedCount} 筆新 ECG，總計 {ecgCount} 筆
            </p>
            <p className="text-xs text-green-700/80">
              已解析 {parsedFileCount} 個 CSV{failedFiles.length > 0 ? `，略過 ${failedFiles.length} 個檔案` : ""}
            </p>
          </div>
          <button
            onClick={() => { setEcgState("idle"); setAddedCount(0); setParsedFileCount(0); setFailedFiles([]) }}
            className="ml-auto text-xs text-[var(--text-3)] hover:text-[var(--text-2)]"
          >
            追加上傳
          </button>
        </div>
      )}
      {failedFiles.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          未解析：{failedFiles.join("、")}
        </div>
      )}
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function UploadPage() {
  const router = useRouter()
  const {
    state, health, sessionId, error,
    fileName, fileSizeMb, uploadSizeMb, uploadPercent, uploadLoaded, uploadTotal,
    extractPercent,
    scan, recordCounts,
    uploadXml, extract, reset,
  } = useHealthData()

  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [selected,  setSelected]  = useState<string[]>([])
  const isDev = process.env.NODE_ENV !== "production"

  const uploadSampleXml = async () => {
    const res = await fetch("/sample-health-export.xml")
    if (!res.ok) return
    const blob = await res.blob()
    const file = new File([blob], "sample-health-export.xml", { type: "text/xml" })
    uploadXml(file)
  }

  const onScanReady = () => {
    if (!scan) return
    if (!startDate) {
      const today = new Date()
      const ninetyDaysAgo = new Date(today)
      ninetyDaysAgo.setDate(today.getDate() - 90)
      const defaultStart = ninetyDaysAgo.toISOString().slice(0, 10)
      setStartDate(defaultStart > scan.minDate ? defaultStart : scan.minDate)
      setEndDate(scan.maxDate)
      setSelected(scan.availableTypes)
    }
  }
  if (state === "configuring" && !startDate && scan) onScanReady()

  const canExtract = startDate && endDate && startDate <= endDate && selected.length > 0
  const progressSteps = [
    { label: "上傳", active: ["idle", "compressing", "uploading", "scanning"].includes(state), done: ["configuring", "extracting", "done"].includes(state) },
    { label: "範圍", active: state === "configuring", done: ["extracting", "done"].includes(state) },
    { label: "提取", active: state === "extracting", done: state === "done" },
    { label: "問卷", active: false, done: false },
  ]

  return (
    <PageWrapper maxWidth="md">
      <div className="space-y-8">
        {/* Header */}
        <FadeIn delay={0.05}>
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-xs font-semibold uppercase text-[#0D7A66]">Data intake</p>
              <h1 className="text-3xl font-bold text-[var(--text-1)]">建立你的健康資料基底</h1>
              <p className="mx-auto max-w-xl text-[var(--text-2)] text-sm leading-6">
                先從 Apple Health 擷取必要欄位，再接到症狀問卷與 AI 報告。大型 XML 會先在瀏覽器壓縮，降低上傳負擔。
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {progressSteps.map((item, index) => (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-center text-xs font-semibold transition-colors",
                    item.done
                      ? "border-[#0D7A66]/25 bg-[#E8F5F2] text-[#0D7A66]"
                      : item.active
                        ? "border-[#0D7A66]/35 bg-[var(--surface)] text-[#0D7A66]"
                        : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-3)]",
                  )}
                >
                  <span className="mr-1 font-mono">{index + 1}</span>{item.label}
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* ── STEP 1: file drop ── */}
        {state === "idle" && (
          <>
            <FadeIn delay={0.12}>
              <Card className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8F5F2] text-[#0D7A66]">
                    <ListChecks className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-1)]">如何匯出 Apple Health XML</p>
                    <p className="text-xs text-[var(--text-3)]">依序完成後，把解壓縮的 export.xml 拖到下方。</p>
                  </div>
                </div>
                <ol className="space-y-1.5 text-sm text-[var(--text-2)]">
                  {[
                    "開啟 iPhone「健康」App → 右上角頭像",
                    "向下捲動 → 匯出所有健康數據",
                    "等待完成 → 儲存到檔案",
                    "解壓縮 .zip → 上傳 export.xml（瀏覽器會先 gzip 再上傳，節省流量）",
                  ].map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[#0D7A66] font-mono flex-shrink-0">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </FadeIn>

            {isDev && (
              <FadeIn delay={0.16}>
                <Card className="flex flex-col gap-3 border-[#0D7A66]/25 bg-[var(--surface-accent)] sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-1)]">本機測試模式</p>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--text-2)]">
                      沒有 Apple Health 匯出檔時，可以先用內建 XML 測試上傳、掃描與提取流程。
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={uploadSampleXml}>
                    使用測試 XML
                  </Button>
                </Card>
              </FadeIn>
            )}

            <FadeIn delay={0.2}>
              <XmlDropzone onFile={uploadXml} />
            </FadeIn>

            <FadeIn delay={0.28}>
              <div className="text-center">
                <p className="text-[var(--text-3)] text-sm mb-2">或者</p>
                <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                  <Button variant="ghost" size="sm" onClick={() => router.push("/questionnaire")}>
                    跳過，直接填寫症狀問卷
                  </Button>
                </div>
              </div>
            </FadeIn>
          </>
        )}

        {/* ── STEP 2: compress + upload（含進度條）── */}
        {(state === "compressing" || state === "uploading") && (
          <Card className="p-6 space-y-5">
            <div className="flex items-start gap-4">
              <Spinner className="flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <p className="text-[var(--text-1)] font-medium">
                    {state === "compressing" ? "正在壓縮" : "正在上傳"} <span className="font-mono text-sm break-all">{fileName}</span>
                  </p>
                  <p className="text-[var(--text-2)] text-xs mt-1.5">
                    {state === "compressing"
                      ? "使用 gzip 縮小體積後再上傳；壓縮時間視檔案大小與裝置效能而定，請勿關閉頁面。"
                      : "上傳進度以下方為準；大型檔案請保持螢幕開啟並維持網路穩定。"}
                  </p>
                </div>
                {state === "compressing" ? (
                  <ProgressBar
                    indeterminate
                    value={0}
                    label="gzip 壓縮處理中"
                    color="#0D7A66"
                  />
                ) : (
                  <>
                    <ProgressBar
                      value={uploadPercent}
                      label="上傳到伺服器"
                      showValue
                      color="#0D7A66"
                    />
                    {uploadTotal > 0 && (
                      <p className="text-xs text-[var(--text-2)] -mt-2">
                        已傳 {(uploadLoaded / 1024 / 1024).toFixed(2)} MB / {(uploadTotal / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ── STEP 2b: scanning ── */}
        {state === "scanning" && (
          <StatusCard
            label="掃描資料結構中…"
            sub={
              uploadSizeMb != null && uploadSizeMb > 0
                ? `解壓後約 ${fileSizeMb} MB（上傳約 ${uploadSizeMb} MB gzip）— 讀取日期範圍與資料類型`
                : `${fileSizeMb} MB — 快速讀取日期範圍與資料類型`
            }
          />
        )}

        {/* ── STEP 3: configure ── */}
        {state === "configuring" && scan && (
          <Card className="space-y-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-[var(--text-2)] text-sm">
                已掃描 <span className="text-[var(--text-1)] font-mono">{fileName}</span>
                {uploadSizeMb != null && uploadSizeMb > 0 ? (
                  <>（解壓後約 {fileSizeMb} MB，上傳約 {uploadSizeMb} MB gzip）</>
                ) : (
                  <>（{fileSizeMb} MB）</>
                )}
              </p>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-1)]">
                <CalendarDays className="h-4 w-4 text-[#0D7A66]" />
                選擇分析期間
              </div>
              <DateRangePicker
                minDate={scan.minDate}
                maxDate={scan.maxDate}
                startDate={startDate}
                endDate={endDate}
                onStartChange={setStartDate}
                onEndChange={setEndDate}
              />

              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-1)]">
                <DatabaseZap className="h-4 w-4 text-[#0D7A66]" />
                選擇資料類型
              </div>
              <DataTypeSelector
                available={scan.availableTypes}
                selected={selected}
                onChange={setSelected}
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={reset}>重新上傳</Button>
              <Button
                disabled={!canExtract}
                onClick={() => extract(startDate, endDate, selected)}
              >
                開始提取資料 →
              </Button>
            </div>
          </Card>
        )}

        {/* ── STEP 4: extracting ── */}
        {state === "extracting" && (
          <Card>
            <p className="text-sm font-medium text-[var(--text-1)]">正在提取選定的資料…</p>
            <p className="text-xs text-[var(--text-2)] mt-1">
              時間範圍：{startDate} 至 {endDate}，資料類型：{selected.length} 項
            </p>
            <div className="mt-3">
              <ProgressBar
                value={extractPercent}
                label={`${extractPercent}%`}
              />
            </div>
          </Card>
        )}

        {/* ── STEP 5: error ── */}
        {state === "error" && (
          <Card className="border-red-200">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
              <div>
                <p className="text-red-600 font-medium">失敗</p>
                <p className="text-[var(--text-2)] text-sm mt-1">{error}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>
                  重新開始
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ── STEP 5: done ── */}
        {state === "done" && health && (
          <div className="space-y-4">
            <FadeIn>
              <Card className="border-green-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-green-700 font-medium">資料提取成功</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(recordCounts).map(([k, n]) => (
                        <span key={k} className="text-xs px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[var(--text-2)] font-mono">
                          {k} × {n}
                        </span>
                      ))}
                    </div>
                    <p className="text-[var(--text-3)] text-xs">會話 ID: {sessionId}</p>
                  </div>
                </div>
              </Card>
            </FadeIn>

            <FadeIn delay={0.08}>
              <DataPreview health={health} />
            </FadeIn>

            {sessionId && (
              <FadeIn delay={0.15}>
                <EcgCsvSection sessionId={sessionId} />
              </FadeIn>
            )}

            <FadeIn delay={0.22}>
              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={reset}>重新上傳</Button>
                <Button onClick={() => router.push(`/questionnaire?session=${sessionId}`)}>
                  繼續填寫問卷 →
                </Button>
              </div>
            </FadeIn>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
