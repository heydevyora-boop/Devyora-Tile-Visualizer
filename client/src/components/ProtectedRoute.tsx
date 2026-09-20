import { Navigate } from 'react-router-dom'
import { landingPathFor, useAuth } from '../state/AuthContext'
import type { ReactNode } from 'react'

/**
 * Gates a route behind sign-in and behind a role.
 *
 * - Not signed in         -> the login screen at "/".
 * - Signed in, wrong role -> that role's own landing page, so the two roles
 *   stay strictly separated: an admin reaching for any visualiser page lands
 *   back on /history, and a user reaching for /history lands back on /home.
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
    return <Navigate to={landingPathFor(role)} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
