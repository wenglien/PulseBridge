"use client"
import { useState, useCallback } from "react"
import { api, uploadXmlWithProgress } from "@/lib/api"
import { canGzipInBrowser, gzipXmlFileForUpload } from "@/lib/gzipXml"
import type { HealthData } from "@/types/health"

export type UploadState =
  | "idle"          // waiting for file
  | "compressing"   // browser gzip（縮小後再上傳）
  | "uploading"     // saving XML to server
  | "scanning"      // server scanning date range + available types
  | "configuring"   // user picks date range + data types
  | "extracting"    // server streaming-parsing the selected subset
  | "done"          // preview ready
  | "error"

interface ScanResult {
  minDate:        string
  maxDate:        string
  availableTypes: string[]
}

export function useHealthData() {
  const [state,      setState]      = useState<UploadState>("idle")
  const [health,     setHealth]     = useState<HealthData | null>(null)
  const [sessionId,  setSessionId]  = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [fileName,   setFileName]   = useState<string>("")
  const [fileSizeMb, setFileSizeMb] = useState<number>(0)
  const [uploadSizeMb, setUploadSizeMb] = useState<number | null>(null)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadLoaded, setUploadLoaded] = useState(0)
  const [uploadTotal, setUploadTotal] = useState(0)
  const [scan,       setScan]       = useState<ScanResult | null>(null)
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({})

  // ── Phase 1: upload XML ──────────────────────────────────────────────
  const uploadXml = useCallback(async (file: File) => {
    setFileName(file.name)
    setUploadSizeMb(null)
    setUploadPercent(0)
    setUploadLoaded(0)
    setUploadTotal(0)
    setError(null)
    try {
      let toUpload = file
      if (canGzipInBrowser() && file.name.toLowerCase().endsWith(".xml")) {
        setState("compressing")
        toUpload = await gzipXmlFileForUpload(file)
      }
      setState("uploading")
      setUploadPercent(0)
      setUploadLoaded(0)
      setUploadTotal(toUpload.size)
      const { session_id, file_size_mb, upload_size_mb, scan: scanFromUpload } =
        await uploadXmlWithProgress(
        toUpload,
        (loaded, total) => {
          setUploadLoaded(loaded)
          setUploadTotal(total)
          setUploadPercent(total > 0 ? Math.round((loaded / total) * 100) : 0)
          if (total > 0 && loaded >= total) {
            setState("scanning")
          }
        },
      )
      setUploadPercent(100)
      setUploadLoaded(toUpload.size)
      setSessionId(session_id)
      setFileSizeMb(file_size_mb)
      setUploadSizeMb(upload_size_mb ?? null)
      if (!scanFromUpload) {
        setState("scanning")
      }

      // Phase 2: scan（新後端會在上傳回應內附 scan，略過第二個請求以免多實例／滾動更新 404）
      const result = scanFromUpload ?? (await api.scanXml(session_id))
      setScan({
        minDate:        result.min_date,
        maxDate:        result.max_date,
        availableTypes: result.available_types,
      })
      setState("configuring")
    } catch (e) {
      setUploadPercent(0)
      setUploadLoaded(0)
      setUploadTotal(0)
      setError(e instanceof Error ? e.message : "上傳失敗")
      setState("error")
    }
  }, [])

  // ── Phase 3: extract ────────────────────────────────────────────────
  const extract = useCallback(async (
    startDate: string,
    endDate:   string,
    dataTypes: string[],
  ) => {
    if (!sessionId) return
    setState("extracting")
    setError(null)
    try {
      const result = await api.extractXml(sessionId, startDate, endDate, dataTypes)
      setHealth(result.parsed)
      setRecordCounts(result.record_counts)
      setState("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "提取失敗")
      setState("error")
    }
  }, [sessionId])

  // ── CSV upload (legacy short path) ──────────────────────────────────
  const [fileNames, setFileNames] = useState<string[]>([])
  const uploadFiles = useCallback(async (files: File[]) => {
    setFileNames(files.map((f) => f.name))
    setState("uploading")
    setError(null)
    try {
      setState("extracting")
      const result = await api.uploadCsvFiles(files)
      setHealth(result.parsed)
      setSessionId(result.session_id)
      setState("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "上傳失敗")
      setState("error")
    }
  }, [])

  const reset = useCallback(() => {
    setState("idle")
    setHealth(null)
    setSessionId(null)
    setError(null)
    setFileName("")
    setFileSizeMb(0)
    setUploadSizeMb(null)
    setUploadPercent(0)
    setUploadLoaded(0)
    setUploadTotal(0)
    setScan(null)
    setFileNames([])
    setRecordCounts({})
  }, [])

  return {
    state, health, sessionId, error,
    fileName, fileSizeMb, uploadSizeMb,
    uploadPercent, uploadLoaded, uploadTotal,
    scan, recordCounts,
    fileNames,
    uploadXml, extract, uploadFiles, reset,
  }
}
