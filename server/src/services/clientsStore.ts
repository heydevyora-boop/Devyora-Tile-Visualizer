// Local-dev copy of the client/architect store used by the Express server.
// KEEP IN SYNC with the deployed Vercel copy in client/api/_lib/clientsStore.ts.
import { randomUUID } from 'node:crypto'
import { describeDbError, getCollection } from './db'

/**
 * The showroom's client book.
 *
 * Hierarchy, as the showroom works:
 *   salesperson -> architect/contractor -> customer -> visualisations
 *   salesperson -> customer (direct, no architect)
 *
 * An architect brings multiple customers; a walk-in customer has none. That is
 * the only difference between the two paths, so a customer simply carries an
 * architectId or null rather than there being two kinds of customer.
 *
 * Every record is owned by the salesperson who created it. Reads are scoped to
 * that owner so one salesperson never sees another's client book; an admin
 * reviews everything.
 */

export interface Architect {
  id: string
  /** Username (JWT `sub`) of the salesperson who owns this record. */
  salesperson: string
  name: string
  mobile: string
  createdAt: string
}

export interface Customer {
  id: string
  salesperson: string
  /** The architect/contractor who introduced them, or null for a direct customer. */
  architectId: string | null
  name: string
  mobile: string
  createdAt: string
}

interface ArchitectDoc extends Omit<Architect, 'id'> {
  _id: string
}

interface CustomerDoc extends Omit<Customer, 'id'> {
  _id: string
}

/** Who is asking, and therefore what they are allowed to see. */
export interface OwnerScope {
  /** The signed-in account's username. */
  salesperson: string
  /** Admins review every salesperson's records; salespeople see only their own. */
  isAdmin: boolean
}

/** Builds a read scope from a verified session. */
export function toOwnerScope(session: { sub: string; role: string }): OwnerScope {
  return { salesperson: session.sub, isAdmin: session.role === 'admin' }
}

/** Thrown for a bad request; carries the HTTP status to return. */
export class ClientsStoreError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ClientsStoreError'
    this.status = status
  }
}

const ARCHITECTS = 'architects'
const CUSTOMERS = 'customers'

/**
 * Indexes are created once per warm instance. createIndex is idempotent, so
 * repeating it across instances costs a no-op round trip rather than an error.
 */
let indexesReady: Promise<void> | null = null

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const architects = await getCollection<ArchitectDoc>(ARCHITECTS)
      const customers = await getCollection<CustomerDoc>(CUSTOMERS)
      await Promise.all([
        // One person cannot be entered twice in the same salesperson's book.
        architects.createIndex({ salesperson: 1, mobile: 1 }, { unique: true }),
        customers.createIndex({ salesperson: 1, mobile: 1 }, { unique: true }),
        // Listing and searching are always scoped to an owner.
        architects.createIndex({ salesperson: 1, name: 1 }),
        customers.createIndex({ salesperson: 1, name: 1 }),
        customers.createIndex({ salesperson: 1, architectId: 1 }),
      ])
    })().catch((error: unknown) => {
      // Retry on a later request rather than caching the failure.
      indexesReady = null
      // An index is how these reads stay fast; it is not what makes them
      // correct. A database that refuses to create one — a read-only user, a
      // cluster mid-failover — would otherwise take every screen down with it,
      // so the failure is recorded and the query goes ahead. A genuine
      // connection problem still surfaces, with its own cause, on the query
      // itself a moment later.
      console.error(`[${'clients'}] index setup skipped:`, describeDbError(error))
    })
  }
  await indexesReady
}

/** Restricts a query to what this caller may read. */
function ownerFilter(scope: OwnerScope): Record<string, unknown> {
  return scope.isAdmin ? {} : { salesperson: scope.salesperson }
}

/** Trims a required free-text field, rejecting blank input. */
function requireText(value: unknown, field: string, max = 120): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new ClientsStoreError(`${field} is required.`)
  if (text.length > max) throw new ClientsStoreError(`${field} is too long.`)
  return text
}

/**
 * Normalises a mobile number to digits (keeping a leading +) so the same
 * person typed as "98765 43210" and "9876543210" is recognised as one record
 * by the unique index rather than entered twice.
 */
function requireMobile(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) throw new ClientsStoreError('Mobile number is required.')
  const normalised = raw.startsWith('+')
    ? `+${raw.slice(1).replace(/\D/g, '')}`
    : raw.replace(/\D/g, '')
  const digits = normalised.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) {
    throw new ClientsStoreError('Please enter a valid mobile number.')
  }
  return normalised
}

/** True for the driver's duplicate-key error. */
function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number })?.code === 11000
}

function toArchitect(doc: ArchitectDoc): Architect {
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

function toCustomer(doc: CustomerDoc): Customer {
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

/** Escapes a user-typed search term so it cannot act as a regex. */
function searchPattern(term: string): RegExp {
  return new RegExp(term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

/** Name-or-mobile search, applied only when the caller supplied a term. */
function searchFilter(query: string | undefined): Record<string, unknown> {
  const term = query?.trim()
  if (!term) return {}
  const pattern = searchPattern(term)
  return { $or: [{ name: pattern }, { mobile: pattern }] }
}

export async function createArchitect(
  scope: OwnerScope,
  input: { name?: unknown; mobile?: unknown },
): Promise<Architect> {
  await ensureIndexes()
  const doc: ArchitectDoc = {
    _id: randomUUID(),
    salesperson: scope.salesperson,
    name: requireText(input.name, 'Name'),
    mobile: requireMobile(input.mobile),
    createdAt: new Date().toISOString(),
  }
  try {
    await (await getCollection<ArchitectDoc>(ARCHITECTS)).insertOne(doc)
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new ClientsStoreError(
        'An architect with that mobile number is already saved. Pick them from the existing list.',
        409,
      )
    }
    throw error
  }
  return toArchitect(doc)
}

export async function listArchitects(scope: OwnerScope, query?: string): Promise<Architect[]> {
  await ensureIndexes()
  const collection = await getCollection<ArchitectDoc>(ARCHITECTS)
  const docs = await collection
    .find({ ...ownerFilter(scope), ...searchFilter(query) })
    .sort({ name: 1 })
    .limit(200)
    .toArray()
  return docs.map(toArchitect)
}

export async function createCustomer(
  scope: OwnerScope,
  input: { name?: unknown; mobile?: unknown; architectId?: unknown },
): Promise<Customer> {
  await ensureIndexes()

  // A customer may be introduced by an architect, but only one this caller
  // owns — otherwise an id from another salesperson's book would link across.
  let architectId: string | null = null
  if (input.architectId !== undefined && input.architectId !== null && input.architectId !== '') {
    architectId = String(input.architectId)
    const architects = await getCollection<ArchitectDoc>(ARCHITECTS)
    const owner = await architects.findOne({ _id: architectId, ...ownerFilter(scope) })
    if (!owner) throw new ClientsStoreError('That architect/contractor was not found.', 404)
  }

  const doc: CustomerDoc = {
    _id: randomUUID(),
    salesperson: scope.salesperson,
    architectId,
    name: requireText(input.name, 'Client name'),
    mobile: requireMobile(input.mobile),
    createdAt: new Date().toISOString(),
  }
  try {
    await (await getCollection<CustomerDoc>(CUSTOMERS)).insertOne(doc)
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new ClientsStoreError(
        'A client with that mobile number is already saved. Pick them from the existing list.',
        409,
      )
    }
    throw error
  }
  return toCustomer(doc)
}

export async function listCustomers(
  scope: OwnerScope,
  options: { query?: string; architectId?: string } = {},
): Promise<Customer[]> {
  await ensureIndexes()
  const collection = await getCollection<CustomerDoc>(CUSTOMERS)
  const docs = await collection
    .find({
      ...ownerFilter(scope),
      ...searchFilter(options.query),
      ...(options.architectId ? { architectId: options.architectId } : {}),
    })
    .sort({ name: 1 })
    .limit(200)
    .toArray()
  return docs.map(toCustomer)
}

/** One customer, or null when it does not exist or belongs to someone else. */
export async function getCustomer(scope: OwnerScope, id: string): Promise<Customer | null> {
  await ensureIndexes()
  const collection = await getCollection<CustomerDoc>(CUSTOMERS)
  const doc = await collection.findOne({ _id: id, ...ownerFilter(scope) })
  return doc ? toCustomer(doc) : null
}
