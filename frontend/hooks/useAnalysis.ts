"use client"
import { useState, useCallback } from "react"
import type { AnalysisResult } from "@/types/analysis"

export function useAnalysis() {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startStream = useCallback(() => {
    setStreaming(true)
    setError(null)
  }, [])

  const onComplete = useCallback((r: AnalysisResult) => {
    setResult(r)
    setStreaming(false)
  }, [])

  const onError = useCallback((msg: string) => {
    setError(msg)
    setStreaming(false)
  }, [])

  return { result, streaming, error, startStream, onComplete, onError }
}
