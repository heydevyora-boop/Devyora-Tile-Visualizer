// Local-dev copy of the space-catalogue store used by the Express server.
// KEEP IN SYNC with the deployed Vercel copy in client/api/_lib/spaceNodesStore.ts.
import { randomUUID } from 'node:crypto'
import { getCollection } from './db'

/**
 * Where the tile goes, as a tree the showroom owns.
 *
 * A consultation does not choose "Bathroom"; it chooses a specific
 * application, such as Bathroom -> Powder Washroom -> Half Height. The depth
 * is not fixed: a category may have no children, or children several levels
 * deep, and the showroom decides. Nothing about that shape is written into
 * the frontend, which renders whatever tree this returns.
 *
 * Root nodes carry a spaceId matching the curated per-room prompt config, so
 * the environment and three-concept strategy written for each room keep
 * working. Deeper nodes carry the words that become the exact application
 * instruction for the generation.
 */
export interface SpaceNode {
  id: string
  /** null for a top-level category. */
  parentId: string | null
  name: string
  /** What this application means, shown to the salesperson and sent to the model. */
  description: string
  /** A representative photograph, so the choice can be understood by eye. */
  imageUrl: string | null
  /** Root nodes only: the id of the curated room config this category maps to. */
  spaceId: string | null
  order: number
  active: boolean
}

interface SpaceNodeDoc extends Omit<SpaceNode, 'id'> {
  _id: string
}

export class SpaceNodesError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'SpaceNodesError'
    this.status = status
  }
}

const COLLECTION = 'spaceNodes'

/**
 * What a new showroom starts with: the ten categories, their applications, and
 * the half/full height split under a powder washroom as the worked example of
 * a third level. Seeded once; after that the catalogue belongs to the admin.
 */
const SEED: {
  key: string
  parentKey: string | null
  name: string
  spaceId: string | null
  imageUrl: string | null
  description: string
  order: number
}[] = [
  { key: "bathroom", parentKey: null, name: "Bathroom", spaceId: "bathroom", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDP5oA3AvnTsObA-oOr4trg44RxFMMyW1m2E5Wj_q9lD8zAQpMucUrLBk1i1LS3-0QMe5H1M9vIcaNV7UZer4PYV8q16dhpMVMIWdKyqidxgMR1C40tcJKfupQba_dFnRvQyL9_ZbtHz2N5OfsvGA__l8k4ov_w-LRcpxFLSl06yQWvUZ1yQZy9E1HM8OdDMZC1QbbLRXfpckIN3-C89gipLFBzNYdi0iCqSJYptKIrO6cqG7S7utJooQ", description: "", order: 0 },
  { key: "living-room", parentKey: null, name: "Living Room", spaceId: "living-room", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDEpIiiTMWE3tlqPgacanwBWvrlqlG6yioPf75-SOnp0uAf0O8cNzvnaO_1Toqhj7hHHiF4gXu-W-auEGwIJhM3ydoh1__OhYTjgizqJbYzmWcaw58wxITXm3jtZm2xfURG3ahEkSWTZwMrVpu5B8Ft2kEWlOyzU1xcW1nX_jbw5v1u64B9pkwoNH9O9GHqfq7KmbLVw6SzRU8Bzq5bc-NRnbM7FdIOtlDbEmwzzkNrZH9AZqqF7uIg3w", description: "", order: 1 },
  { key: "kitchen", parentKey: null, name: "Kitchen", spaceId: "kitchen", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB00wtIuZZffbITcFtmcFsbTCdn_bhuz-jF0VLOqT77jqOnOpV6LFOH6AloZZVAl4HlC-YeZDpywkX1PQcE2T87vfmpgcqLRM8kDsl3ovTJTN6hP4TutpbLN9O6lgXofAVjw4LXYm9Ouaa2Ba_sZ7T6-OE78YIB-N5kIqjI6sx8tWWEMEmHTtt7znsHib_w4XqSX3C1i2uJ3NlEssWvq3EoaxkyeIxr5WV_KUfgHVSkiyzXdhryU5hFNA", description: "", order: 2 },
  { key: "terrace", parentKey: null, name: "Terrace", spaceId: "terrace", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAtMjsDOhZ0uLWpGMXtxpWM_Q3U2SBcJy0IQor5310F-NPPKNZ-6d9kHLvg78lKrmhbFWkXpV-PkU1tXNmarWPG4e904fJKF66MrwZjSYmOqCVnHxBT9fH3-EDlQbxt6Ky8e7WMZAXF3VGKCaRnFLrSgjW8XPD_hkTYAzMfZGWmY4vj9JJMMl_gwJhDjZ74SSzr7w6X--u8IOr7-cC30K1N8b8Qh-nWtrmW4MuPHM5DGhFv1qdwllo7FQ", description: "", order: 3 },
  { key: "balcony", parentKey: null, name: "Balcony", spaceId: "balcony", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuC25p5dYHCUJpvOHhOS-wUARau6fJrXC09sUlL51QLIZ24Fmx-JVA3CAnEZJCkOxewN2MF9w3r2BYj5RLPWkn2mTp9632zrdEI_2XDaN0HfwZqj1n7hJIEpOOS8nVQXW9HbbGtJK7Z3Xj8ric93lt_cfifzga6fNZyFXAJkEfYa8DwQHZRGzkxpKk7YqaAOm6WtWj8xT4MMqQ699qH_OjnhxaixMpNBaxAcdWu6n5MNJhiKmeAuZc8Uzw", description: "", order: 4 },
  { key: "bedroom", parentKey: null, name: "Bedroom", spaceId: "bedroom", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuASzL7Q5ti4ELe4-ViXrl_06vxDl5vx6-oW3F7cQvLfZ43arsRYzUHJvPxkt2pcBnsnftDPK3hNhhZQMS4ec27IItqPxhxI5OY7XlX4E-IYgLJYH4Lg3uCWCdsdr04hzMYl5bGyQJ7o25ExxhD4uLs4BHOMhiMttrT9WgOu9xIxCWWENNolQJJDs-NYQAhFWt8eNslmD6iQSrTjQj3Ucnt_DK6lyxrFlNuguQXea8a9eFqNMRNvjkqd0w", description: "", order: 5 },
  { key: "staircase", parentKey: null, name: "Staircase", spaceId: "staircase", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDdUyxeUex-fmNkLbzD7qOf5JQi04vlepZQ-7cSGQbdJ5dkwxq5i6sygCx56q6YhfpiQ45d-q7gnmmHFmA-oUysCB_pfTj_aXoFcn25d-bb2rE_-qXcQvGga9ajB8GQZRLy7OfLTIyHR9XIWa2TZKzQg_-cCcs4DibKaeHVEWUDA_ukT2zvzOOdMpbGHQPn1sm72Wh0-oeEG9gQSDSW3dFd2KXcckv9wyo3xM4GlbXUCQVOIy2RNpA_xg", description: "", order: 6 },
  { key: "parking", parentKey: null, name: "Parking", spaceId: "parking", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDtIlbj5sJMTysDoom5akD4coy5DizJw60Wh5ScywzPACAI9yHn_Wu6sclDof5kMhHX2ftMEsftvEPSPHDYuwMCIRiAaG9enzk-D1ZPni6dHREQL-6gn1GdfIItMxIOoagclG1gLJa3_TPtg0ftAZaunLjcSm_a40AnWjWPFSiiCpzigkHI_qzoN7NaoZXhFB942zfiIHRoUvB3pwlEgtG43pcRveCg8YLgfPmBgXWLr1oKt3TmGt9NEg", description: "", order: 7 },
  { key: "entrance", parentKey: null, name: "Entrance", spaceId: "entrance", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBnqsiHNbx1NllUHe5RemwBOHLOgHgQaUeW1L60G7YRqHuyRdDw1P6XcP5-j2RfYCd_DOvXk3FGLJYp1zmCdcFERIVWlHS2_PqATZXsP6MSMG1eLPLoyAaA2TL90XVu7YIpaLE3A_aa3s4hOyzKbX78pBZUAqNE_Atb1zwsND9FSUVysssVElrnbeeGLD_4Htv-0RVR-YpABmK-JTjpVXc-2cY7Mc78dMe8fbjiE8wepw_RSPEva7hiow", description: "", order: 8 },
  { key: "facade", parentKey: null, name: "Facade", spaceId: "facade", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAamkbeH_oO13a62IbxZVljHVUismIcuGJubDr9xdphVTIJpKVO9m-JP0h7gJ_idJSyNgAeXmNVlOdNYAiJCjcuDTeRAyVwbq_dA4oozsiOb2VCr8QBb1m4ChieBKJ08HT6018iG8Au3kc9l-FHO8fdeqZ6lw4xtWfV8bBKV6rN6PLydg1pML9RjdVMgbHATNRSup7pQhHqAOm5Fri4skOYJO6oy2ZBV0zivFNLyPZIAAu0yn7M-WOeDw", description: "", order: 9 },
  { key: "bath-powder", parentKey: "bathroom", name: "Powder Washroom", spaceId: null, imageUrl: null, description: "A compact guest washroom: basin and mirror, no shower or bath.", order: 0 },
  { key: "bath-shower", parentKey: "bathroom", name: "Bathroom with Shower Area", spaceId: null, imageUrl: null, description: "A bathroom including a walk-in shower enclosure or wet area.", order: 1 },
  { key: "bath-full", parentKey: "bathroom", name: "Full Bathroom", spaceId: null, imageUrl: null, description: "A full bathroom with bath and shower, vanity and storage.", order: 2 },
  { key: "bath-powder-half", parentKey: "bath-powder", name: "Half Height", spaceId: null, imageUrl: null, description: "Tile runs from the floor to dado height, roughly waist to chest. Painted or plastered wall above the tile line.", order: 0 },
  { key: "bath-powder-full", parentKey: "bath-powder", name: "Full Height", spaceId: null, imageUrl: null, description: "Tile runs from the floor all the way to the ceiling, with no painted band above.", order: 1 },
  { key: "living-tv", parentKey: "living-room", name: "TV Wall", spaceId: null, imageUrl: null, description: "The media wall behind the television as the tiled feature surface.", order: 0 },
  { key: "living-floor", parentKey: "living-room", name: "Living Floor", spaceId: null, imageUrl: null, description: "The living room floor as the tiled surface.", order: 1 },
  { key: "living-feature", parentKey: "living-room", name: "Feature Wall", spaceId: null, imageUrl: null, description: "A single accent wall as the tiled feature surface.", order: 2 },
  { key: "kitchen-dado", parentKey: "kitchen", name: "Kitchen Dado", spaceId: null, imageUrl: null, description: "The splashback band between the worktop and the wall units.", order: 0 },
  { key: "kitchen-floor", parentKey: "kitchen", name: "Kitchen Floor", spaceId: null, imageUrl: null, description: "The kitchen floor as the tiled surface.", order: 1 },
  { key: "bedroom-floor", parentKey: "bedroom", name: "Bedroom Floor", spaceId: null, imageUrl: null, description: "The bedroom floor as the tiled surface.", order: 0 },
  { key: "bedroom-feature", parentKey: "bedroom", name: "Bedroom Feature Wall", spaceId: null, imageUrl: null, description: "The wall behind the headboard as the tiled feature surface.", order: 1 },
  { key: "stair-tread", parentKey: "staircase", name: "Stair Tread", spaceId: null, imageUrl: null, description: "The treads and risers of the staircase.", order: 0 },
  { key: "stair-wall", parentKey: "staircase", name: "Stair Wall", spaceId: null, imageUrl: null, description: "The wall running alongside the staircase.", order: 1 },
  { key: "stair-landing", parentKey: "staircase", name: "Staircase Landing", spaceId: null, imageUrl: null, description: "The landing floor at the top or turn of the stairs.", order: 2 },
  { key: "terrace-floor", parentKey: "terrace", name: "Terrace Floor", spaceId: null, imageUrl: null, description: "The open terrace floor, laid for outdoor use.", order: 0 },
  { key: "balcony-floor", parentKey: "balcony", name: "Balcony Floor", spaceId: null, imageUrl: null, description: "The balcony floor, laid for outdoor use.", order: 0 },
  { key: "parking-floor", parentKey: "parking", name: "Parking Floor", spaceId: null, imageUrl: null, description: "The parking or garage floor, laid for vehicle traffic.", order: 0 },
  { key: "entrance-floor", parentKey: "entrance", name: "Entrance Floor", spaceId: null, imageUrl: null, description: "The entrance or foyer floor as the tiled surface.", order: 0 },
  { key: "entrance-wall", parentKey: "entrance", name: "Entrance Wall", spaceId: null, imageUrl: null, description: "An entrance wall as the tiled feature surface.", order: 1 },
  { key: "facade-cladding", parentKey: "facade", name: "Facade Cladding", spaceId: null, imageUrl: null, description: "The external facade clad in tile or ventilated panels.", order: 0 },
]

let ready: Promise<void> | null = null

async function ensureReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const collection = await getCollection<SpaceNodeDoc>(COLLECTION)
      await Promise.all([
        collection.createIndex({ parentId: 1, order: 1 }),
        collection.createIndex({ spaceId: 1 }),
      ])
      // Guarded by a count: once the showroom has edited the catalogue, an
      // empty result means they emptied it deliberately.
      if ((await collection.countDocuments({})) > 0) return

      const ids = new Map<string, string>()
      for (const node of SEED) ids.set(node.key, randomUUID())
      await collection.insertMany(
        SEED.map((node) => ({
          _id: ids.get(node.key) as string,
          parentId: node.parentKey ? (ids.get(node.parentKey) as string) : null,
          name: node.name,
          description: node.description,
          imageUrl: node.imageUrl,
          spaceId: node.spaceId,
          order: node.order,
          active: true,
        })),
      )
    })().catch((error: unknown) => {
      ready = null
      throw error
    })
  }
  return ready
}

function toNode(doc: SpaceNodeDoc): SpaceNode {
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

function requireName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) throw new SpaceNodesError('A name is required.')
  if (name.length > 80) throw new SpaceNodesError('That name is too long.')
  return name
}

function optionalText(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > max) throw new SpaceNodesError('That description is too long.')
  return text
}

/** Every node, for the admin screen. */
export async function listSpaceNodes(includeDisabled = false): Promise<SpaceNode[]> {
  await ensureReady()
  const collection = await getCollection<SpaceNodeDoc>(COLLECTION)
  const docs = await collection
    .find(includeDisabled ? {} : { active: true })
    .sort({ order: 1 })
    .toArray()
  return docs.map(toNode)
}

/** The children of one node, or the top-level categories when given null. */
export async function listChildren(parentId: string | null): Promise<SpaceNode[]> {
  await ensureReady()
  const collection = await getCollection<SpaceNodeDoc>(COLLECTION)
  const docs = await collection.find({ parentId, active: true }).sort({ order: 1 }).toArray()
  return docs.map(toNode)
}

export async function createSpaceNode(input: Record<string, unknown>): Promise<SpaceNode> {
  await ensureReady()
  const collection = await getCollection<SpaceNodeDoc>(COLLECTION)

  const parentId = typeof input.parentId === 'string' && input.parentId ? input.parentId : null
  if (parentId && !(await collection.findOne({ _id: parentId }))) {
    throw new SpaceNodesError('That parent was not found.', 404)
  }

  const siblings = await collection.find({ parentId }).sort({ order: -1 }).limit(1).toArray()
  const doc: SpaceNodeDoc = {
    _id: randomUUID(),
    parentId,
    name: requireName(input.name),
    description: optionalText(input.description, 400),
    imageUrl: typeof input.imageUrl === 'string' && input.imageUrl.trim() ? input.imageUrl.trim() : null,
    // Only a category maps to a curated room; a child inherits it through its path.
    spaceId: parentId ? null : (typeof input.spaceId === 'string' && input.spaceId ? input.spaceId : null),
    order: (siblings[0]?.order ?? -1) + 1,
    active: true,
  }
  await collection.insertOne(doc)
  return toNode(doc)
}

export async function updateSpaceNode(
  id: string,
  changes: Record<string, unknown>,
): Promise<SpaceNode> {
  await ensureReady()
  const collection = await getCollection<SpaceNodeDoc>(COLLECTION)
  const existing = await collection.findOne({ _id: id })
  if (!existing) throw new SpaceNodesError('That entry was not found.', 404)

  const next: Partial<SpaceNodeDoc> = {}
  if (changes.name !== undefined) next.name = requireName(changes.name)
  if (changes.description !== undefined) next.description = optionalText(changes.description, 400)
  if (changes.imageUrl !== undefined) {
    const url = typeof changes.imageUrl === 'string' ? changes.imageUrl.trim() : ''
    next.imageUrl = url || null
  }
  if (changes.active !== undefined) next.active = Boolean(changes.active)
  if (changes.parentId !== undefined) {
    const parentId = typeof changes.parentId === 'string' && changes.parentId ? changes.parentId : null
    if (parentId === id) throw new SpaceNodesError('An entry cannot be its own parent.')
    if (parentId) {
      if (!(await collection.findOne({ _id: parentId }))) {
        throw new SpaceNodesError('That parent was not found.', 404)
      }
      // Walking up from the proposed parent catches a cycle before it is
      // written: a tree that loops would hang every reader of it.
      let cursor: string | null = parentId
      const seen = new Set<string>()
      while (cursor) {
        if (cursor === id) throw new SpaceNodesError('That move would create a loop.')
        if (seen.has(cursor)) break
        seen.add(cursor)
        const parent: SpaceNodeDoc | null = await collection.findOne({ _id: cursor })
        cursor = parent?.parentId ?? null
      }
    }
    next.parentId = parentId
  }
  if (Object.keys(next).length === 0) return toNode(existing)

  await collection.updateOne({ _id: id }, { $set: next })
  return toNode({ ...existing, ...next })
}

/** Rewrites the order of a set of siblings from a list of ids. */
export async function reorderSpaceNodes(ids: unknown): Promise<SpaceNode[]> {
  await ensureReady()
  if (!Array.isArray(ids)) throw new SpaceNodesError('An ordered list of ids is required.')
  const collection = await getCollection<SpaceNodeDoc>(COLLECTION)
  await Promise.all(
    ids.map((id, index) => collection.updateOne({ _id: String(id) }, { $set: { order: index } })),
  )
  return listSpaceNodes(true)
}

/** A resolved application: the chain of nodes chosen, root first. */
export interface ResolvedApplication {
  path: SpaceNode[]
  /** The curated room config id from the root of the path, when it has one. */
  spaceId: string | null
}

/**
 * Turns the ids the browser sent into a verified chain.
 *
 * Checked rather than trusted: the ids must exist, be active, and each be the
 * child of the one before it. That stops a stale or hand-edited selection
 * quietly producing an application the showroom never configured — which
 * matters because whatever comes back here goes on to instruct the model.
 */
export async function resolveApplicationPath(ids: unknown): Promise<ResolvedApplication> {
  await ensureReady()
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new SpaceNodesError('Choose where the tile is going.')
  }
  const collection = await getCollection<SpaceNodeDoc>(COLLECTION)

  const path: SpaceNode[] = []
  let expectedParent: string | null = null
  for (const raw of ids) {
    const doc = await collection.findOne({ _id: String(raw) })
    if (!doc || !doc.active) throw new SpaceNodesError('That application is no longer available.')
    if (doc.parentId !== expectedParent) {
      throw new SpaceNodesError('That application does not match the catalogue.')
    }
    path.push(toNode(doc))
    expectedParent = doc._id
  }

  // A choice must be taken to the end: stopping at a category when the
  // showroom has configured applications under it would leave the model to
  // pick one, which is exactly what this hierarchy exists to prevent.
  const deeper = await collection.findOne({ parentId: expectedParent, active: true })
  if (deeper) throw new SpaceNodesError('Choose the specific application before generating.')

  return { path, spaceId: path[0]?.spaceId ?? null }
}
