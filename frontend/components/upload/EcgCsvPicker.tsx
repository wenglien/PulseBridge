"use client"
import { useRef, useState } from "react"
import { FolderOpen, HeartPulse } from "lucide-react"
import { cn } from "@/lib/utils"

const isCsv = (f: File) => f.name.toLowerCase().endsWith(".csv")

/** Read files from a drop, descending into dropped folders (e.g. the whole `electrocardiograms` folder). */
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items ?? [])
    .map((item) => item.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => Boolean(e))
  if (!entries.length) return Array.from(dt.files)

  const out: File[] = []
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      out.push(await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)))
      return
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // readEntries returns results in batches; keep reading until it returns none.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
      if (!batch.length) break
      for (const child of batch) await walk(child)
    }
  }
  for (const e of entries) await walk(e)
  return out
}

interface EcgCsvPickerProps {
  onFiles: (files: File[]) => void
  /** Smaller variant for adding more recordings to an existing check-in. */
  compact?: boolean
  error?: string
}

export function EcgCsvPicker({ onFiles, compact = false, error }: EcgCsvPickerProps) {
  const [dragging, setDragging] = useState(false)
  const [ignored, setIgnored] = useState(0)
  const folderInput = useRef<HTMLInputElement>(null)

  const accept = (files: File[]) => {
    const csv = files.filter(isCsv)
    setIgnored(files.length - csv.length)
    if (csv.length) onFiles(csv)
  }

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setDragging(false)
          accept(await filesFromDrop(e.dataTransfer))
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 text-center cursor-pointer border-2 border-dashed transition-colors",
          compact ? "rounded-2xl px-5 py-6" : "rounded-[24px] px-6 py-9",
          dragging
            ? "border-[var(--primary)] bg-[var(--primary-wash)]"
            : "border-[var(--line-2)] bg-[var(--surface)] hover:border-[var(--primary-line)] hover:bg-[var(--primary-wash)]",
        )}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          multiple
          className="sr-only"
          onChange={(e) => { accept(Array.from(e.target.files ?? [])); e.target.value = "" }}
        />
        {!compact && (
          <span className="grid place-items-center w-12 h-12 rounded-full bg-[var(--primary-wash)] text-[var(--primary)]">
            <HeartPulse size={24} strokeWidth={1.8} aria-hidden />
          </span>
        )}
        <span className={cn("text-[var(--ink)]", compact ? "text-[15px]" : "font-display text-lg")}>
          把心電圖 CSV 拖到這裡
        </span>
        <span className="text-sm text-[var(--ink-3)]">可以一次選多個檔案，或直接拖進整個資料夾</span>
      </label>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => folderInput.current?.click()}
          className="gap-1.5 text-sm text-[var(--primary)] underline decoration-[var(--primary-line)] underline-offset-4 min-h-10"
        >
          <FolderOpen size={16} aria-hidden />
          選擇整個資料夾
        </button>
        <input
          ref={folderInput}
          type="file"
          multiple
          className="sr-only"
          // Non-standard but supported by Chrome, Edge, Safari and Firefox.
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => { accept(Array.from(e.target.files ?? [])); e.target.value = "" }}
        />
      </div>

      {ignored > 0 && (
        <p className="mt-1 text-center text-sm text-[var(--ink-3)]">略過了 {ignored} 個不是 CSV 的檔案</p>
      )}
      {error && <p role="alert" className="mt-2 text-center text-sm text-red-700">{error}</p>}
    </div>
  )
}
