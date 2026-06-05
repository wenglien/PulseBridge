"use client"
import { useCallback, useState } from "react"

const SESSION_KEY = "pulsebridge_session_id"

export function useSession() {
  const [sessionId, setSessionIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(SESSION_KEY)
  })

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
