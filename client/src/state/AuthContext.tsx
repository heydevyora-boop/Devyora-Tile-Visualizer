import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Role = 'admin' | 'user'

type StoredSession = {
  role: Role
  /** The person's display name, shown against their work in the admin history. */
  userName: string
  /** Server-issued session token. Sent as a Bearer token on protected requests. */
  token: string
}

type AuthContextValue = {
  isAuthenticated: boolean
  role: Role | null
  userName: string | null
  token: string | null
  /**
   * Verifies the credentials against the server. Resolves to the role on
   * success, or null when the server rejected them. Throws only for a
   * network/unexpected failure, so the caller can show a distinct message.
   */
  login: (username: string, password: string) => Promise<Role | null>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'devyora.auth'

// Same-origin by default, matching every other API call in the app.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const LOGIN_ENDPOINT = `${API_BASE_URL}/api/login`

/**
 * The one screen a role belongs on.
 *
 * Admins exist only to review the generation history — they have no reason to
 * run a consultation, so /history is both their landing page and the page they
 * are sent back to if they try to reach the visualiser. A salesperson lands on
 * their workspace dashboard and starts a consultation from there. Routing
 * decisions read this rather than hardcoding paths, so the two can never
 * disagree.
 */
export function landingPathFor(role: Role | null): string {
  return role === 'admin' ? '/history' : '/dashboard'
}

/**
 * Reads a JWT's `exp` claim without verifying its signature — a display-only
 * check so a stale, expired token doesn't linger as "signed in" until the
 * next protected request happens to fail. The server is the only place that
 * verifies the signature; this is purely to avoid a confusing UI state.
 */
function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { exp?: number }
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

/**
 * Reads a previously stored session. Returns null for anything unexpected —
 * corrupted JSON, a missing field, or an expired token — so a half-valid
 * value can never produce a half-authenticated state.
 */
function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { role, userName, token } = parsed as Partial<StoredSession>
    if (
      (role !== 'admin' && role !== 'user') ||
      typeof userName !== 'string' ||
      typeof token !== 'string' ||
      isExpired(token)
    ) {
      return null
    }
    return { role, userName, token }
  } catch {
    // Private mode, disabled storage, or malformed JSON — treat as logged out.
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readStoredSession())

  // Mirror the session into localStorage so a refresh keeps the user signed in.
  useEffect(() => {
    try {
      if (session) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
      } else {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // Storage unavailable — the session still works for this tab.
    }
  }, [session])

  const login = useCallback(async (username: string, password: string) => {
    let response: Response
    try {
      response = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
    } catch {
      throw new Error('We could not reach the server. Please check your connection and try again.')
    }

    if (!response.ok) {
      // Covers both "wrong credentials" (401) and anything else — the
      // caller shows one generic message for all of these.
      return null
    }

    const data = (await response.json()) as { token: string; role: Role; displayName: string }
    // Store the account's display name, not what was typed: every salesperson
    // has their own account, so the history can name the actual person rather
    // than a shared login.
    setSession({ role: data.role, userName: data.displayName, token: data.token })
    return data.role
  }, [])

  const logout = useCallback(() => {
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: session !== null,
        role: session?.role ?? null,
        userName: session?.userName ?? null,
        token: session?.token ?? null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
