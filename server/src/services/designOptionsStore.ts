// Local-dev copy of the design-option store used by the Express server.
// KEEP IN SYNC with the deployed Vercel copy in client/api/_lib/designOptionsStore.ts.
import { randomUUID } from 'node:crypto'
import { getCollection } from './db'
import { RETIRED_REASON_IDS } from './regenerationRules'

/**
 * The lists the showroom maintains for a consultation: the grout joint width,
 * the laying pattern, where the highlighter goes, and the reasons a salesperson
 * gives when asking for another concept.
 *
 * They share one collection because they are the same shape — an ordered,
 * switchable list the showroom maintains — and differ only in what they mean.
 * Keeping them together means one admin screen and one set of rules rather
 * than three near-identical copies.
 */
export type DesignOptionKind = 'joint' | 'pattern' | 'reason' | 'highlighterLocation'

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
  /**
   * Tile roles only: true for the one role the app substitutes when the
   * salesperson skips the selection — the tile is then treated as the
   * base/background material without anyone having to see or choose that.
   * At most one row per kind should ever carry this; nothing enforces that
   * beyond the seed only ever setting it once.
   */
  isDefault: boolean
  order: number
  active: boolean
}

interface DesignOptionDoc extends Omit<DesignOption, 'id'> {
  _id: string
  /**
   * Set on an option the product no longer has, as opposed to one an admin
   * switched off. It is never listed and never accepted, and an admin cannot
   * bring it back — there is nothing for it to mean any more.
   */
  retired?: boolean
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
const KINDS: DesignOptionKind[] = ['joint', 'pattern', 'reason', 'highlighterLocation']

/**
 * What a new showroom starts with.
 *
 * Descriptions are written the way the showroom talks to customers. For the
 * highlighter locations the description is what the generation is told to follow.
 */
const SEED: Omit<DesignOptionDoc, '_id'>[] = [
  ...[1, 2, 3, 5].map((valueMm, order) => ({
    kind: 'joint' as const,
    name: `${valueMm} mm`,
    description: '',
    imageUrl: null,
    valueMm,
    styleId: null,
    isDefault: false,
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
    isDefault: false,
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
    isDefault: false,
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
    isDefault: false,
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
    isDefault: false,
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
    isDefault: false,
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
    isDefault: false,
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
    isDefault: false,
    order: 4,
    active: true,
  },
  {
    kind: 'reason' as const,
    name: 'Composition',
    description: 'The framing, viewpoint or arrangement of the room needs to change.',
    imageUrl: null,
    valueMm: null,
    styleId: null,
    isDefault: false,
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
    isDefault: false,
    order: 7,
    active: true,
  },
  // Where the highlighter tile goes. These are hard placement instructions for
  // the highlighter, not descriptions of the room: the description is what the
  // generation is told to follow, so the showroom can sharpen the wording
  // without a redeploy.
  ...([
    ['Basin / Vanity', 'The highlighter tile is used around the basin / vanity area — the wall zone directly behind and beside the basin and vanity. It stays there; it is not moved to another part of the room.'],
    ['Shower Area', 'The highlighter tile is used in the shower area — the shower wall or enclosure. It stays there; it is not moved to another part of the room.'],
    ['Plain Wall', 'The highlighter tile is the selected plain-wall feature: one plain wall carries it as the highlight area. It stays on that wall; it is not moved to another part of the room.'],
  ] as [string, string][]).map(([name, description], order) => ({
    kind: 'highlighterLocation' as const,
    name,
    description,
    imageUrl: null,
    valueMm: null,
    styleId: null,
    isDefault: false,
    order,
    active: true,
  })),
]

/**
 * The id a seeded option always gets, derived from what it is rather than
 * generated fresh.
 *
 * This is what makes seeding safe to run twice at once. The screen that reads
 * these asks for styles, joints and patterns in parallel, and on a cold
 * deployment those three requests can land on three separate instances, none
 * of which can see the others' writes yet. With a random id each one inserted
 * its own copy of the whole list and the showroom ended up with everything
 * three times over. With this id the second and third writers collide with the
 * first and are discarded, which is the correct outcome rather than an error.
 */
function seedId(kind: string, name: string): string {
  return `seed:${kind}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}


/** True for the driver's duplicate-key error, however it is wrapped. */
function isDuplicateKey(error: unknown): boolean {
  const e = error as { code?: number; writeErrors?: { code?: number }[] } | null
  return e?.code === 11000 || Boolean(e?.writeErrors?.some((w) => w.code === 11000))
}

/**
 * Collapses any (kind, name) group that already has more than one document
 * back to one, keeping the first — natural order is insertion order, so
 * that is the oldest.
 *
 * This exists because the seed race that produced this (three cold
 * instances, one empty collection, three inserts of the whole list) ran
 * before the fix below could stop it, on databases that were already live.
 * A deterministic seed id and a unique index only stop it happening again;
 * they do nothing about rows that are already there, and this process has
 * no way to reach into a showroom's database from outside the app to clean
 * them by hand. So the app cleans itself: the first request after this
 * deploys runs this once, logs exactly what it removed, and every request
 * after that finds nothing left to do.
 */
async function healDuplicates(collection: Awaited<ReturnType<typeof getCollection<DesignOptionDoc>>>): Promise<void> {
  const all = await collection.find({}).toArray()
  const seen = new Map<string, DesignOptionDoc>()
  const remove: DesignOptionDoc[] = []
  for (const doc of all) {
    const key = `${doc.kind} ${(doc.name ?? '').trim().toLowerCase()}`
    if (seen.has(key)) remove.push(doc)
    else seen.set(key, doc)
  }
  if (remove.length === 0) return
  await collection.deleteMany({ _id: { $in: remove.map((doc) => doc._id) } })
  console.error(
    `[designOptions] removed ${remove.length} duplicate(s): ` +
      remove.map((doc) => `${doc.kind}:"${doc.name}"`).join(', '),
  )
}

/**
 * Kinds added after the first release, whose seed must reach showrooms that
 * were seeded before they existed.
 *
 * Safe to key on "no rows of this kind at all": options can be disabled but
 * never deleted, so an empty kind has never been seeded rather than emptied on
 * purpose. The deterministic seed ids make a concurrent second writer collide
 * with the first and be discarded, exactly as for the original seed.
 */
const BACKFILL_KINDS: DesignOptionKind[] = ['highlighterLocation']

/**
 * Takes the old "Style" correction reason out of a showroom that already has it.
 *
 * Design Style is gone from the flow, so "the room does not read as the style
 * that was chosen" has nothing to refer to, and offering it would invite a
 * style back into a correction. It was seeded into live databases, and seeding
 * only ever adds, so it is retired here — once per process, idempotently, and
 * by marking rather than deleting so past revisions that cite it still read.
 */
const LEGACY_KINDS = ['style', 'role']

async function retireRemovedReasons(
  collection: Awaited<ReturnType<typeof getCollection<DesignOptionDoc>>>,
): Promise<void> {
  const retire = { $set: { active: false, retired: true } }
  for (const id of RETIRED_REASON_IDS) {
    await collection.updateMany({ _id: id, retired: { $ne: true } }, retire)
  }
  // Design Style and tile role are no longer part of the flow at all. Their
  // rows stay in the database — old records name them — but are never listed.
  await collection.updateMany(
    { kind: { $in: LEGACY_KINDS }, retired: { $ne: true } } as unknown as Parameters<
      typeof collection.updateMany
    >[0],
    retire,
  )
  // Also by name, for a row from before ids were deterministic.
  await collection.updateMany(
    { kind: 'reason', name: { $regex: '^style$', $options: 'i' }, retired: { $ne: true } },
    retire,
  )
}

async function insertSeeds(
  collection: Awaited<ReturnType<typeof getCollection<DesignOptionDoc>>>,
  docs: Omit<DesignOptionDoc, '_id'>[],
): Promise<void> {
  if (docs.length === 0) return
  try {
    await collection.insertMany(
      docs.map((doc) => ({ _id: seedId(doc.kind, doc.name), ...doc })),
      { ordered: false },
    )
  } catch (error: unknown) {
    // Another instance seeded first. Its rows are the same rows.
    if (!isDuplicateKey(error)) throw error
  }
}

let ready: Promise<void> | null = null

async function ensureReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const collection = await getCollection<DesignOptionDoc>(COLLECTION)
      await collection.createIndex({ kind: 1, order: 1 })
      await healDuplicates(collection)

      // One option of a kind per name, case-insensitive — so "Minimal" and a
      // hand-typed "minimal" collide too. Enforced by the database rather
      // than by the code that writes, so a second writer this process cannot
      // see is caught as well. Best-effort: if something still collides —
      // healDuplicates just ran, but a write could land between that and
      // this — the failure is logged rather than left to break every read.
      try {
        await collection.createIndex(
          { kind: 1, name: 1 },
          { unique: true, collation: { locale: 'en', strength: 2 } },
        )
      } catch (error: unknown) {
        console.error('[designOptions] unique index not created:', error)
      }

      // Guarded by a count: once the showroom has edited these, an empty list
      // means they emptied it deliberately.
      if ((await collection.countDocuments({})) > 0) {
        // An existing showroom. Its lists are its own, so nothing is re-seeded
        // — except a kind that did not exist when it was first seeded, which
        // would otherwise stay empty forever: the whole-collection guard above
        // can never fire for a database that already has rows.
        for (const kind of BACKFILL_KINDS) {
          if ((await collection.countDocuments({ kind })) === 0) {
            await insertSeeds(collection, SEED.filter((doc) => doc.kind === kind))
          }
        }
        await retireRemovedReasons(collection)
        return
      }
      await insertSeeds(collection, SEED)
    })().catch((error: unknown) => {
      ready = null
      throw error
    })
  }
  return ready
}

function toOption(doc: DesignOptionDoc): DesignOption {
  const { _id, retired: _retired, ...rest } = doc
  return { id: _id, ...rest }
}

/**
 * True for a kind the catalogue holds.
 *
 * The one allow-list: the HTTP routes ask this rather than keeping a list of
 * their own, because a second copy is how a kind added here once came back
 * from the API as a 400.
 */
export function isDesignOptionKind(value: unknown): value is DesignOptionKind {
  return typeof value === 'string' && (KINDS as string[]).includes(value)
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
    .find(
      includeDisabled
        ? { kind, retired: { $ne: true } }
        : { kind, active: true, retired: { $ne: true } },
    )
    .sort({ order: 1 })
    .toArray()
  return docs.map(toOption)
}

export async function listAllDesignOptions(): Promise<DesignOption[]> {
  await ensureReady()
  const collection = await getCollection<DesignOptionDoc>(COLLECTION)
  const docs = await collection
    .find({ retired: { $ne: true } })
    .sort({ order: 1 })
    .toArray()
  return docs.map(toOption)
}

const KIND_LABEL: Record<DesignOptionKind, string> = {
  joint: 'joint width',
  pattern: 'laying pattern',
  reason: 'reason',
  highlighterLocation: 'highlighter location',
}

export async function createDesignOption(input: Record<string, unknown>): Promise<DesignOption> {
  await ensureReady()
  const collection = await getCollection<DesignOptionDoc>(COLLECTION)
  const kind = requireKind(input.kind)
  const valueMm = kind === 'joint' ? requireJointWidth(input.valueMm ?? input.name) : null

  // A joint is named by its width, so the two can never disagree.
  const name = kind === 'joint' ? `${valueMm} mm` : requireName(input.name)

  // Case-insensitive, so "Minimal" blocks a second "minimal" or "MINIMAL" —
  // checked here as well as by the unique index, so adding something that is
  // already on the list reads as a plain rejection rather than a driver
  // error the admin form has to interpret.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (await collection.findOne({ kind, name: { $regex: `^${escaped}$`, $options: 'i' } })) {
    throw new DesignOptionsError(`This ${KIND_LABEL[kind]} already exists.`, 409)
  }

  const last = await collection.find({ kind }).sort({ order: -1 }).limit(1).toArray()
  const doc: DesignOptionDoc = {
    _id: randomUUID(),
    kind,
    name,
    description: typeof input.description === 'string' ? input.description.trim().slice(0, 400) : '',
    imageUrl:
      typeof input.imageUrl === 'string' && input.imageUrl.trim() ? input.imageUrl.trim() : null,
    valueMm,
    styleId: null,
    // Not settable through this form — a role becomes the default only via
    // the seed, so there is exactly one and it is never a surprise typed
    // into the "Add" box.
    isDefault: false,
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
  const doc = await collection.findOne({ _id: id, kind, active: true, retired: { $ne: true } })
  return doc ? toOption(doc) : null
}
