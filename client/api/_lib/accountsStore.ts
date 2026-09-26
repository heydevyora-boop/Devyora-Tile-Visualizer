// Deployed copy of the accounts store used by the Vercel serverless functions
// in client/api/. Vercel only uploads files under the project Root Directory
// (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/services/.
import { randomUUID } from 'node:crypto'
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

/** Every account, oldest first. Used by the seed to report what it found. */
export async function listAccounts(): Promise<AccountRecord[]> {
  await ensureIndexes()
  const collection = await getCollection<AccountDoc>(COLLECTION)
  const docs = await collection.find({}).sort({ createdAt: 1 }).toArray()
  return docs.map(toRecord)
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
