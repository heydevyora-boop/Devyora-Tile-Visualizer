/**
 * One-time migration: the accounts in AUTH_ACCOUNTS_JSON → the `accounts`
 * collection.
 *
 * Sign-in used to read the accounts straight out of an environment variable.
 * A running app cannot edit an environment variable, so adding a salesperson
 * meant editing a deployment setting and redeploying, and only whoever held
 * the hosting dashboard could do it. This copies the accounts that already
 * exist into the database, which the app can edit.
 *
 * It copies them VERBATIM. The username, the bcrypt hash, the role and the
 * display name are taken exactly as the environment variable holds them — no
 * hash is regenerated and nobody's password changes, so everyone signs in
 * afterwards with the password they already use. That is also why this reads
 * the variable rather than carrying a copy of the accounts itself: the hashes
 * stay where they are and never pass through source control.
 *
 * IDEMPOTENT: accounts are written keyed on their username, so running this
 * twice updates the same five rows rather than creating ten. `createdAt`
 * survives a re-run.
 *
 * MANUAL, not automatic. It is not wired into a build or a deploy: a seed that
 * ran on every deploy would quietly undo any later change an admin made to an
 * account.
 *
 * Usage:
 *   npm run seed:accounts             # dry run — reports, writes nothing
 *   npm run seed:accounts -- --apply  # writes
 */
import 'dotenv/config'
import { loadSeedAccountsFromEnv } from '../config/auth'
import {
  countAccounts,
  listAccounts,
  normaliseUsername,
  upsertAccountByUsername,
} from '../services/accountsStore'
import { closeDb, getCollection } from '../services/db'

const apply = process.argv.includes('--apply')

/** bcrypt hashes start with $2a$, $2b$ or $2y$. Anything else cannot be compared against. */
function looksLikeBcrypt(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash)
}

async function main() {
  console.log(apply ? 'Running for real (--apply set).' : 'DRY RUN — pass --apply to write.')

  const accounts = loadSeedAccountsFromEnv()
  if (accounts.length === 0) {
    console.error('')
    console.error('AUTH_ACCOUNTS_JSON is empty, unset, or not valid JSON — nothing to migrate.')
    console.error('Run this where that variable is set, with the value it has in production.')
    process.exitCode = 1
    return
  }

  console.log(`Found ${accounts.length} account(s) in AUTH_ACCOUNTS_JSON.`)

  // A duplicate username in the source would otherwise migrate as one row,
  // silently dropping somebody's account.
  const seen = new Map<string, number>()
  for (const account of accounts) {
    const key = normaliseUsername(account.username)
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([key]) => key)
  if (duplicates.length > 0) {
    console.error(`ABORTED: these usernames appear more than once: ${duplicates.join(', ')}`)
    process.exitCode = 1
    return
  }

  for (const account of accounts) {
    if (!looksLikeBcrypt(account.passwordHash)) {
      console.warn(
        `WARNING: "${normaliseUsername(account.username)}" does not have a bcrypt hash. ` +
          'Seeding it would create an account nobody can sign in to.',
      )
    }
  }

  if (apply) {
    // Explicit, and loud if it fails: this is what stops the same person being
    // added twice, and the seed is the moment that has to hold.
    await (await getCollection('accounts')).createIndex({ username: 1 }, { unique: true })
  }

  const before = apply ? await countAccounts() : 0
  let created = 0
  let updated = 0

  for (const account of accounts) {
    const username = normaliseUsername(account.username)
    if (!apply) {
      console.log(`  would write  ${username.padEnd(12)} role=${account.role.padEnd(5)} "${account.displayName}"`)
      continue
    }
    const { created: isNew } = await upsertAccountByUsername({
      username: account.username,
      passwordHash: account.passwordHash,
      role: account.role,
      displayName: account.displayName,
    })
    isNew ? created++ : updated++
    console.log(`  ${isNew ? 'created' : 'updated'}      ${username.padEnd(12)} role=${account.role.padEnd(5)} "${account.displayName}"`)
  }

  console.log('')
  if (!apply) {
    console.log(`Nothing was written. Re-run with --apply to migrate these ${accounts.length} account(s).`)
    return
  }

  console.log(`Accounts before: ${before}`)
  console.log(`  created:       ${created}`)
  console.log(`  updated:       ${updated}`)
  console.log(`Accounts now:    ${await countAccounts()}`)
  console.log('')
  // Never the hash — only what an admin needs to confirm the right people came across.
  console.log('In the database now:')
  for (const record of await listAccounts()) {
    console.log(`  ${record.username.padEnd(12)} role=${record.role.padEnd(5)} "${record.displayName}"`)
  }
}

main()
  .then(() => closeDb())
  .catch((error: unknown) => {
    console.error('Seed failed:', error)
    return closeDb().finally(() => process.exit(1))
  })
