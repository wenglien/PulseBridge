/**
 * Optional sign-in. Anonymous use keeps working through per-report access
 * tokens; signing in additionally attaches reports to an account so they show
 * up on the person's other devices.
 */
const KEY = "pulsebridge.auth.v1"

export type AuthState = { token: string; email: string } | null

const listeners = new Set<() => void>()
let cached: AuthState | undefined
let cachedRaw: string | null = null

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function getAuth(): AuthState {
  if (typeof window === "undefined") return null
  const raw = readRaw()
  if (cached !== undefined && raw === cachedRaw) return cached
  cachedRaw = raw
  try {
    const parsed = raw ? (JSON.parse(raw) as AuthState) : null
    cached = parsed && parsed.token && isFresh(parsed.token) ? parsed : null
  } catch {
    cached = null
  }
  return cached
}

/** Drop tokens whose `exp` has passed, so an expired login reads as signed out. */
function isFresh(jwt: string): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number }
    return !payload.exp || payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function setAuth(next: AuthState) {
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    // storage blocked: sign-in lasts for this page only
  }
  cached = next
  cachedRaw = readRaw()
  listeners.forEach((l) => l())
}

export function subscribeAuth(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => e.key === KEY && listener()
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function authHeader(): Record<string, string> {
  const a = getAuth()
  return a ? { Authorization: `Bearer ${a.token}` } : {}
}
