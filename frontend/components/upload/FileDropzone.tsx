"use client"
import { useCallback, useState } from "react"
import { cn } from "@/lib/utils"

interface FileDropzoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export function FileDropzone({ onFiles, disabled }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const [staged, setStaged] = useState<File[]>([])

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const csvFiles = Array.from(incoming).filter((f) =>
      f.name.toLowerCase().endsWith(".csv")
    )
    if (!csvFiles.length) return
    setStaged((prev) => {
      const merged = [...prev]
      for (const f of csvFiles) {
        if (!merged.some((x) => x.name === f.name)) merged.push(f)
      }
      return merged
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files)
    e.target.value = ""
  }, [addFiles])

  const removeFile = (name: string) =>
    setStaged((prev) => prev.filter((f) => f.name !== name))

  const handleUpload = () => {
    if (staged.length > 0) onFiles(staged)
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer",
          dragging
            ? "border-[#3D8B7A] bg-[#3D8B7A]/10 scale-[1.01]"
            : "border-white/20 hover:border-white/40 hover:bg-white/5",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <input
          type="file"
          accept=".csv"
          multiple
          onChange={handleChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="space-y-3">
          <p className="text-white text-lg font-medium">拖放 CSV 健康資料</p>
          <p className="text-white/50 text-sm">或點擊選擇檔案（可一次選多個）</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-white/40 text-xs">支援格式：</span>
            <span className="text-[#C9A96E] text-xs font-mono">.csv</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-center">
          {[
            { label: "ECG.csv", desc: "心電圖分類" },
            { label: "HeartRate.csv", desc: "心律資料" },
          ].map((item) => (
            <div key={item.label} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <div className="text-xs text-[#C9A96E] font-mono">{item.label}</div>
              <div className="text-xs text-white/40 mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {staged.length > 0 && (
        <div className="space-y-2">
          {staged.map((f) => (
            <div key={f.name} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-[#3D8B7A] flex-shrink-0" />
                <span className="text-sm text-white/80 truncate font-mono">{f.name}</span>
                <span className="text-xs text-white/30 flex-shrink-0">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <button
                onClick={() => removeFile(f.name)}
                className="text-white/30 hover:text-red-400 text-xs ml-3 flex-shrink-0"
              >
                移除
              </button>
            </div>
          ))}

          <button
            onClick={handleUpload}
            disabled={disabled}
            className="w-full mt-2 py-3 rounded-xl bg-[#3D8B7A] hover:bg-[#4fa898] text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            上傳 {staged.length} 個檔案
          </button>
        </div>
      )}
    </div>
  )
}
