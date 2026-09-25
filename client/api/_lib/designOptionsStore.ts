// Deployed copy of the design-option store used by the Vercel serverless
// functions in client/api/. Vercel only uploads files under the project Root
// Directory (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/services/.
import { randomUUID } from 'node:crypto'
import { getCollection } from './db.js'

/**
 * The lists the showroom maintains for a consultation: the design style, the
 * grout joint width, the laying pattern, and the reasons a salesperson gives
 * when asking for another concept.
 *
 * They share one collection because they are the same shape — an ordered,
 * switchable list the showroom maintains — and differ only in what they mean.
 * Keeping them together means one admin screen and one set of rules rather
 * than three near-identical copies.
 */
export type DesignOptionKind = 'style' | 'joint' | 'pattern' | 'reason'

export interface DesignOption {
  id: string
  kind: DesignOptionKind
  name: string
  /** Shown to the salesperson, in the showroom's own words. */
  description: string
  imageUrl: string | null
  /**
   * Joint widths only: the width in millimetres. The number matters to the
   * generation, so it is stored rather than parsed back out of the name.
   */
  valueMm: number | null
  /**
   * Styles only: the id of the curated style config, where one exists. A style
   * the showroom adds later has none, and its description is used instead.
   */
  styleId: string | null
  order: number
  active: boolean
}

interface DesignOptionDoc extends Omit<DesignOption, 'id'> {
  _id: string
}

export class DesignOptionsError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'DesignOptionsError'
    this.status = status
  }
}

const COLLECTION = 'designOptions'
const KINDS: DesignOptionKind[] = ['style', 'joint', 'pattern', 'reason']

/**
 * What a new showroom starts with.
 *
 * Style descriptions are written the way the showroom talks to customers, so a
 * salesperson can read one aloud and a customer knows what they are getting.
 */
const SEED: Omit<DesignOptionDoc, '_id'>[] = [
  ...[
    ['minimal', 'Minimal', 'Simple aur clean interior, kam decoration, simple shapes aur open space.'],
    ['modern', 'Modern', 'Clean lines, modern furniture, simple shapes aur stylish lighting wala interior.'],
    ['luxury', 'Luxury', 'Premium look, rich materials, elegant furniture, beautiful lighting aur luxurious finishing.'],
    ['warm', 'Warm', 'Warm colours, wood, soft lighting aur comfortable, welcoming feel.'],
    ['contemporary', 'Contemporary', 'Modern aur stylish interior, balanced colours, clean furniture aur latest design feel.'],
    ['earthy', 'Earthy', 'Natural colours, wood, stone aur earthy textures ke saath calm aur natural look.'],
    ['indian', 'Indian', 'Indian design elements, warm colours, traditional touches aur modern interior ka combination.'],
    ['elegant', 'Elegant', 'Simple but premium look, balanced colours, sophisticated furniture aur subtle detailing.'],
  ].map(([styleId, name, description], order) => ({
    kind: 'style' as const,
    name,
    description,
    imageUrl: null,
    valueMm: null,
    styleId,
    order,
    active: true,
  })),
  ...[1, 2, 3, 5].map((valueMm, order) => ({
    kind: 'joint' as const,
    name: `${valueMm} mm`,
    description: '',
    imageUrl: null,
    valueMm,
    styleId: null,
    order,
    active: true,
  })),
  {
    kind: 'pattern' as const,
    name: 'Straight / Grid',
    description: 'Tiles line up in straight rows and columns, joints continuous in both directions.',
    imageUrl: null,
    valueMm: null,
    styleId: null,
    order: 0,
    active: true,
  },
  {
    kind: 'pattern' as const,
    name: 'Running Bond / Brick',
    description: 'Each row is offset from the one below, like brickwork, so the joints stagger.',
    imageUrl: null,
    valueMm: null,
    styleId: null,
    order: 1,
    active: true,
  },
  {
    kind: 'reason' as const,
    name: 'Tile Placement',
    description: 'The tile is on the wrong surface, or covers more or less of it than discussed.',
    imageUrl: null,
    valueMm: null,
    styleId: null,
    order: 0,
    active: true,
  },
  {
    kind: 'reason' as const,
    name: 'Overall Look',
    description: 'The room as a whole is not right, even though the tile itself is.',
    imageUrl: null,
    valueMm: null,
    styleId: null,
    order: 1,
    active: true,
  },
  {
    kind: 'reason' as const,
    name: 'Tile Scale',
    description: 'The tile reads too large or too small for the space.',
    imageUrl: null,
    valueMm: null,
    styleId: null,
    order: 2,
    active: true,
  },
  {
    kind: 'reason' as const,
    name: 'Tile Coverage',
    description: 'Too much or too little of the room is tiled.',
    imageUrl: null,
    valueMm: null,
    styleId: null,
    order: 3,
    active: true,
  },
  {
    kind: 'reason' as const,
    name: 'Colour / Material Combination',
    description: 'The tile does not sit well with the other materials and colours in the room.',
    imageUrl: null,
    valueMm: null,
    styleId: null,
    order: 4,
    active: true,
  },
  {
    kind: 'reason' as const,
    name: 'Style',
    description: 'The room does not read as the style that was chosen.',
    imageUrl: null,
    valueMm: null,
    styleId: null,
    order: 5,
    active: true,
  },
  {
    kind: 'reason' as const,
    name: 'Composition',
    description: 'The framing, viewpoint or arrangement of the room needs to change.',
    imageUrl: null,
    valueMm: null,
    styleId: null,
    order: 6,
    active: true,
  },
  {
    kind: 'reason' as const,
    name: 'Something Else',
    description: 'Anything the reasons above do not cover — say what needs to change.',
    imageUrl: null,
    valueMm: null,
    styleId: null,
    order: 7,
    active: true,
  },
]

let ready: Promise<void> | null = null

async function ensureReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const collection = await getCollection<DesignOptionDoc>(COLLECTION)
      await collection.createIndex({ kind: 1, order: 1 })
      // Guarded by a count: once the showroom has edited these, an empty list
      // means they emptied it deliberately.
      if ((await collection.countDocuments({})) > 0) return
      await collection.insertMany(SEED.map((doc) => ({ _id: randomUUID(), ...doc })))
    })().catch((error: unknown) => {
      ready = null
      throw error
    })
  }
  return ready
}

function toOption(doc: DesignOptionDoc): DesignOption {
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

function requireKind(value: unknown): DesignOptionKind {
  if (typeof value === 'string' && (KINDS as string[]).includes(value)) {
    return value as DesignOptionKind
  }
  throw new DesignOptionsError('Unknown kind of design option.')
}

function requireName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) throw new DesignOptionsError('A name is required.')
  if (name.length > 80) throw new DesignOptionsError('That name is too long.')
  return name
}

/** A joint width in millimetres, rejected unless a fitter could actually cut it. */
export function requireJointWidth(value: unknown): number {
  const mm = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(mm) || mm <= 0) {
    throw new DesignOptionsError('Joint width must be a number of millimetres.')
  }
  if (mm < 0.5 || mm > 20) {
    throw new DesignOptionsError('Joint width must be between 0.5 mm and 20 mm.')
  }
  // Half a millimetre is as fine as a joint is ever specified.
  return Math.round(mm * 2) / 2
}

export async function listDesignOptions(
  kind: DesignOptionKind,
  includeDisabled = false,
): Promise<DesignOption[]> {
  await ensureReady()
  const collection = await getCollection<DesignOptionDoc>(COLLECTION)
  const docs = await collection
    .find(includeDisabled ? { kind } : { kind, active: true })
    .sort({ order: 1 })
    .toArray()
  return docs.map(toOption)
}

export async function listAllDesignOptions(): Promise<DesignOption[]> {
  await ensureReady()
  const collection = await getCollection<DesignOptionDoc>(COLLECTION)
  const docs = await collection.find({}).sort({ order: 1 }).toArray()
  return docs.map(toOption)
}

export async function createDesignOption(input: Record<string, unknown>): Promise<DesignOption> {
  await ensureReady()
  const collection = await getCollection<DesignOptionDoc>(COLLECTION)
  const kind = requireKind(input.kind)
  const valueMm = kind === 'joint' ? requireJointWidth(input.valueMm ?? input.name) : null

  const last = await collection.find({ kind }).sort({ order: -1 }).limit(1).toArray()
  const doc: DesignOptionDoc = {
    _id: randomUUID(),
    kind,
    // A joint is named by its width, so the two can never disagree.
    name: kind === 'joint' ? `${valueMm} mm` : requireName(input.name),
    description: typeof input.description === 'string' ? input.description.trim().slice(0, 400) : '',
    imageUrl:
      typeof input.imageUrl === 'string' && input.imageUrl.trim() ? input.imageUrl.trim() : null,
    valueMm,
    styleId: null,
    order: (last[0]?.order ?? -1) + 1,
    active: true,
  }
  await collection.insertOne(doc)
  return toOption(doc)
}

export async function updateDesignOption(
  id: string,
  changes: Record<string, unknown>,
): Promise<DesignOption> {
  await ensureReady()
  const collection = await getCollection<DesignOptionDoc>(COLLECTION)
  const existing = await collection.findOne({ _id: id })
  if (!existing) throw new DesignOptionsError('That option was not found.', 404)

  const next: Partial<DesignOptionDoc> = {}
  if (changes.valueMm !== undefined && existing.kind === 'joint') {
    next.valueMm = requireJointWidth(changes.valueMm)
    next.name = `${next.valueMm} mm`
  } else if (changes.name !== undefined) {
    next.name = requireName(changes.name)
  }
  if (changes.description !== undefined) {
    next.description = typeof changes.description === 'string' ? changes.description.trim().slice(0, 400) : ''
  }
  if (changes.imageUrl !== undefined) {
    const url = typeof changes.imageUrl === 'string' ? changes.imageUrl.trim() : ''
    next.imageUrl = url || null
  }
  if (changes.active !== undefined) next.active = Boolean(changes.active)
  if (Object.keys(next).length === 0) return toOption(existing)

  await collection.updateOne({ _id: id }, { $set: next })
  return toOption({ ...existing, ...next })
}

/** Rewrites the order within one kind. */
export async function reorderDesignOptions(ids: unknown): Promise<DesignOption[]> {
  await ensureReady()
  if (!Array.isArray(ids)) throw new DesignOptionsError('An ordered list of ids is required.')
  const collection = await getCollection<DesignOptionDoc>(COLLECTION)
  await Promise.all(
    ids.map((id, index) => collection.updateOne({ _id: String(id) }, { $set: { order: index } })),
  )
  return listAllDesignOptions()
}

/** One active option by id, or null. Used to verify what the browser sent. */
export async function findActiveOption(
  kind: DesignOptionKind,
  id: string,
): Promise<DesignOption | null> {
  await ensureReady()
  const collection = await getCollection<DesignOptionDoc>(COLLECTION)
  const doc = await collection.findOne({ _id: id, kind, active: true })
  return doc ? toOption(doc) : null
}
