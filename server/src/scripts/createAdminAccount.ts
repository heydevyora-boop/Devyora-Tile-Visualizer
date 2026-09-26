/**
 * Recovery: create — or reset the password of — one administrator account.
 *
 * This exists for the case where nobody can sign in: the accounts collection
 * is empty and AUTH_ACCOUNTS_JSON is no longer available to seed it from, so
 * there is no way into the app to fix the problem from inside the app. It
 * makes exactly one account, which is enough to sign in and rebuild the rest
 * from the Users & Roles screen.
 *
 * It is also the way back from a forgotten administrator password, since a
 * hash cannot be read back — only replaced.
 *
 * The password is taken from the environment and never printed, never logged
 * and never written to a file. It is hashed by the same store the app uses, at
 * the same cost, so the resulting row is indistinguishable from one created
 * through the admin screen.
 *
 * Usage (PowerShell — note the SINGLE quotes, or "$2b" style text gets eaten):
 *   $env:MONGODB_URI = '...'
 *   $env:MONGODB_DB = '...'
 *   $env:ADMIN_USERNAME = 'admin'
 *   $env:ADMIN_PASSWORD = 'choose-something-long'
 *   $env:ADMIN_DISPLAY_NAME = 'Showroom Admin'
 *   npm run create:admin              # dry run — reports, writes nothing
 *   npm run create:admin -- --apply   # writes
 */
import 'dotenv/config'
import {
  AccountsError,
  createAccount,
  findAccountByUsername,
  listAccounts,
  normaliseUsername,
  updateAccount,
} from '../services/accountsStore'
import { closeDb, isDatabaseConfigured } from '../services/db'

const apply = process.argv.includes('--apply')

async function main() {
  console.log(apply ? 'Running for real (--apply set).' : 'DRY RUN — pass --apply to write.')

  const username = (process.env.ADMIN_USERNAME ?? '').trim()
  const password = process.env.ADMIN_PASSWORD ?? ''
  const displayName = (process.env.ADMIN_DISPLAY_NAME ?? '').trim() || 'Administrator'

  // Checked first and said plainly: whoever runs this is already locked out,
  // and a driver stack trace is the last thing that helps them.
  if (!isDatabaseConfigured()) {
    console.error('')
    console.error('MONGODB_URI is not set, so there is no database to write to.')
    console.error('Use the same value the deployment uses, or the account will')
    console.error('be created somewhere the app never looks.')
    process.exitCode = 1
    return
  }

  if (!username || !password) {
    console.error('')
    console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD before running this.')
    console.error('ADMIN_DISPLAY_NAME is optional and defaults to "Administrator".')
    process.exitCode = 1
    return
  }

  const target = normaliseUsername(username)
  const existing = await findAccountByUsername(target)

  if (!apply) {
    console.log(
      existing
        ? `  would RESET the password of "${target}" and make sure the role is admin`
        : `  would CREATE "${target}" as an administrator, display name "${displayName}"`,
    )
    console.log('')
    console.log('Nothing was written. Re-run with --apply.')
    return
  }

  if (existing) {
    // Their display name is left alone: this is a way back in, not a rename.
    await updateAccount(target, { password, role: 'admin' })
    console.log(`  reset the password of "${target}", role is admin`)
  } else {
    await createAccount({ username: target, password, displayName, role: 'admin' })
    console.log(`  created "${target}" as an administrator`)
  }

  console.log('')
  console.log('In the database now:')
  for (const record of await listAccounts()) {
    console.log(`  ${record.username.padEnd(12)} role=${record.role.padEnd(5)} "${record.displayName}"`)
  }
  console.log('')
  console.log('Sign in with that username and the password you set, then add')
  console.log('everyone else from Users & Roles. Clear ADMIN_PASSWORD afterwards.')
}

main()
  .then(() => closeDb())
  .catch((error: unknown) => {
    // A validation message is useful; anything else could carry a driver
    // detail, so it is shown as-is only when this code wrote it.
    if (error instanceof AccountsError) {
      console.error(`Could not do that: ${error.message}`)
    } else {
      console.error('Failed. The database did not accept that change:')
      console.error(error instanceof Error ? `  ${error.name}: ${error.message}` : `  ${String(error)}`)
    }
    return closeDb().finally(() => process.exit(1))
  })
