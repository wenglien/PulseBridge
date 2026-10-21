"use client"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { PageHeader } from "@/components/layout/PageHeader"
import { FlowSteps } from "@/components/flow/FlowSteps"
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
import { FileUp, CheckCircle2, AlertCircle } from "lucide-react"

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
    <label
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files) }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed px-6 py-12 text-center cursor-pointer transition-colors",
        dragging
          ? "border-[var(--primary)] bg-[var(--primary-wash)]"
          : "border-[var(--line-2)] bg-[var(--surface)] hover:border-[var(--primary-line)] hover:bg-[var(--primary-wash)]",
      )}
    >
      <input
        type="file"
        accept=".xml,.gz"
        className="sr-only"
        onChange={(e) => handle(e.target.files)}
      />
      <span className="grid place-items-center w-14 h-14 rounded-full bg-[var(--primary-wash)] text-[var(--primary)]">
        <FileUp size={26} strokeWidth={1.8} aria-hidden />
      </span>
      <span className="font-display text-xl text-[var(--ink)]">把 export.xml 拖到這裡</span>
      <span className="text-[15px] text-[var(--ink-3)]">或點一下選擇檔案。檔案會先在你的裝置上壓縮，再上傳。</span>
    </label>
  )
}

// ── Spinner card for async steps ──────────────────────────────────────
function StatusCard({ label, sub }: { label: string; sub?: string }) {
  return (
    <Card className="flex items-center gap-4 py-6">
      <Spinner />
      <div>
        <p className="text-[var(--ink)] font-medium">{label}</p>
        {sub && <p className="text-[var(--ink-3)] text-sm mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}

// ── ECG CSV upload block ──────────────────────────────────────────────
type EcgUploadState = "idle" | "uploading" | "done" | "error"

function EcgCsvSection({ sessionId }: { sessionId: string }) {
  const [ecgState,  setEcgState]  = useState<EcgUploadState>("idle")
  const [ecgCount,  setEcgCount]  = useState(0)
  const [ecgNote,   setEcgNote]   = useState("")
  const [ecgError,  setEcgError]  = useState("")
  const [dragging,  setDragging]  = useState(false)

  const upload = useCallback(async (files: File[]) => {
    setEcgState("uploading")
    setEcgError("")
    try {
      const res = await api.addEcgCsvBatch(sessionId, files)
      setEcgCount(res.ecg_count)
      setEcgNote(res.failed_files.length ? `有 ${res.failed_files.length} 個檔案讀不到心電圖：${res.failed_files.join("、")}` : "")
      setEcgState("done")
    } catch (e) {
      setEcgError(e instanceof Error ? e.message : "上傳失敗")
      setEcgState("error")
    }
  }, [sessionId])

  const handleFiles = (files: FileList | null) => {
    const csv = Array.from(files ?? []).filter((f) => f.name.toLowerCase().endsWith(".csv"))
    if (csv.length) upload(csv)
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-[var(--ink)]">加入心電圖（選填）</h3>
          <p className="text-sm text-[var(--ink-3)] mt-0.5">
            心電圖不在剛才的檔案裡，需要從「健康」App 另外匯出 CSV。
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
      <div className="text-sm text-[var(--ink-3)] space-y-1 pb-3 border-b border-[var(--line)]">
        {[
          "開啟「健康」App → 瀏覽 → 心臟 → 心電圖",
          "點選任一 ECG 記錄 → 右上角「匯出」",
          "選擇「CSV」儲存",
          "或使用 Health Auto Export App 批次匯出",
        ].map((s, i) => (
          <p key={i} className="flex gap-1.5">
            <span className="text-[var(--primary)]">{i + 1}.</span>
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
            "relative border border-dashed rounded-2xl p-6 text-center transition-colors cursor-pointer",
            dragging ? "border-[var(--sand-deep)]/60 bg-[var(--sand-wash)]" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
          )}
        >
          <input
            type="file"
            accept=".csv"
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="text-[var(--ink-2)] text-[15px]">把心電圖 CSV 拖到這裡，或點一下選擇（可一次選多個）</p>
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
          <div>
            <p className="text-sm text-green-700">目前共有 {ecgCount} 筆心電圖，可以再加入其他檔案</p>
            {ecgNote && <p className="text-sm text-[var(--ink-3)] mt-0.5">{ecgNote}</p>}
          </div>
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
      // Last 90 days *of the data*, so older exports still get a usable range.
      const end = new Date(`${scan.maxDate}T00:00:00`)
      end.setDate(end.getDate() - 90)
      const defaultStart = end.toISOString().slice(0, 10)
      setStartDate(defaultStart > scan.minDate ? defaultStart : scan.minDate)
      setEndDate(scan.maxDate)
      setSelected(scan.availableTypes)
    }
  }
  if (state === "configuring" && !startDate && scan) onScanReady()

  const canExtract = startDate && endDate && startDate <= endDate && selected.length > 0

  // A small, anonymous sample export bundled with the site, for trying the flow.
  const trySample = async () => {
    const blob = await (await fetch("/sample-health-export.xml")).blob()
    uploadXml(new File([blob], "sample-health-export.xml", { type: "text/xml" }))
  }

  return (
    <PageWrapper maxWidth="md">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <FlowSteps current="data" />
          <PageHeader
            title="匯入你的健康資料"
            description="上傳 iPhone「健康」App 匯出的檔案，接著選擇要看的期間。只會讀取分析需要的欄位。"
          />
        </div>

        {/* ── STEP 1: file drop ── */}
        {state === "idle" && (
          <>
            <XmlDropzone onFile={uploadXml} />

            <section aria-labelledby="export-how" className="rounded-[20px] bg-[var(--sand-wash)] p-5 sm:p-6">
              <h2 id="export-how" className="text-lg text-[var(--ink)]">還沒有檔案？在 iPhone 上這樣匯出</h2>
              <ol className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {[
                  "打開「健康」App，點右上角的頭像",
                  "滑到最下面，點「輸出所有健康資料」",
                  "等它準備好，選「儲存到檔案」",
                  "解壓縮 .zip，上傳裡面的 export.xml",
                ].map((s, i) => (
                  <li key={i} className="flex gap-3 text-[15px] text-[var(--ink-2)]">
                    <span className="grid place-items-center w-6 h-6 shrink-0 rounded-full bg-[var(--surface)] text-[var(--sand-deep)] font-display text-sm mt-0.5">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-[20px] border border-[var(--line)] px-5 py-4">
              <p className="text-[15px] text-[var(--ink-2)]">沒有 Apple Watch，或想先看看？</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={trySample}>用範例資料試試看</Button>
                <Button variant="ghost" size="sm" onClick={() => router.push("/questionnaire")}>
                  略過，直接填問卷
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: compress + upload（含進度條）── */}
        {(state === "compressing" || state === "uploading") && (
          <Card className="p-6 space-y-5">
            <div className="flex items-start gap-4">
              <Spinner className="flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <p className="text-[var(--ink)] font-medium">
                    {state === "compressing" ? "正在壓縮" : "正在上傳"} <span className="text-sm text-[var(--ink-3)] break-all">{fileName}</span>
                  </p>
                  <p className="text-[var(--ink-3)] text-sm mt-1.5">
                    {state === "compressing"
                      ? "先在你的裝置上縮小檔案，大檔案可能要一兩分鐘，請不要關閉這個頁面。"
                      : "大檔案請保持螢幕開啟、網路穩定。"}
                  </p>
                </div>
                {state === "compressing" ? (
                  <ProgressBar
                    indeterminate
                    value={0}
                    label="壓縮中"
                    color="var(--primary)"
                  />
                ) : (
                  <>
                    <ProgressBar
                      value={uploadPercent}
                      label="上傳中"
                      showValue
                      color="var(--primary)"
                    />
                    {uploadTotal > 0 && (
                      <p className="text-sm text-[var(--ink-3)] -mt-2">
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
            label="正在讀取檔案內容…"
            sub={
              uploadSizeMb != null && uploadSizeMb > 0
                ? `檔案約 ${fileSizeMb} MB，正在找出資料涵蓋的日期與種類`
                : `檔案約 ${fileSizeMb} MB，正在找出資料涵蓋的日期與種類`
            }
          />
        )}

        {/* ── STEP 3: configure ── */}
        {state === "configuring" && scan && (
          <Card className="space-y-7">
            <div className="flex items-center gap-2.5 text-[15px] text-[var(--ink-2)]">
              <CheckCircle2 size={18} className="text-[var(--good-deep)] shrink-0" aria-hidden />
              <p>
                已讀取 <span className="text-[var(--ink)]">{fileName}</span>
                <span className="text-[var(--ink-4)]">（{fileSizeMb} MB）</span>
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

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-2">
              <Button variant="ghost" onClick={reset}>換一個檔案</Button>
              <Button
                disabled={!canExtract}
                onClick={() => extract(startDate, endDate, selected)}
              >
                讀取這段期間的資料
              </Button>
            </div>
          </Card>
        )}

        {/* ── STEP 4: extracting ── */}
        {state === "extracting" && (
          <Card>
            <p className="font-medium text-[var(--ink)]">正在讀取資料…</p>
            <p className="text-sm text-[var(--ink-3)] mt-1">
              {startDate} 至 {endDate}，共 {selected.length} 種資料
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
          <Card className="border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-red-700 font-medium">檔案沒有讀取成功</p>
                <p className="text-[var(--ink-2)] text-sm mt-1">{error}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>
                  換一個檔案再試
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ── STEP 5: done ── */}
        {state === "done" && health && (
          <div className="space-y-4">
            <FadeIn>
              <Card glow className="flex items-start gap-3">
                <CheckCircle2 size={22} className="text-[var(--good-deep)] shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="font-display text-xl text-[var(--ink)]">資料準備好了</p>
                  <p className="text-[15px] text-[var(--ink-2)] mt-1">
                    共讀到 {Object.values(recordCounts).reduce((a, n) => a + n, 0).toLocaleString()} 筆紀錄。接下來花三分鐘，告訴我們你最近的身體感受。
                  </p>
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
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <Button variant="ghost" onClick={reset}>換一個檔案</Button>
                <Button size="lg" onClick={() => router.push(`/questionnaire?session=${sessionId}`)}>
                  下一步：身體感受
                </Button>
              </div>
            </FadeIn>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
