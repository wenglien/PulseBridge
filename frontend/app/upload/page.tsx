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
import { EcgCsvPicker } from "@/components/upload/EcgCsvPicker"

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

// ── Adding ECG CSVs to an existing check-in ───────────────────────────
type EcgUploadState = "idle" | "uploading" | "done" | "error"

const ECG_EXPORT_STEPS = [
  "在 iPhone「健康」App 點右上角頭像 →「輸出所有健康資料」，儲存到檔案",
  "解壓縮匯出的 .zip，打開 apple_health_export 裡的 electrocardiograms 資料夾",
  "每一次量測都是一個 CSV：拖進整個資料夾，或只選想看的幾個",
]

function EcgCsvSection({ sessionId, initialCount }: { sessionId: string; initialCount: number }) {
  const [ecgState, setEcgState] = useState<EcgUploadState>("idle")
  const [ecgCount, setEcgCount] = useState(initialCount)
  const [ecgNote,  setEcgNote]  = useState("")
  const [ecgError, setEcgError] = useState("")

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

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-medium text-[var(--ink)]">{initialCount ? "再加入其他心電圖（選填）" : "加入心電圖（選填）"}</h3>
        <p className="text-sm text-[var(--ink-3)] mt-0.5">
          {ecgCount > 0 ? `目前共有 ${ecgCount} 筆心電圖。` : "心電圖不在 export.xml 裡，是匯出檔中另外的 CSV。"}
          重複的量測會自動合併。
        </p>
      </div>

      {ecgCount === 0 && (
        <ol className="text-sm text-[var(--ink-3)] space-y-1">
          {ECG_EXPORT_STEPS.map((step, i) => (
            <li key={i} className="flex gap-2"><span className="text-[var(--primary)]">{i + 1}.</span>{step}</li>
          ))}
        </ol>
      )}

      {ecgState === "uploading" ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--wash)]">
          <Spinner size="sm" />
          <p className="text-sm text-[var(--ink-2)]">正在讀取心電圖…</p>
        </div>
      ) : (
        <>
          {ecgState === "done" && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-green-50">
              <CheckCircle2 size={18} className="text-[var(--good-deep)] shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm text-[var(--ink)]">已加入，目前共有 {ecgCount} 筆心電圖。</p>
                {ecgNote && <p className="text-sm text-[var(--ink-3)] mt-0.5">{ecgNote}</p>}
              </div>
            </div>
          )}
          <EcgCsvPicker compact onFiles={upload} error={ecgState === "error" ? ecgError : undefined} />
        </>
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
    fileNames,
    uploadXml, extract, uploadFiles, reset,
  } = useHealthData()

  // "xml": full Apple Health export (recommended); "ecg": only ECG CSV files.
  const [source, setSource] = useState<"xml" | "ecg">("xml")
  const csvMode = fileNames.length > 0 && !scan

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
            <div className="inline-flex w-full sm:w-auto rounded-full bg-[var(--wash-2)] p-1" role="tablist" aria-label="要上傳哪一種資料">
              {([["xml", "完整匯出檔"], ["ecg", "只有心電圖 CSV"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={source === key}
                  onClick={() => setSource(key)}
                  className={cn(
                    "flex-1 sm:flex-none justify-center px-5 rounded-full text-[15px] transition-colors",
                    source === key ? "bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-soft)]" : "text-[var(--ink-3)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {source === "xml" ? (
              <XmlDropzone onFile={uploadXml} />
            ) : (
              <div className="space-y-2">
                <p className="text-[15px] text-[var(--ink-2)]">
                  不用上傳整個匯出檔，只用 Apple Watch 量的心電圖也能分析心律、心率與心率變異。
                </p>
                <EcgCsvPicker onFiles={uploadFiles} />
              </div>
            )}

            <section aria-labelledby="export-how" className="rounded-[20px] bg-[var(--sand-wash)] p-5 sm:p-6">
              <h2 id="export-how" className="text-lg text-[var(--ink)]">
                {source === "xml" ? "還沒有檔案？在 iPhone 上這樣匯出" : "心電圖 CSV 在哪裡？"}
              </h2>
              <ol className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {(source === "xml" ? [
                  "打開「健康」App，點右上角的頭像",
                  "滑到最下面，點「輸出所有健康資料」",
                  "等它準備好，選「儲存到檔案」",
                  "解壓縮 .zip，上傳裡面的 export.xml",
                ] : [
                  "打開「健康」App，點右上角頭像 →「輸出所有健康資料」",
                  "選「儲存到檔案」，再解壓縮匯出的 .zip",
                  "打開 apple_health_export 裡的 electrocardiograms 資料夾",
                  "每次量測一個 CSV：整個資料夾拖進來，或只選幾個",
                ]).map((s, i) => (
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
            <p className="font-medium text-[var(--ink)]">{csvMode ? "正在讀取心電圖…" : "正在讀取資料…"}</p>
            <p className="text-sm text-[var(--ink-3)] mt-1">
              {csvMode
                ? `${fileNames.length} 個檔案，每筆心電圖約 30 秒的波形，檔案多時需要一點時間`
                : `${startDate} 至 ${endDate}，共 ${selected.length} 種資料`}
            </p>
            <div className="mt-3">
              {csvMode
                ? <ProgressBar indeterminate value={0} label="分析波形中" />
                : <ProgressBar value={extractPercent} label={`${extractPercent}%`} />}
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
                    {csvMode
                      ? `共讀到 ${health.ecg_readings.length} 筆心電圖。`
                      : `共讀到 ${Object.values(recordCounts).reduce((a, n) => a + n, 0).toLocaleString()} 筆紀錄。`}
                    接下來花三分鐘，告訴我們你最近的身體感受。
                  </p>
                </div>
              </Card>
            </FadeIn>
            <FadeIn delay={0.08}>
              <DataPreview health={health} />
            </FadeIn>

            {sessionId && (
              <FadeIn delay={0.15}>
                <EcgCsvSection sessionId={sessionId} initialCount={health.ecg_readings.length} />
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
