export type Role = 'admin' | 'user'

export interface Credential {
  /** What they type to sign in. Matched case-insensitively. */
  username: string
  password: string
  role: Role
  /** The name shown against their generations in the admin history. */
  displayName: string
}

/**
 * Showroom sign-in accounts.
 *
 * ── TO ADD A SALESPERSON ─────────────────────────────────────────────────
 * Copy one of the `role: 'user'` lines below, change the username, password
 * and displayName, then redeploy. The displayName is what the admin sees in
 * the history, so use the name you want to read there.
 *
 * ── TO REMOVE SOMEONE ────────────────────────────────────────────────────
 * Delete their line and redeploy. Nobody else's password changes.
 *
 * Usernames must be unique and lowercase; a duplicate would silently shadow
 * whichever entry comes later.
 *
 * These are intentionally hardcoded and ship in the client bundle: this is a
 * shared in-store tool on trusted showroom devices, not a public account
 * system. Anyone who can open the deployed site can read these values, so
 * they establish who did what — they are not a security boundary.
 */
export const CREDENTIALS: Credential[] = [
  // Reviews the generation history. Cannot use the visualiser.
  { username: 'admin', password: 'devyora@admin', role: 'admin', displayName: 'Administrator' },

  // Salespeople — replace these three with your real staff.
  { username: 'rahul', password: 'devyora@rahul', role: 'user', displayName: 'Rahul' },
  { username: 'priya', password: 'devyora@priya', role: 'user', displayName: 'Priya' },
  { username: 'amit', password: 'devyora@amit', role: 'user', displayName: 'Amit' },

  // Shared fallback so a device that has not been assigned to anyone still
  // works. Its history entries read "Showroom (shared)" rather than naming a
  // person, so delete it once everyone has their own account.
  { username: 'user', password: 'devyora@user', role: 'user', displayName: 'Showroom (shared)' },
]

/** Returns the matching account, or null when the pair is not recognised. */
export function resolveCredential(username: string, password: string): Credential | null {
  const match = CREDENTIALS.find(
    (credential) =>
      credential.username === username.trim().toLowerCase() && credential.password === password,
  )
  return match ?? null
}
