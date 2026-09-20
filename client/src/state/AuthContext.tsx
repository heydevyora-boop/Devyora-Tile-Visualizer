import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { resolveCredential, type Role } from '../config/auth'

export type { Role }

type StoredSession = {
  role: Role
  /** The person's display name, shown against their work in the admin history. */
  userName: string
}

type AuthContextValue = {
  isAuthenticated: boolean
  role: Role | null
  userName: string | null
  /** Returns the role when the credentials matched, or null when they did not. */
  login: (username: string, password: string) => Role | null
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'devyora.auth'

/**
 * The one screen a role belongs on.
 *
 * Admins exist only to review the generation history — they have no reason to
 * run a consultation, so /history is both their landing page and the page they
 * are sent back to if they try to reach the visualiser. Everyone else lives in
 * the visualiser and starts at /home. Routing decisions read this rather than
 * hardcoding paths, so the two can never disagree.
 */
export function landingPathFor(role: Role | null): string {
  return role === 'admin' ? '/history' : '/home'
}

/**
 * Reads a previously stored session. Returns null for anything unexpected so a
 * corrupted or hand-edited value can never produce a half-authenticated state.
 */
function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { role, userName } = parsed as Partial<StoredSession>
    if ((role !== 'admin' && role !== 'user') || typeof userName !== 'string') return null
    return { role, userName }
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

  const login = useCallback((username: string, password: string) => {
    const credential = resolveCredential(username, password)
    if (!credential) return null
    // Store the account's display name, not what was typed: every salesperson
    // has their own account, so the history can name the actual person rather
    // than a shared login.
    setSession({ role: credential.role, userName: credential.displayName })
    return credential.role
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
