"use client"
import { useState, useCallback } from "react"
import { api } from "@/lib/api"
import type { QuestionnaireResponse, SymptomSeverity } from "@/types/questionnaire"
import { EMPTY_QUESTIONNAIRE } from "@/types/questionnaire"

/** `sessionId` is null for a questionnaire-only check-in: the server creates the session on submit. */
export function useQuestionnaire(sessionId: string | null) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<Omit<QuestionnaireResponse, "session_id">>({
    ...EMPTY_QUESTIONNAIRE,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
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
      const res = await api.submitQuestionnaire({ ...data, session_id: sessionId ?? "" })
      setSubmittedId(res.session_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失敗")
    } finally {
      setSubmitting(false)
    }
  }, [data, sessionId])

  return {
    step, setStep,
    data, setSeverity, setNotes,
    submitting, submittedId, error, submit,
  }
}
