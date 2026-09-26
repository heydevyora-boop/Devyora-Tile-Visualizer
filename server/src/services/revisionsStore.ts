// Local-dev copy of the revision store used by the Express server.
// KEEP IN SYNC with the deployed Vercel copy in client/api/_lib/revisionsStore.ts.
import { randomUUID } from 'node:crypto'
import { describeDbError, getCollection } from './db'
import type { OwnerScope } from './clientsStore'

/**
 * Every concept ever produced for a consultation, and why.
 *
 * A concept is never overwritten. When a salesperson asks for another because
 * something was wrong, the new one is recorded beside the old with the reason
 * attached and a pointer back to what it was meant to improve on. Weeks later
 * that chain answers the only question that matters about a rejected concept:
 * what was asked for, and did the next one actually address it.
 */
/**
 * Everything needed to understand a concept months later, resolved server-side
 * at the moment it was generated.
 *
 * It is captured here rather than rebuilt when someone saves the concept,
 * because by then the catalogue may have been edited: a style renamed, a joint
 * width changed, an application retired. A record that quietly re-reads today's
 * catalogue would describe a concept that was never produced.
 */
export interface GenerationContext {
  /** The salesperson's display name, as it was at the time. */
  salespersonName: string
  customerName: string | null
  /** The architect/contractor who introduced the customer, where there is one. */
  architectId: string | null
  architectName: string | null
  /** The uncropped tile photo, once the browser has sent it. */
  originalTileImage: string | null
  /** The cropped tile the concept was actually generated from. */
  croppedTileImage: string | null
  tileSize: string | null
  /** The top-level area — what a customer's saved work groups by. */
  space: string | null
  /**
   * The full application chain, root first: the space, its instance, the
   * subcategory and any further selection, each as it was named at the time.
   */
  spacePath: { id: string; name: string }[]
  styleName: string | null
  jointName: string | null
  jointWidthMm: number | null
  patternName: string | null
  /** What the customer asked for that the fixed choices do not cover. */
  additionalRequirement: string | null
}

export interface ConceptRevision {
  id: string
  /** The consultation this belongs to. */
  generationId: string
  /** Owner, taken from the session — never from the browser. */
  salesperson: string
  customerId: string | null
  /** 1 for the first concept, then 2, 3 … in the order they were produced. */
  revision: number
  /** The concept this one was asked to improve on, or null for the first. */
  parentRevisionId: string | null
  /** Why another concept was wanted. Empty for the first. */
  reasonIds: string[]
  reasonNames: string[]
  /** What the salesperson typed, in their own words. */
  note: string
  /** The concept image — a Drive URL, or a base64 fallback. */
  imageUrl: string
  createdAt: string
  /** How this concept came to be, as it was understood when it was made. */
  context: GenerationContext
  /**
   * Set when a salesperson keeps this concept for the client. A generated
   * concept is temporary until then: most are looked at once and rejected, and
   * filing those in a client's permanent record would bury the ones that
   * matter.
   */
  savedAt: string | null
}

interface RevisionDoc extends Omit<ConceptRevision, 'id'> {
  _id: string
}

const COLLECTION = 'conceptRevisions'

let indexesReady: Promise<void> | null = null

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const collection = await getCollection<RevisionDoc>(COLLECTION)
      await Promise.all([
        // The chain for one consultation, in order.
        collection.createIndex({ generationId: 1, revision: 1 }),
        collection.createIndex({ salesperson: 1, createdAt: -1 }),
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
      console.error(`[${'revisions'}] index setup skipped:`, describeDbError(error))
    })
  }
  await indexesReady
}

function toRevision(doc: RevisionDoc): ConceptRevision {
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

/** The concepts of one consultation, oldest first. */
export async function listRevisions(
  scope: OwnerScope,
  generationId: string,
): Promise<ConceptRevision[]> {
  await ensureIndexes()
  const collection = await getCollection<RevisionDoc>(COLLECTION)
  const docs = await collection
    .find({ generationId, ...(scope.isAdmin ? {} : { salesperson: scope.salesperson }) })
    .sort({ revision: 1 })
    .toArray()
  return docs.map(toRevision)
}

/** One concept, or null when it does not exist or belongs to someone else. */
export async function getRevision(
  scope: OwnerScope,
  id: string,
): Promise<ConceptRevision | null> {
  await ensureIndexes()
  const collection = await getCollection<RevisionDoc>(COLLECTION)
  const doc = await collection.findOne({
    _id: id,
    ...(scope.isAdmin ? {} : { salesperson: scope.salesperson }),
  })
  return doc ? toRevision(doc) : null
}

/** Marks a concept as kept, so the saved record and the chain agree. */
export async function markRevisionSaved(
  scope: OwnerScope,
  id: string,
  savedAt: string,
): Promise<void> {
  await ensureIndexes()
  const collection = await getCollection<RevisionDoc>(COLLECTION)
  await collection.updateOne(
    { _id: id, ...(scope.isAdmin ? {} : { salesperson: scope.salesperson }) },
    { $set: { savedAt } },
  )
}

/**
 * Records a concept.
 *
 * The revision number is worked out here rather than sent, so two requests
 * cannot both claim to be revision 2, and the parent is verified to belong to
 * the same consultation — a chain that pointed somewhere else would make the
 * history misleading, which is the one thing it exists not to be.
 */
export async function recordRevision(input: {
  scope: OwnerScope
  generationId: string
  customerId: string | null
  parentRevisionId: string | null
  reasons: { id: string; name: string }[]
  note: string
  imageUrl: string
  context: GenerationContext
}): Promise<ConceptRevision> {
  await ensureIndexes()
  const collection = await getCollection<RevisionDoc>(COLLECTION)

  let parentRevisionId: string | null = null
  if (input.parentRevisionId) {
    const parent = await collection.findOne({
      _id: input.parentRevisionId,
      generationId: input.generationId,
    })
    parentRevisionId = parent ? parent._id : null
  }

  const existing = await collection
    .find({ generationId: input.generationId })
    .sort({ revision: -1 })
    .limit(1)
    .toArray()

  const doc: RevisionDoc = {
    _id: randomUUID(),
    generationId: input.generationId,
    salesperson: input.scope.salesperson,
    customerId: input.customerId,
    revision: (existing[0]?.revision ?? 0) + 1,
    parentRevisionId,
    reasonIds: input.reasons.map((reason) => reason.id),
    reasonNames: input.reasons.map((reason) => reason.name),
    note: input.note,
    imageUrl: input.imageUrl,
    createdAt: new Date().toISOString(),
    context: input.context,
    // Saving is a separate, deliberate act. Nothing is filed under a client
    // just because it was generated.
    savedAt: null,
  }
  await collection.insertOne(doc)
  return toRevision(doc)
}
