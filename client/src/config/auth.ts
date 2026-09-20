export type Role = 'admin' | 'user'

export interface Credential {
  username: string
  password: string
  role: Role
}

/**
 * Showroom sign-in credentials.
 *
 * These are intentionally hardcoded and shipped in the client bundle: this is a
 * shared in-store tool on trusted showroom devices, not a public account system.
 * Anyone who can open the deployed site can read these values in the bundle, so
 * they gate convenience (who sees the admin history), not security. To rotate a
 * password, edit it here and redeploy.
 */
export const CREDENTIALS: Credential[] = [
  { username: 'admin', password: 'devyora@admin', role: 'admin' },
  { username: 'user', password: 'devyora@user', role: 'user' },
]

/** Returns the matching role, or null when the pair is not recognised. */
export function resolveRole(username: string, password: string): Role | null {
  const match = CREDENTIALS.find(
    (credential) =>
      credential.username === username.trim().toLowerCase() && credential.password === password,
  )
  return match ? match.role : null
}
