/**
 * One-time cleanup: collapse duplicated design options back to one each.
 *
 * The screen that reads these asks for styles, joints and patterns in
 * parallel. On a cold deployment those three requests could land on three
 * instances at once, none of which could see the others' writes, and each
 * seeded the whole list — so the showroom saw every style, joint and pattern
 * three times over. The store no longer allows that: seeded rows now carry an
 * id derived from what they are, and a unique index keeps one option of a kind
 * per name.
 *
 * That index cannot be created while duplicates are still there, which is what
 * this script is for. It keeps the OLDEST row of each (kind, name) — the one
 * the showroom has been editing, and the one anything else already refers to —
 * and removes the later copies. Then it creates the index, so it cannot happen
 * again.
 *
 * Usage:
 *   npm run dedupe:design-options             # dry run — reports, writes nothing
 *   npm run dedupe:design-options -- --apply  # writes
 */
import 'dotenv/config'
import { closeDb, getCollection, isDatabaseConfigured } from '../services/db'

const apply = process.argv.includes('--apply')
const COLLECTION = 'designOptions'

type Doc = { _id: string; kind: string; name: string; order?: number; active?: boolean }

async function main() {
  console.log(apply ? 'Running for real (--apply set).' : 'DRY RUN — pass --apply to write.')

  if (!isDatabaseConfigured()) {
    console.error('')
    console.error('MONGODB_URI is not set, so there is no database to clean.')
    console.error('Use the same value the deployment uses, or this reports on')
    console.error('a database the app never looks at.')
    process.exitCode = 1
    return
  }
  console.log(`Database: ${process.env.MONGODB_DB ?? 'devyora (the default — MONGODB_DB is unset)'}`)

  const collection = await getCollection<Doc>(COLLECTION)
  // Natural order is insertion order, so the first of each pair is the oldest.
  const docs = await collection.find({}).toArray()
  console.log(`Documents: ${docs.length}`)

  const keep = new Map<string, Doc>()
  const remove: Doc[] = []
  for (const doc of docs) {
    const key = `${doc.kind}\u0000${(doc.name ?? '').trim().toLowerCase()}`
    if (keep.has(key)) remove.push(doc)
    else keep.set(key, doc)
  }

  console.log(`Distinct options: ${keep.size}`)
  console.log(`Duplicates to remove: ${remove.length}`)
  console.log('')

  if (remove.length === 0) {
    console.log('  Nothing duplicated.')
  } else {
    const byKind = new Map<string, number>()
    for (const doc of remove) byKind.set(doc.kind, (byKind.get(doc.kind) ?? 0) + 1)
    for (const [kind, n] of byKind) console.log(`  ${kind.padEnd(8)} ${n} extra row(s)`)
    console.log('')
    for (const doc of remove) {
      if (!apply) {
        console.log(`  would remove  ${doc.kind.padEnd(8)} "${doc.name}"  (${doc._id})`)
        continue
      }
      await collection.deleteOne({ _id: doc._id })
      console.log(`  removed       ${doc.kind.padEnd(8)} "${doc.name}"`)
    }
  }

  if (!apply) {
    console.log('')
    console.log('Nothing was written. Re-run with --apply.')
    return
  }

  console.log('')
  try {
    await collection.createIndex({ kind: 1, name: 1 }, { unique: true })
    console.log('Unique index on (kind, name) created — this cannot recur.')
  } catch (error: unknown) {
    console.error('Unique index NOT created. Something is still duplicated:')
    console.error(error instanceof Error ? `  ${error.name}: ${error.message}` : `  ${String(error)}`)
    process.exitCode = 1
    return
  }

  console.log('')
  console.log('On the list now:')
  for (const doc of await collection.find({}).sort({ kind: 1, order: 1 }).toArray()) {
    console.log(`  ${doc.kind.padEnd(8)} ${doc.name}`)
  }
}

main()
  .then(() => closeDb())
  .catch((error: unknown) => {
    console.error('Failed:')
    console.error(error instanceof Error ? `  ${error.name}: ${error.message}` : `  ${String(error)}`)
    return closeDb().finally(() => process.exit(1))
  })
