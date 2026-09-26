/**
 * One-time migration: the old `generations` collection → the current
 * `conceptRevisions` and `savedVisualisations` collections.
 *
 * Before Chunk 10, every generated image was written straight into a client's
 * permanent record — there was no "temporary until saved" step, so whatever
 * the salesperson last generated for a consultation *was* the client's saved
 * history. That old collection is untouched by the current code and the
 * screens built on it (Recent, Saved Concepts, a client's own page) no longer
 * read it, so without this script that history simply stops showing up.
 *
 * This script does not guess which of the old images were "kept" and which
 * were rejected — there is no such distinction in the old data, because the
 * old app didn't have one. It treats every image that was in the old
 * `generations` collection the way the old screens already treated it: as
 * part of the client's saved history. That is the one reading of the old
 * data that doesn't invent something the salesperson never decided.
 *
 * For each old record (one per consultation, holding every concept generated
 * for it, oldest first) this creates:
 *   - one `conceptRevisions` entry per image, numbered in the order they were
 *     generated, chained parent → child exactly like a live revision chain
 *   - one `savedVisualisations` entry per image, marked saved at the
 *     consultation's own timestamp
 *
 * Fields the old data never captured (the uncropped tile photo, the joint,
 * the laying pattern, the full application chain, an "additional
 * requirement") are left null rather than guessed. `space` is carried over
 * as both the area name and a single-node application path, since that is
 * the closest honest approximation of a chain that was never recorded.
 *
 * IDEMPOTENT: every record this writes has a deterministic id derived from
 * the old generationId and the image's position in it
 * (`legacy-<generationId>-<index>`), so running this script twice — after
 * fixing a bug in it, say — updates the same records rather than duplicating
 * them. The old `generations` collection is only ever read, never modified
 * or deleted, so it stays as an archive and this script can be re-run safely.
 *
 * Usage:
 *   npm run migrate:legacy-generations            # dry run — reports only
 *   npm run migrate:legacy-generations -- --apply  # writes for real
 */
import 'dotenv/config'
import { getCollection, closeDb } from '../services/db'
import type { GenerationContext } from '../services/revisionsStore'

interface LegacyGenerationDoc {
  _id: string
  userName: string
  salesperson: string
  customerId: string | null
  space: string | null
  style: string | null
  tileSize: string | null
  croppedImage: string
  generatedImages: string[]
  timestamp: string
}

interface CustomerDoc {
  _id: string
  name: string
  architectId: string | null
}

interface ArchitectDoc {
  _id: string
  name: string
}

interface RevisionDoc {
  _id: string
  generationId: string
  salesperson: string
  customerId: string | null
  revision: number
  parentRevisionId: string | null
  reasonIds: string[]
  reasonNames: string[]
  note: string
  imageUrl: string
  createdAt: string
  context: GenerationContext
  savedAt: string | null
}

interface SavedDoc {
  _id: string
  salesperson: string
  salespersonName: string
  customerId: string | null
  customerName: string | null
  architectId: string | null
  architectName: string | null
  generationId: string
  revisionId: string
  revision: number
  revisionReasons: string[]
  revisionNote: string
  originalTileImage: string | null
  croppedTileImage: string | null
  tileSize: string | null
  space: string | null
  spacePath: { id: string; name: string }[]
  styleName: string | null
  jointName: string | null
  jointWidthMm: number | null
  patternName: string | null
  additionalRequirement: string | null
  image: string
  generatedAt: string
  savedAt: string
}

const apply = process.argv.includes('--apply')

async function main() {
  console.log(apply ? 'Running for real (--apply set).' : 'DRY RUN — pass --apply to write.')

  const legacy = await getCollection<LegacyGenerationDoc>('generations')
  const customers = await getCollection<CustomerDoc>('customers')
  const architects = await getCollection<ArchitectDoc>('architects')
  const revisions = await getCollection<RevisionDoc>('conceptRevisions')
  const saved = await getCollection<SavedDoc>('savedVisualisations')

  if (apply) {
    // Idempotent and safe to run before the app has ever created these:
    // mirrors what the live stores set up on first use.
    await revisions.createIndex({ generationId: 1, revision: 1 })
    await revisions.createIndex({ salesperson: 1, createdAt: -1 })
    await saved.createIndex({ salesperson: 1, savedAt: -1 })
    await saved.createIndex({ customerId: 1, space: 1, savedAt: -1 })
    await saved.createIndex({ architectId: 1, savedAt: -1 })
    await saved.createIndex({ revisionId: 1 }, { unique: true })
  }

  const docs = await legacy.find({}).toArray()
  console.log(`Found ${docs.length} legacy consultation(s) in "generations".`)

  // Resolve names once, not per image — a legacy set commonly has 1-3 images
  // sharing the same customer/architect.
  const customerCache = new Map<string, CustomerDoc | null>()
  const architectCache = new Map<string, ArchitectDoc | null>()

  async function customerFor(id: string | null): Promise<CustomerDoc | null> {
    if (!id) return null
    if (!customerCache.has(id)) {
      customerCache.set(id, await customers.findOne({ _id: id }))
    }
    return customerCache.get(id) ?? null
  }
  async function architectFor(id: string | null): Promise<ArchitectDoc | null> {
    if (!id) return null
    if (!architectCache.has(id)) {
      architectCache.set(id, await architects.findOne({ _id: id }))
    }
    return architectCache.get(id) ?? null
  }

  let totalImages = 0
  let revisionWrites = 0
  let savedWrites = 0
  let skippedEmpty = 0
  let missingCustomer = 0

  for (const doc of docs) {
    const images = Array.isArray(doc.generatedImages) ? doc.generatedImages : []
    if (images.length === 0) {
      skippedEmpty++
      continue
    }

    const customer = await customerFor(doc.customerId)
    if (doc.customerId && !customer) missingCustomer++
    const architect = await architectFor(customer?.architectId ?? null)

    const context: GenerationContext = {
      salespersonName: doc.userName,
      customerName: customer?.name ?? null,
      architectId: customer?.architectId ?? null,
      architectName: architect?.name ?? null,
      // Never captured under the old model — it only ever stored the cropped
      // photo, not the original.
      originalTileImage: null,
      croppedTileImage: doc.croppedImage ?? null,
      tileSize: doc.tileSize ?? null,
      space: doc.space ?? null,
      // The old data never recorded the full application chain, only the
      // top-level area, so that is the only node this can honestly supply.
      spacePath: doc.space ? [{ id: doc.space, name: doc.space }] : [],
      styleName: doc.style ?? null,
      jointName: null,
      jointWidthMm: null,
      patternName: null,
      additionalRequirement: null,
    }

    let parentRevisionId: string | null = null
    for (let index = 0; index < images.length; index++) {
      totalImages++
      const revisionId = `legacy-${doc._id}-${index}`
      const revisionDoc: RevisionDoc = {
        _id: revisionId,
        generationId: doc._id,
        salesperson: doc.salesperson,
        customerId: doc.customerId ?? null,
        revision: index + 1,
        parentRevisionId,
        // Correction reasons didn't exist yet when this was generated.
        reasonIds: [],
        reasonNames: [],
        note: '',
        imageUrl: images[index],
        createdAt: doc.timestamp,
        context,
        savedAt: doc.timestamp,
      }
      const savedDoc: SavedDoc = {
        _id: `legacy-saved-${doc._id}-${index}`,
        salesperson: doc.salesperson,
        salespersonName: doc.userName,
        customerId: doc.customerId ?? null,
        customerName: context.customerName,
        architectId: context.architectId,
        architectName: context.architectName,
        generationId: doc._id,
        revisionId,
        revision: index + 1,
        revisionReasons: [],
        revisionNote: '',
        originalTileImage: null,
        croppedTileImage: doc.croppedImage ?? null,
        tileSize: doc.tileSize ?? null,
        space: doc.space ?? null,
        spacePath: context.spacePath,
        styleName: doc.style ?? null,
        jointName: null,
        jointWidthMm: null,
        patternName: null,
        additionalRequirement: null,
        image: images[index],
        generatedAt: doc.timestamp,
        savedAt: doc.timestamp,
      }

      if (apply) {
        await revisions.replaceOne({ _id: revisionId }, revisionDoc, { upsert: true })
        await saved.replaceOne({ _id: savedDoc._id }, savedDoc, { upsert: true })
      }
      revisionWrites++
      savedWrites++
      parentRevisionId = revisionId
    }
  }

  console.log('')
  console.log(`Consultations scanned:     ${docs.length}`)
  console.log(`  skipped (no images):      ${skippedEmpty}`)
  console.log(`Images found:               ${totalImages}`)
  console.log(`Revisions ${apply ? 'written' : 'to write'}:          ${revisionWrites}`)
  console.log(`Saved visualisations ${apply ? 'written' : 'to write'}: ${savedWrites}`)
  if (missingCustomer > 0) {
    console.log(
      `NOTE: ${missingCustomer} record(s) named a customerId that no longer exists in ` +
        `"customers" — migrated with customerName/architectName left null.`,
    )
  }
  if (!apply) {
    console.log('\nNothing was written. Re-run with --apply to write these records.')
  }
}

main()
  .then(() => closeDb())
  .catch((error: unknown) => {
    console.error('Migration failed:', error)
    return closeDb().finally(() => process.exit(1))
  })
