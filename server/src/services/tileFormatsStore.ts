// Local-dev copy of the tile-format store used by the Express server.
// KEEP IN SYNC with the deployed Vercel copy in client/api/_lib/tileFormatsStore.ts.
import { randomUUID } from 'node:crypto'
import { getCollection } from './db'

/**
 * The standard tile formats offered at the start of a consultation.
 *
 * These live in the database rather than the frontend so the showroom can add
 * a format, correct one, retire one or change the order they appear in without
 * a code change and a redeploy. The browser only ever renders what this
 * returns.
 *
 * Dimensions are millimetres, always. No thickness is stored: it does not
 * change how a tile lays out on a surface, which is the only thing this
 * measurement is used for.
 */
export interface TileFormat {
  id: string
  lengthMm: number
  breadthMm: number
  /**
   * An optional name shown instead of the raw dimensions — "Large Format
   * Slab" reads better on a size-selection screen than "1200 × 2400 mm" on
   * its own. Null falls back to the dimensions, so naming a format is never
   * required to use one.
   */
  label: string | null
  /** A disabled format stays on record but is not offered in the flow. */
  active: boolean
  /** Ascending. The order the showroom wants them read in. */
  order: number
}

interface TileFormatDoc extends Omit<TileFormat, 'id'> {
  _id: string
}

export class TileFormatsError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'TileFormatsError'
    this.status = status
  }
}

const COLLECTION = 'tileFormats'

/**
 * What a new showroom starts with. Seeded once, on the first read of an empty
 * collection, and then owned entirely by the admin — editing or deleting these
 * is expected, and they are never re-inserted afterwards.
 */
const INITIAL_FORMATS: [number, number][] = [
  [300, 600],
  [600, 600],
  [600, 1200],
  [1200, 1800],
  [1200, 2400],
  [400, 1200],
  [500, 1200],
  [300, 300],
  [300, 450],
  [200, 200],
  [100, 100],
]

let indexesReady: Promise<void> | null = null

async function ensureReady(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const collection = await getCollection<TileFormatDoc>(COLLECTION)
      await collection.createIndex({ order: 1 })
      // Seeding is guarded by a count rather than an upsert: once the showroom
      // has edited the list, an empty result means they emptied it on purpose.
      if ((await collection.countDocuments({})) === 0) {
        await collection.insertMany(
          INITIAL_FORMATS.map(([lengthMm, breadthMm], index) => ({
            _id: randomUUID(),
            lengthMm,
            breadthMm,
            label: null,
            active: true,
            order: index,
          })),
        )
      }
    })().catch((error: unknown) => {
      indexesReady = null
      throw error
    })
  }
  return indexesReady
}

function toFormat(doc: TileFormatDoc): TileFormat {
  const { _id, label, ...rest } = doc
  return {
    id: _id,
    // Anything that is not a name is no name. Writing through this store can
    // only ever produce null or a real name, but a row edited by hand in the
    // database, or brought in by an import, can carry "" or "   " — and then
    // every reader has to decide for itself whether that counts as a label.
    // Normalised here, once, so that none of them have to.
    label: typeof label === 'string' && label.trim() ? label.trim() : null,
    ...rest,
  }
}

/** An optional name, trimmed to nothing rather than kept as whitespace. */
function optionalLabel(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > 60) throw new TileFormatsError('That name is too long.')
  return text || null
}

/** A dimension in millimetres, rejected unless it could describe a real tile. */
function requireDimension(value: unknown, field: string): number {
  const millimetres = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(millimetres) || !Number.isInteger(millimetres)) {
    throw new TileFormatsError(`${field} must be a whole number of millimetres.`)
  }
  if (millimetres < 10 || millimetres > 4000) {
    throw new TileFormatsError(`${field} must be between 10 mm and 4000 mm.`)
  }
  return millimetres
}

/** The formats offered in the flow, in the showroom's order. */
export async function listTileFormats(includeDisabled = false): Promise<TileFormat[]> {
  await ensureReady()
  const collection = await getCollection<TileFormatDoc>(COLLECTION)
  const docs = await collection
    .find(includeDisabled ? {} : { active: true })
    .sort({ order: 1 })
    .toArray()
  return docs.map(toFormat)
}

export async function createTileFormat(input: {
  lengthMm?: unknown
  breadthMm?: unknown
  label?: unknown
}): Promise<TileFormat> {
  await ensureReady()
  const collection = await getCollection<TileFormatDoc>(COLLECTION)
  const lengthMm = requireDimension(input.lengthMm, 'Length')
  const breadthMm = requireDimension(input.breadthMm, 'Breadth')

  if (await collection.findOne({ lengthMm, breadthMm })) {
    throw new TileFormatsError('That format is already in the list.', 409)
  }

  // New formats go to the end; the admin reorders from there.
  const last = await collection.find({}).sort({ order: -1 }).limit(1).toArray()
  const doc: TileFormatDoc = {
    _id: randomUUID(),
    lengthMm,
    breadthMm,
    label: optionalLabel(input.label),
    active: true,
    order: (last[0]?.order ?? -1) + 1,
  }
  await collection.insertOne(doc)
  return toFormat(doc)
}

/** Edits a format's dimensions, or enables/disables it. */
export async function updateTileFormat(
  id: string,
  changes: { lengthMm?: unknown; breadthMm?: unknown; label?: unknown; active?: unknown },
): Promise<TileFormat> {
  await ensureReady()
  const collection = await getCollection<TileFormatDoc>(COLLECTION)
  const existing = await collection.findOne({ _id: id })
  if (!existing) throw new TileFormatsError('That format was not found.', 404)

  const next: Partial<TileFormatDoc> = {}
  if (changes.lengthMm !== undefined) next.lengthMm = requireDimension(changes.lengthMm, 'Length')
  if (changes.breadthMm !== undefined) next.breadthMm = requireDimension(changes.breadthMm, 'Breadth')
  if (changes.label !== undefined) next.label = optionalLabel(changes.label)
  if (changes.active !== undefined) next.active = Boolean(changes.active)
  if (Object.keys(next).length === 0) return toFormat(existing)

  await collection.updateOne({ _id: id }, { $set: next })
  return toFormat({ ...existing, ...next })
}

/**
 * Rewrites the order from a list of ids.
 *
 * Ids the caller left out keep their place after the ones supplied, so a
 * partial list cannot silently shuffle the rest of the catalogue.
 */
export async function reorderTileFormats(ids: unknown): Promise<TileFormat[]> {
  await ensureReady()
  if (!Array.isArray(ids)) throw new TileFormatsError('An ordered list of ids is required.')
  const collection = await getCollection<TileFormatDoc>(COLLECTION)
  const known = new Set((await collection.find({}).toArray()).map((doc) => doc._id))

  const ordered = ids.map(String).filter((id) => known.has(id))
  await Promise.all(
    ordered.map((id, index) => collection.updateOne({ _id: id }, { $set: { order: index } })),
  )
  // Anything not named keeps a stable position behind the supplied run.
  const rest = [...known].filter((id) => !ordered.includes(id))
  await Promise.all(
    rest.map((id, index) =>
      collection.updateOne({ _id: id }, { $set: { order: ordered.length + index } }),
    ),
  )
  return listTileFormats(true)
}
