import { Navigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import type { ReactNode } from 'react'

/**
 * Gates a route behind sign-in, and optionally behind a role.
 *
 * - Not signed in           -> back to the login screen at "/".
 * - Signed in, wrong role   -> to "/home", which every signed-in user may see.
 *
 * `replace` is used throughout so a redirect never leaves a dead entry in the
 * browser history for the user to hit "back" into.
 */
function ProtectedRoute({
  children,
  requireRole,
}: {
  children: ReactNode
  requireRole?: 'admin' | 'user'
}) {
  const { isAuthenticated, role } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (requireRole && role !== requireRole) {
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
