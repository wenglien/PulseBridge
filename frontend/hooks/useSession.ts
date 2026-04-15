"use client"
import { useCallback, useEffect, useState } from "react"

const SESSION_KEY = "pulsebridge_session_id"

export function useSession() {
  const [sessionId, setSessionIdState] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) setSessionIdState(stored)
  }, [])

  const setSessionId = useCallback((id: string) => {
    localStorage.setItem(SESSION_KEY, id)
    setSessionIdState(id)
  }, [])

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setSessionIdState(null)
  }, [])

  return { sessionId, setSessionId, clearSession }
}
