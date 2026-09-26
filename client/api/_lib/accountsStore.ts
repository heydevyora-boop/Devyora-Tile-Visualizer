// Deployed copy of the accounts store used by the Vercel serverless functions
// in client/api/. Vercel only uploads files under the project Root Directory
// (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/services/.
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getCollection } from './db.js'

/**
 * Who may sign in.
 *
 * These lived in the AUTH_ACCOUNTS_JSON environment variable, which a running
 * app cannot edit: adding a salesperson meant editing a variable and
 * redeploying, and only someone with access to the hosting dashboard could do
 * it. They are rows now, so the showroom can eventually manage its own people.
 *
 * The password itself is never stored — only its bcrypt hash, exactly as the
 * environment variable held it. Nothing here can recover a password, and this
 * module is only ever imported by server-side code.
 */
export type AccountRole = 'admin' | 'user'

export interface AccountRecord {
  id: string
  /**
   * Trimmed and lowercased. Sign-in has always matched case-insensitively and
   * the session token has always carried the lowercased form, so the stored
   * value is normalised once here rather than at every comparison.
   */
  username: string
  /** A bcrypt hash of the password — never the password. */
  passwordHash: string
  role: AccountRole
  /** Shown against this person's work in the admin history. */
  displayName: string
  createdAt: string
  updatedAt: string
}

interface AccountDoc extends Omit<AccountRecord, 'id'> {
  _id: string
}

/**
 * An account as everything outside this module is allowed to see it.
 *
 * Structurally missing the password hash rather than merely omitting it at
 * each call site: a route cannot leak a field its type does not have, so this
 * is what every function here returns except the one sign-in itself uses.
 */
export type AccountSummary = Omit<AccountRecord, 'passwordHash'>

export class AccountsError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AccountsError'
    this.status = status
  }
}

const COLLECTION = 'accounts'

/** The form a username is stored and matched in. */
export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase()
}

let indexesReady: Promise<void> | null = null

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const collection = await getCollection<AccountDoc>(COLLECTION)
      await collection.createIndex({ username: 1 }, { unique: true })
    })().catch((error: unknown) => {
      // Retry on a later call rather than caching the failure. A missing index
      // must never be the reason nobody can sign in: the lookup below is
      // correct without it, and the seed creates it explicitly, which is where
      // uniqueness actually has to hold.
      indexesReady = null
      console.error('[accounts] index setup skipped:', error)
    })
  }
  return indexesReady
}

function toRecord(doc: AccountDoc): AccountRecord {
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

function toSummary(doc: AccountDoc): AccountSummary {
  const { _id, passwordHash: _passwordHash, ...rest } = doc
  return { id: _id, ...rest }
}

/** The same cost the existing hashes were generated with. */
const BCRYPT_ROUNDS = 10

/**
 * A username someone can actually type at a sign-in prompt.
 *
 * Deliberately narrow: no spaces or punctuation beyond a dot, dash or
 * underscore, because a username that needs explaining over the phone is a
 * support call waiting to happen.
 */
function requireUsername(value: unknown): string {
  const username = normaliseUsername(typeof value === 'string' ? value : '')
  if (!username) throw new AccountsError('A username is required.')
  if (!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(username)) {
    throw new AccountsError(
      'A username must be 2 to 40 characters, using only letters, numbers, dots, dashes or underscores.',
    )
  }
  return username
}

/**
 * Bounded at 72 because that is where bcrypt stops reading. Accepting more
 * would silently ignore the rest, and a password that is not entirely checked
 * is worse than one that was refused.
 */
function requirePassword(value: unknown): string {
  const password = typeof value === 'string' ? value : ''
  if (password.length < 8) throw new AccountsError('A password must be at least 8 characters.')
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new AccountsError('A password must be at most 72 bytes.')
  }
  return password
}

function requireDisplayName(value: unknown): string {
  const displayName = typeof value === 'string' ? value.trim() : ''
  if (!displayName) throw new AccountsError('A display name is required.')
  if (displayName.length > 60) throw new AccountsError('That display name is too long.')
  return displayName
}

function requireRole(value: unknown): AccountRole {
  if (value === 'admin' || value === 'user') return value
  throw new AccountsError('A role must be either "admin" or "user".')
}

/**
 * The account a username belongs to, or null.
 *
 * Deliberately says nothing about why it found nothing — the caller compares
 * against a dummy hash either way, so a username that does not exist costs the
 * same time as one that does.
 */
export async function findAccountByUsername(username: string): Promise<AccountRecord | null> {
  await ensureIndexes()
  const collection = await getCollection<AccountDoc>(COLLECTION)
  const doc = await collection.findOne({ username: normaliseUsername(username) })
  return doc ? toRecord(doc) : null
}

/**
 * Every account, oldest first, without password hashes.
 *
 * findAccountByUsername above is the only thing in this module that hands back
 * a hash, and sign-in is its only caller. Everything else — the admin list,
 * the seed's report, the responses to every endpoint — goes through this
 * shape, so a hash has no route out of here.
 */
export async function listAccounts(): Promise<AccountSummary[]> {
  await ensureIndexes()
  const collection = await getCollection<AccountDoc>(COLLECTION)
  const docs = await collection.find({}).sort({ createdAt: 1 }).toArray()
  return docs.map(toSummary)
}

export async function countAccounts(): Promise<number> {
  const collection = await getCollection<AccountDoc>(COLLECTION)
  return collection.countDocuments({})
}

/**
 * Writes one account, keyed on its username.
 *
 * Used by the one-time seed. Keyed on the username rather than an id so that
 * running the seed twice updates the same row instead of creating a second
 * account for the same person, and `createdAt` survives a re-run.
 */
export async function upsertAccountByUsername(input: {
  username: string
  passwordHash: string
  role: AccountRole
  displayName: string
}): Promise<{ record: AccountRecord; created: boolean }> {
  await ensureIndexes()
  const collection = await getCollection<AccountDoc>(COLLECTION)

  const username = normaliseUsername(input.username)
  if (!username) throw new AccountsError('A username is required.')
  if (!input.passwordHash) throw new AccountsError('A password hash is required.')
  if (input.role !== 'admin' && input.role !== 'user') {
    throw new AccountsError(`Unknown role for "${username}".`)
  }

  const now = new Date().toISOString()
  const existing = await collection.findOne({ username })
  const doc: AccountDoc = {
    _id: existing?._id ?? randomUUID(),
    username,
    passwordHash: input.passwordHash,
    role: input.role,
    displayName: input.displayName,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await collection.replaceOne({ username }, doc, { upsert: true })
  return { record: toRecord(doc), created: !existing }
}


/**
 * Adds a salesperson or administrator.
 *
 * The password arrives in the clear and leaves as a bcrypt hash without ever
 * being written down in between: hashing happens here rather than in the
 * route so that no caller can forget to do it, and nothing logs the argument.
 */
export async function createAccount(input: {
  username?: unknown
  password?: unknown
  role?: unknown
  displayName?: unknown
}): Promise<AccountSummary> {
  await ensureIndexes()
  const collection = await getCollection<AccountDoc>(COLLECTION)

  const username = requireUsername(input.username)
  const password = requirePassword(input.password)
  // A new account is a salesperson unless someone deliberately says otherwise:
  // the privileged role is the one that has to be asked for by name.
  const role = input.role === undefined ? 'user' : requireRole(input.role)
  const displayName = requireDisplayName(input.displayName)

  if (await collection.findOne({ username })) {
    throw new AccountsError(`"${username}" is already taken.`, 409)
  }

  const now = new Date().toISOString()
  const doc: AccountDoc = {
    _id: randomUUID(),
    username,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    role,
    displayName,
    createdAt: now,
    updatedAt: now,
  }
  await collection.insertOne(doc)
  return toSummary(doc)
}

/**
 * Edits one account: its username, its display name, its role, or its
 * password. Anything left out is left alone.
 *
 * A new password replaces the old hash and is never recoverable from what is
 * stored — resetting is the only way back in, which is the point.
 */
export async function updateAccount(
  username: string,
  changes: {
    username?: unknown
    password?: unknown
    role?: unknown
    displayName?: unknown
  },
): Promise<AccountSummary> {
  await ensureIndexes()
  const collection = await getCollection<AccountDoc>(COLLECTION)

  const existing = await collection.findOne({ username: normaliseUsername(username) })
  if (!existing) throw new AccountsError('That account was not found.', 404)

  const next: Partial<AccountDoc> = {}

  if (changes.username !== undefined) {
    const wanted = requireUsername(changes.username)
    if (wanted !== existing.username) {
      // Checked rather than left to the unique index, so a collision reads as
      // "that name is taken" instead of a driver error.
      if (await collection.findOne({ username: wanted })) {
        throw new AccountsError(`"${wanted}" is already taken.`, 409)
      }
      next.username = wanted
    }
  }
  if (changes.password !== undefined) {
    next.passwordHash = await bcrypt.hash(requirePassword(changes.password), BCRYPT_ROUNDS)
  }
  if (changes.role !== undefined) next.role = requireRole(changes.role)
  if (changes.displayName !== undefined) next.displayName = requireDisplayName(changes.displayName)

  if (Object.keys(next).length === 0) return toSummary(existing)

  next.updatedAt = new Date().toISOString()
  await collection.updateOne({ _id: existing._id }, { $set: next })
  return toSummary({ ...existing, ...next })
}
