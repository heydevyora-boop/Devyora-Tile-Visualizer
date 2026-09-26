/**
 * Read-only: every row in the accounts collection.
 *
 * Answers "who can sign in, and as what" against whatever database
 * MONGODB_URI points at — the question worth asking after a seed, after a
 * recovery, or when a login fails and it is not clear which database the
 * deployment is actually reading.
 *
 * It writes nothing. There is no --apply, because there is nothing to apply.
 *
 * It cannot print a password hash: listAccounts returns AccountSummary, a type
 * that structurally has no such field, so there is no hash in scope here to
 * print by accident.
 */
import 'dotenv/config'
import { listAccounts } from '../services/accountsStore'
import { closeDb, isDatabaseConfigured } from '../services/db'

async function main() {
  if (!isDatabaseConfigured()) {
    console.error('MONGODB_URI is not set, so there is no database to read.')
    console.error('Use the same value the deployment uses, or this reports on')
    console.error('a database the app never looks at.')
    process.exitCode = 1
    return
  }

  // Named so the output itself says which database was read — the mismatch
  // this is most often used to find is between two database NAMES on one
  // cluster, which is invisible if only the rows are shown.
  console.log(`Database: ${process.env.MONGODB_DB ?? 'devyora (the default — MONGODB_DB is unset)'}`)

  const accounts = await listAccounts()
  console.log(`Accounts: ${accounts.length}`)
  console.log('')

  if (accounts.length === 0) {
    console.log('  (none — nobody can sign in against this database)')
    return
  }

  console.log(`  ${'USERNAME'.padEnd(16)}${'ROLE'.padEnd(8)}DISPLAY NAME`)
  for (const account of accounts) {
    console.log(`  ${account.username.padEnd(16)}${account.role.padEnd(8)}${account.displayName}`)
  }
}

main()
  .then(() => closeDb())
  .catch((error: unknown) => {
    console.error('Could not read the accounts:')
    console.error(error instanceof Error ? `  ${error.name}: ${error.message}` : `  ${String(error)}`)
    return closeDb().finally(() => process.exit(1))
  })
