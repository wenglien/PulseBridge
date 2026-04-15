"use client"
import { useState, useCallback } from "react"
import { api } from "@/lib/api"
import type { QuestionnaireResponse, SymptomSeverity } from "@/types/questionnaire"
import { EMPTY_QUESTIONNAIRE } from "@/types/questionnaire"

export function useQuestionnaire(sessionId: string) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<Omit<QuestionnaireResponse, "session_id">>({
    ...EMPTY_QUESTIONNAIRE,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setSeverity = useCallback(
    (
      category: keyof Omit<QuestionnaireResponse, "session_id" | "submitted_at" | "additional_notes">,
      field: string,
      value: SymptomSeverity,
    ) => {
      setData((prev) => ({
        ...prev,
        [category]: { ...(prev[category] as object), [field]: value },
      }))
    },
    [],
  )

  const setNotes = useCallback((notes: string) => {
    setData((prev) => ({ ...prev, additional_notes: notes }))
  }, [])

  const submit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      await api.submitQuestionnaire({ ...data, session_id: sessionId })
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失敗")
    } finally {
      setSubmitting(false)
    }
  }, [data, sessionId])

  return {
    step, setStep,
    data, setSeverity, setNotes,
    submitting, submitted, error, submit,
  }
}
