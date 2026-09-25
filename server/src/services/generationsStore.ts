// Local-dev copy of the generation-history store used by the Express server.
// KEEP IN SYNC with the deployed Vercel copy in client/api/_lib/generationsStore.ts.
import { describeDbError, getCollection } from './db'
import type { OwnerScope } from './clientsStore'

/**
 * Saved visualisations.
 *
 * Previously a JSON file. On Vercel that file could only live in /tmp, which
 * is per-instance and wiped on cold start, so saved work disappeared in
 * production. It is a MongoDB collection now, which also lets a visualisation
 * belong to a customer and be listed back per salesperson.
 */
export interface GenerationRecord {
  generationId: string
  /** The salesperson's display name, shown against the work in the history. */
  userName: string
  /**
   * Username (JWT `sub`) of the salesperson who generated this. Set from the
   * session server-side, never from the request body, so a caller cannot file
   * work under someone else's name.
   */
  salesperson: string
  /** The customer this belongs to, once the client-first flow supplies one. */
  customerId: string | null
  /** The room this visualises — the "area" a customer's saved work groups by. */
  space: string | null
  style: string | null
  tileSize: string | null
  /** The cropped tile photo: a Drive URL, or a base64 data URL as fallback. */
  croppedImage: string
  /** The three generated concepts, in the same Drive-URL-or-base64 shape. */
  generatedImages: string[]
  /** ISO 8601 timestamp. */
  timestamp: string
}

interface GenerationDoc extends Omit<GenerationRecord, 'generationId'> {
  _id: string
}

/** Thrown for a malformed request body; carries the HTTP status to return. */
export class GenerationsStoreError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'GenerationsStoreError'
    this.status = status
  }
}

const GENERATIONS = 'generations'

let indexesReady: Promise<void> | null = null

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const collection = await getCollection<GenerationDoc>(GENERATIONS)
      await Promise.all([
        // Every listing is newest-first, either for everyone or for one owner.
        collection.createIndex({ timestamp: -1 }),
        collection.createIndex({ salesperson: 1, timestamp: -1 }),
        // A customer's saved work, and their areas within it.
        collection.createIndex({ customerId: 1, timestamp: -1 }),
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
      console.error(`[${'generations'}] index setup skipped:`, describeDbError(error))
    })
  }
  await indexesReady
}

function ownerFilter(scope: OwnerScope): Record<string, unknown> {
  return scope.isAdmin ? {} : { salesperson: scope.salesperson }
}

function toRecord(doc: GenerationDoc): GenerationRecord {
  const { _id, ...rest } = doc
  return { generationId: _id, ...rest }
}

function optionalText(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? text : null
}

/**
 * Validates the incoming payload and returns a clean record.
 *
 * Ownership comes from the verified session, not the body.
 */
export function toGenerationRecord(body: unknown, scope: OwnerScope): GenerationRecord {
  const { generationId, userName, croppedImage, generatedImages, timestamp, customerId, space, style, tileSize } =
    (body ?? {}) as Record<string, unknown>

  const missing: string[] = []
  if (!generationId) missing.push('generationId')
  if (!userName) missing.push('userName')
  if (!croppedImage) missing.push('croppedImage')
  if (!Array.isArray(generatedImages) || generatedImages.length === 0) {
    missing.push('generatedImages')
  }
  if (missing.length > 0) {
    throw new GenerationsStoreError(`Missing required field(s): ${missing.join(', ')}`)
  }

  return {
    generationId: String(generationId),
    userName: String(userName),
    salesperson: scope.salesperson,
    customerId: optionalText(customerId),
    space: optionalText(space),
    style: optionalText(style),
    tileSize: optionalText(tileSize),
    croppedImage: String(croppedImage),
    generatedImages: (generatedImages as unknown[]).map(String),
    // Accept a client timestamp, but fall back to server time if absent.
    timestamp: timestamp ? String(timestamp) : new Date().toISOString(),
  }
}

/**
 * Saves a record. Re-saving the same generationId replaces the earlier entry,
 * so a retry cannot produce duplicates.
 */
export async function appendGeneration(record: GenerationRecord): Promise<GenerationRecord> {
  await ensureIndexes()
  const { generationId, ...rest } = record
  const collection = await getCollection<GenerationDoc>(GENERATIONS)
  // The replacement omits _id (the driver forbids it); on upsert Mongo takes
  // the _id from the filter, so the id is preserved either way.
  await collection.replaceOne({ _id: generationId }, rest, { upsert: true })
  return record
}

/** Saved visualisations this caller may see, newest first. */
export async function listGenerations(
  scope: OwnerScope,
  options: { customerId?: string; limit?: number } = {},
): Promise<GenerationRecord[]> {
  await ensureIndexes()
  const collection = await getCollection<GenerationDoc>(GENERATIONS)
  const docs = await collection
    .find({
      ...ownerFilter(scope),
      ...(options.customerId ? { customerId: options.customerId } : {}),
    })
    .sort({ timestamp: -1 })
    .limit(options.limit ?? 200)
    .toArray()
  return docs.map(toRecord)
}
