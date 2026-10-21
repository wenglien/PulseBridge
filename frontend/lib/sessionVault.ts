/**
 * Access tokens for the check-ins this browser created.
 *
 * The API only serves a session to whoever presents its token (issued once,
 * when the session is created), so losing this storage means losing access —
 * which is exactly what keeps one person's reports away from everyone else.
 * Every read/write is guarded: storage can be unavailable (private mode, blocked).
 */
const KEY = "pulsebridge.sessions.v1"

type Entry = { token: string; savedAt: string }
type Vault = Record<string, Entry>

function read(): Vault {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : {}
    return parsed && typeof parsed === "object" ? (parsed as Vault) : {}
  } catch {
    return {}
  }
}

function write(v: Vault) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    // storage full or blocked — the current page still works with in-memory state
  }
}

// In-memory fallback so the current visit keeps working when storage is blocked.
const memory: Vault = {}

export const sessionVault = {
  save(sessionId: string, token: string) {
    const entry = { token, savedAt: new Date().toISOString() }
    memory[sessionId] = entry
    write({ ...read(), [sessionId]: entry })
  },
  token(sessionId: string): string | undefined {
    return read()[sessionId]?.token ?? memory[sessionId]?.token
  },
  all(): { session_id: string; token: string }[] {
    const merged = { ...memory, ...read() }
    return Object.entries(merged).map(([session_id, e]) => ({ session_id, token: e.token }))
  },
  forget(ids: string[]) {
    if (!ids.length) return
    const v = read()
    for (const id of ids) {
      delete v[id]
      delete memory[id]
    }
    write(v)
  },
}
