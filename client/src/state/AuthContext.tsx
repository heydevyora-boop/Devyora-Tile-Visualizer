import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { resolveRole, type Role } from '../config/auth'

export type { Role }

type StoredSession = {
  role: Role
  /** The username they signed in with; shown in the admin history. */
  userName: string
}

type AuthContextValue = {
  isAuthenticated: boolean
  role: Role | null
  userName: string | null
  /** Returns true when the credentials matched and the session was created. */
  login: (username: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'devyora.auth'

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
    const role = resolveRole(username, password)
    if (!role) return false
    // The username is the only identity we have, so it is what gets recorded
    // against each generation in the admin history. Normalised to lowercase so
    // "Admin" and "admin" do not appear as two different people.
    setSession({ role, userName: username.trim().toLowerCase() })
    return true
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
