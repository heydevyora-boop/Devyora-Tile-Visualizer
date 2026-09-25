// Deployed copy of the saved-visualisation store used by the Vercel serverless
// functions in client/api/. Vercel only uploads files under the project Root
// Directory (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/services/.
import { randomUUID } from 'node:crypto'
import { describeDbError, getCollection } from './db.js'
import type { OwnerScope } from './clientsStore.js'
import { getRevision, markRevisionSaved, type GenerationContext } from './revisionsStore.js'

/**
 * A client's permanent record: the concepts a salesperson chose to keep.
 *
 * Generating is cheap to look at and easy to reject — most concepts are shown
 * once and dismissed. If every one of them landed here, a client's record would
 * be mostly failed experiments and the two or three that were actually agreed
 * would be impossible to find. So nothing arrives here by being generated. It
 * arrives because someone pressed Save to Client.
 *
 * Each record is one saved image, with the whole of how it came to be copied in
 * beside it. Opening a saved concept reads this record; it never regenerates,
 * which is what makes it safe to show a customer the thing they already agreed.
 */
export interface SavedVisualisation {
  id: string
  /** Owner, from the verified session — never the browser. */
  salesperson: string
  salespersonName: string
  customerId: string | null
  customerName: string | null
  architectId: string | null
  architectName: string | null
  /** The consultation this came out of, and which concept of it. */
  generationId: string
  revisionId: string
  /** 1 for the first concept of the consultation, then 2, 3 … */
  revision: number
  /** Why another concept was asked for, where this was one. */
  revisionReasons: string[]
  revisionNote: string
  originalTileImage: string | null
  croppedTileImage: string | null
  tileSize: string | null
  /** The area this belongs under in the client's record. */
  space: string | null
  spacePath: { id: string; name: string }[]
  styleName: string | null
  jointName: string | null
  jointWidthMm: number | null
  patternName: string | null
  additionalRequirement: string | null
  /** The kept image itself — a Drive URL, or a base64 fallback. */
  image: string
  /** When the concept was produced, and when it was kept. */
  generatedAt: string
  savedAt: string
}

interface SavedDoc extends Omit<SavedVisualisation, 'id'> {
  _id: string
}

/** Thrown for a bad request; carries the HTTP status to return. */
export class SavedVisualisationsError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'SavedVisualisationsError'
    this.status = status
  }
}

const COLLECTION = 'savedVisualisations'

let indexesReady: Promise<void> | null = null

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const collection = await getCollection<SavedDoc>(COLLECTION)
      await Promise.all([
        collection.createIndex({ salesperson: 1, savedAt: -1 }),
        // A client's record, and the areas within it.
        collection.createIndex({ customerId: 1, space: 1, savedAt: -1 }),
        collection.createIndex({ architectId: 1, savedAt: -1 }),
        // Saving the same concept twice keeps one record rather than two.
        collection.createIndex({ revisionId: 1 }, { unique: true }),
      ])
    })().catch((error: unknown) => {
      indexesReady = null
      // An index is how these reads stay fast; it is not what makes them
      // correct. A database that refuses to create one would otherwise take
      // every screen down with it, so the failure is recorded and the query
      // goes ahead.
      console.error('[saved-visualisations] index setup skipped:', describeDbError(error))
    })
  }
  await indexesReady
}

function ownerFilter(scope: OwnerScope): Record<string, unknown> {
  return scope.isAdmin ? {} : { salesperson: scope.salesperson }
}

function toSaved(doc: SavedDoc): SavedVisualisation {
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

function optionalImage(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

/**
 * Keeps one generated concept in the client's permanent record.
 *
 * The caller names a concept, not a payload: everything describing it is read
 * from what the server itself recorded when the image was made, so a browser
 * cannot file a concept under a different client, a different style, or a
 * different salesperson than the one it was generated for. The only thing taken
 * from the request is the uncropped tile photo, which never reaches the server
 * during generation and exists nowhere else.
 */
export async function saveVisualisation(
  scope: OwnerScope,
  input: { revisionId?: unknown; originalTileImage?: unknown },
): Promise<SavedVisualisation> {
  await ensureIndexes()

  const revisionId = typeof input.revisionId === 'string' ? input.revisionId.trim() : ''
  if (!revisionId) {
    throw new SavedVisualisationsError('Which concept should be saved?')
  }

  // Scoped: a concept belonging to another salesperson is simply not found.
  const revision = await getRevision(scope, revisionId)
  if (!revision) {
    throw new SavedVisualisationsError('That concept was not found.', 404)
  }

  const collection = await getCollection<SavedDoc>(COLLECTION)

  // Pressing Save twice is the same intent as pressing it once.
  const existing = await collection.findOne({ revisionId })
  if (existing) return toSaved(existing)

  const context: GenerationContext = revision.context
  const doc: SavedDoc = {
    _id: randomUUID(),
    salesperson: revision.salesperson,
    salespersonName: context.salespersonName,
    customerId: revision.customerId,
    customerName: context.customerName,
    architectId: context.architectId,
    architectName: context.architectName,
    generationId: revision.generationId,
    revisionId: revision.id,
    revision: revision.revision,
    revisionReasons: revision.reasonNames,
    revisionNote: revision.note,
    // The uncropped photo only ever exists in the browser, so it is the one
    // field the request supplies; the recorded context wins where it has one.
    originalTileImage: context.originalTileImage ?? optionalImage(input.originalTileImage),
    croppedTileImage: context.croppedTileImage,
    tileSize: context.tileSize,
    space: context.space,
    spacePath: context.spacePath,
    styleName: context.styleName,
    jointName: context.jointName,
    jointWidthMm: context.jointWidthMm,
    patternName: context.patternName,
    additionalRequirement: context.additionalRequirement,
    image: revision.imageUrl,
    generatedAt: revision.createdAt,
    savedAt: new Date().toISOString(),
  }

  await collection.insertOne(doc)
  // The chain and the client record agree about what was kept.
  await markRevisionSaved(scope, revision.id, doc.savedAt).catch((error: unknown) => {
    console.error('[saved-visualisations] could not flag the concept as saved:', describeDbError(error))
  })
  return toSaved(doc)
}

/** A salesperson's saved work, newest first, optionally for one client. */
export async function listSavedVisualisations(
  scope: OwnerScope,
  options: { customerId?: string; architectId?: string } = {},
): Promise<SavedVisualisation[]> {
  await ensureIndexes()
  const collection = await getCollection<SavedDoc>(COLLECTION)
  const docs = await collection
    .find({
      ...ownerFilter(scope),
      ...(options.customerId ? { customerId: options.customerId } : {}),
      ...(options.architectId ? { architectId: options.architectId } : {}),
    })
    .sort({ savedAt: -1 })
    .limit(500)
    .toArray()
  return docs.map(toSaved)
}

/**
 * One saved concept, in full.
 *
 * This is what opening a saved image reads. It returns the stored record and
 * nothing else — no model is called, so what the customer agreed to is what
 * they are shown, however long afterwards.
 */
export async function getSavedVisualisation(
  scope: OwnerScope,
  id: string,
): Promise<SavedVisualisation | null> {
  await ensureIndexes()
  const collection = await getCollection<SavedDoc>(COLLECTION)
  const doc = await collection.findOne({ _id: id, ...ownerFilter(scope) })
  return doc ? toSaved(doc) : null
}

/** Removes a concept from the client's record. The concept itself stays in the chain. */
export async function removeSavedVisualisation(scope: OwnerScope, id: string): Promise<boolean> {
  await ensureIndexes()
  const collection = await getCollection<SavedDoc>(COLLECTION)
  const doc = await collection.findOne({ _id: id, ...ownerFilter(scope) })
  if (!doc) return false
  await collection.deleteOne({ _id: id })
  await markRevisionSaved(scope, doc.revisionId, '').catch(() => {})
  return true
}
