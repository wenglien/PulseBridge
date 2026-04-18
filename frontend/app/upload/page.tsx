"use client"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { DataPreview } from "@/components/upload/DataPreview"
import { DateRangePicker } from "@/components/upload/DateRangePicker"
import { DataTypeSelector } from "@/components/upload/DataTypeSelector"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Spinner } from "@/components/ui/Spinner"
import { ProgressBar } from "@/components/ui/ProgressBar"
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/FadeIn"
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
        "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer",
        dragging ? "border-[#0D7A66] bg-[#E8F5F2]" : "border-gray-300 hover:border-[#0D7A66]/50 hover:bg-gray-50",
      )}
    >
      <input
        type="file"
        accept=".xml,.gz"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={(e) => handle(e.target.files)}
      />
      <p className="text-gray-900 text-lg font-medium">拖放 Apple Health XML</p>
      <p className="text-gray-400 text-sm mt-2">或點擊選擇 export.xml（亦可選已 gzip 的 .xml.gz）</p>
      <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-gray-100 border border-gray-200">
        <span className="text-gray-400 text-xs">支援格式：</span>
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
        <p className="text-gray-900 font-medium">{label}</p>
        {sub && <p className="text-gray-400 text-sm mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}

// ── ECG CSV upload block ──────────────────────────────────────────────
type EcgUploadState = "idle" | "uploading" | "done" | "error"

function EcgCsvSection({ sessionId }: { sessionId: string }) {
  const [ecgState,  setEcgState]  = useState<EcgUploadState>("idle")
  const [ecgCount,  setEcgCount]  = useState(0)
  const [ecgError,  setEcgError]  = useState("")
  const [dragging,  setDragging]  = useState(false)

  const upload = useCallback(async (file: File) => {
    setEcgState("uploading")
    setEcgError("")
    try {
      const res = await api.addEcgCsv(sessionId, file)
      setEcgCount(res.ecg_count)
      setEcgState("done")
    } catch (e) {
      setEcgError(e instanceof Error ? e.message : "上傳失敗")
      setEcgState("error")
    }
  }, [sessionId])

  const handleFiles = (files: FileList | null) => {
    const csv = Array.from(files ?? []).find((f) => f.name.toLowerCase().endsWith(".csv"))
    if (csv) upload(csv)
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">ECG 心電圖資料（選填）</p>
          <p className="text-xs text-gray-400 mt-0.5">
            ECG 資料不在 XML 內，請從 Apple Health App 個別匯出 CSV
          </p>
        </div>
        {ecgState === "done" && (
          <span className="text-xs text-green-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            已加入 {ecgCount} 筆
          </span>
        )}
      </div>

      {/* How to export ECG */}
      <div className="text-xs text-gray-400 space-y-1 pb-1 border-b border-gray-200">
        <p className="text-gray-600 font-medium mb-1.5">如何匯出 ECG CSV</p>
        {[
          "開啟「健康」App → 瀏覽 → 心臟 → 心電圖",
          "點選任一 ECG 記錄 → 右上角「匯出」",
          "選擇「CSV」儲存",
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
            dragging ? "border-[#855D16]/60 bg-[#FEF3DC]" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
          )}
        >
          <input
            type="file"
            accept=".csv"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="text-gray-500 text-sm">拖放 ECG.csv 或點擊選擇</p>
          {ecgState === "error" && (
            <p className="text-red-500 text-xs mt-2">{ecgError}</p>
          )}
        </div>
      ) : ecgState === "uploading" ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
          <Spinner size="sm" />
          <p className="text-sm text-gray-500">解析 ECG CSV 中…</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <p className="text-sm text-green-700">已成功加入 {ecgCount} 筆 ECG 記錄</p>
          <button
            onClick={() => { setEcgState("idle"); setEcgCount(0) }}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600"
          >
            重新上傳
          </button>
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

  return (
    <PageWrapper maxWidth="md">
      <div className="space-y-8">
        {/* Header */}
        <FadeIn delay={0.05}>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">上傳 Apple Health 資料</h1>
            <p className="text-gray-500 text-sm">選取時間範圍與資料類型，系統僅提取所需欄位</p>
          </div>
        </FadeIn>

        {/* ── STEP 1: file drop ── */}
        {state === "idle" && (
          <>
            <FadeIn delay={0.12}>
              <Card className="space-y-3">
                <p className="text-sm font-medium text-gray-700">如何匯出</p>
                <ol className="space-y-1.5 text-sm text-gray-500">
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

            <FadeIn delay={0.2}>
              <XmlDropzone onFile={uploadXml} />
            </FadeIn>

            <FadeIn delay={0.28}>
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-2">或者</p>
                <Button variant="ghost" size="sm" onClick={() => router.push("/questionnaire")}>
                  跳過，直接填寫症狀問卷
                </Button>
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
                  <p className="text-gray-900 font-medium">
                    {state === "compressing" ? "正在壓縮" : "正在上傳"} <span className="font-mono text-sm break-all">{fileName}</span>
                  </p>
                  <p className="text-gray-500 text-xs mt-1.5">
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
                      <p className="text-xs text-gray-500 -mt-2">
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
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <p className="text-gray-600 text-sm">
                已掃描 <span className="text-gray-900 font-mono">{fileName}</span>
                {uploadSizeMb != null && uploadSizeMb > 0 ? (
                  <>（解壓後約 {fileSizeMb} MB，上傳約 {uploadSizeMb} MB gzip）</>
                ) : (
                  <>（{fileSizeMb} MB）</>
                )}
              </p>
            </div>

            <DateRangePicker
              minDate={scan.minDate}
              maxDate={scan.maxDate}
              startDate={startDate}
              endDate={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
            />

            <DataTypeSelector
              available={scan.availableTypes}
              selected={selected}
              onChange={setSelected}
            />

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
            <p className="text-sm font-medium text-gray-900">正在提取選定的資料…</p>
            <p className="text-xs text-gray-500 mt-1">
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
                <p className="text-gray-500 text-sm mt-1">{error}</p>
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
                        <span key={k} className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-mono">
                          {k} × {n}
                        </span>
                      ))}
                    </div>
                    <p className="text-gray-400 text-xs">會話 ID: {sessionId}</p>
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
