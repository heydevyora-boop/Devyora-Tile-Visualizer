// Deployed copy of the auth module used by the Vercel serverless functions in
// client/api/. Vercel only uploads files under the project Root Directory
// (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/config/.
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export type Role = 'admin' | 'user'

export interface Account {
  /** Matched case-insensitively against the submitted username. */
  username: string
  /** A bcrypt hash of the account's password — never the plaintext password. */
  passwordHash: string
  role: Role
  /** Shown against this person's work in the admin history. */
  displayName: string
}

export interface SessionPayload {
  /** The account's username, lowercased. */
  sub: string
  role: Role
  displayName: string
}

/**
 * Showroom sign-in accounts, loaded from the server-only AUTH_ACCOUNTS_JSON
 * env var. This file is only ever imported by server-side route handlers —
 * it is never bundled into anything served to the browser.
 *
 * Format: a JSON array of {username, passwordHash, role, displayName}.
 * Generate a passwordHash for a new account with:
 *   node -e "console.log(require('bcryptjs').hashSync('the-password', 10))"
 *
 * ── TO ADD A SALESPERSON ─────────────────────────────────────────────────
 * Hash their password with the command above, add an entry to the
 * AUTH_ACCOUNTS_JSON array (role: "user"), redeploy.
 *
 * ── TO REMOVE SOMEONE ────────────────────────────────────────────────────
 * Delete their entry from AUTH_ACCOUNTS_JSON, redeploy. Nobody else's
 * password changes.
 */
function loadAccounts(): Account[] {
  const raw = process.env.AUTH_ACCOUNTS_JSON
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is Account => {
      const candidate = entry as Partial<Account> | null
      return (
        !!candidate &&
        typeof candidate === 'object' &&
        typeof candidate.username === 'string' &&
        typeof candidate.passwordHash === 'string' &&
        (candidate.role === 'admin' || candidate.role === 'user') &&
        typeof candidate.displayName === 'string'
      )
    })
  } catch (error) {
    console.error('[auth] AUTH_ACCOUNTS_JSON is not valid JSON — no accounts loaded:', error)
    return []
  }
}

function findAccount(username: string): Account | null {
  const target = username.trim().toLowerCase()
  return loadAccounts().find((account) => account.username.trim().toLowerCase() === target) ?? null
}

/**
 * A real bcrypt hash of an unguessable value, compared against when the
 * submitted username does not match any account. Without this, a login
 * attempt for a nonexistent username returns much faster than one for a real
 * username with the wrong password (no bcrypt work done) — a timing
 * side-channel that reveals which usernames exist. Comparing against this
 * hash either way keeps the response time consistent.
 */
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8u62c6Ka.PNQI2q7f5Ei5yV2H9c.Pa'

/** Verifies a username/password pair against the server-side account list. */
export async function verifyCredentials(username: string, password: string): Promise<Account | null> {
  const account = findAccount(username)
  const ok = await bcrypt.compare(password, account?.passwordHash ?? DUMMY_HASH)
  return ok && account ? account : null
}

const TOKEN_TTL = '12h'

export class AuthConfigError extends Error {}

function requireSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret) {
    throw new AuthConfigError('AUTH_JWT_SECRET is not configured on the server.')
  }
  return secret
}

/** Signs a session token for a verified account. */
export function signSessionToken(account: Account): string {
  const payload: SessionPayload = {
    sub: account.username.trim().toLowerCase(),
    role: account.role,
    displayName: account.displayName,
  }
  return jwt.sign(payload, requireSecret(), { expiresIn: TOKEN_TTL })
}

function isSessionPayload(value: unknown): value is SessionPayload {
  const candidate = value as Partial<SessionPayload> | null
  return (
    !!candidate &&
    typeof candidate === 'object' &&
    typeof candidate.sub === 'string' &&
    (candidate.role === 'admin' || candidate.role === 'user') &&
    typeof candidate.displayName === 'string'
  )
}

/** Verifies a session token's signature and expiry. Returns null for anything invalid. */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, requireSecret())
    return isSessionPayload(decoded) ? decoded : null
  } catch {
    return null
  }
}

/** Extracts and verifies the bearer token from a standard Authorization header. */
export function verifyAuthHeader(header: string | undefined): SessionPayload | null {
  if (!header?.startsWith('Bearer ')) return null
  return verifySessionToken(header.slice('Bearer '.length).trim())
}
