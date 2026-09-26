// Local-dev copy of the MongoDB connection used by the Express server.
// KEEP IN SYNC with the deployed Vercel copy in client/api/_lib/db.ts.
import { MongoClient, type Collection, type Db, type Document } from 'mongodb'

/**
 * Why a request could not reach the database, in terms an admin can act on.
 *
 * These are deliberately coarse: they name the class of misconfiguration, never
 * the cluster, the user, or the connection string.
 */
export type DbFailureReason =
  | 'not-configured'
  | 'bad-connection-string'
  | 'cannot-reach-cluster'
  | 'auth-failed'
  | 'insufficient-permissions'
  | 'unknown'

/**
 * Base for every "the database cannot serve this request" failure.
 *
 * Routes check for this one class, so a new failure mode is classified in one
 * place instead of in every endpoint. All of them are 503: the request was
 * fine, the datastore behind it was not.
 */
export class DbError extends Error {
  status = 503
  reason: DbFailureReason

  constructor(message: string, reason: DbFailureReason) {
    super(message)
    this.name = 'DbError'
    this.reason = reason
  }
}

/** Thrown when the database is not configured at all. */
export class DbConfigError extends DbError {
  constructor(message = 'The database is not configured on the server.') {
    super(message, 'not-configured')
    this.name = 'DbConfigError'
  }
}

/** Thrown when the database is configured but cannot be used. */
export class DbUnavailableError extends DbError {
  constructor(message: string, reason: DbFailureReason) {
    super(message, reason)
    this.name = 'DbUnavailableError'
  }
}

/**
 * What the salesperson is told for each cause.
 *
 * A salesperson can do something about a network blip and nothing about a wrong
 * password, so the two read differently; neither names a provider, a host, or
 * any part of the configuration.
 */
const FAILURE_MESSAGE: Record<DbFailureReason, string> = {
  'not-configured': 'The database is not configured on the server.',
  'bad-connection-string': 'The database connection is set up incorrectly. Please tell the admin.',
  'cannot-reach-cluster':
    'The database could not be reached. Please try again in a moment, and tell the admin if it keeps happening.',
  'auth-failed': 'The database rejected the server’s sign-in. Please tell the admin.',
  'insufficient-permissions':
    'The database is not allowing this server to read its records. Please tell the admin.',
  unknown: 'The database is not responding correctly. Please tell the admin.',
}

/**
 * Sorts a driver error into one of the causes above.
 *
 * The driver reports these as distinct classes and codes, and they need
 * completely different fixes — an unreachable cluster is almost always an
 * access-list entry missing for the server, while a rejected sign-in is the
 * database user or password. Collapsing them into one opaque 500 is what makes
 * this class of outage take hours to place.
 */
export function classifyDbFailure(error: unknown): DbFailureReason | null {
  if (error instanceof DbError) return error.reason
  if (!(error instanceof Error)) return null

  const name = error.name
  const code = (error as { code?: unknown }).code
  const text = `${name}: ${error.message}`.toLowerCase()

  // A connection string the driver cannot even parse.
  if (name === 'MongoParseError' || name === 'MongoInvalidArgumentError') {
    return 'bad-connection-string'
  }

  // Wrong user or password. Code 18 is the server's own AuthenticationFailed;
  // Atlas also reports 8000 for a rejected login.
  if (code === 18 || code === 8000 || text.includes('authentication failed')) {
    return 'auth-failed'
  }

  // The account exists but may not do what was asked — a read-only user, or one
  // scoped to a different database.
  if (code === 13 || text.includes('not authorized')) {
    return 'insufficient-permissions'
  }

  // No server answered in time. On a hosted cluster this is nearly always the
  // network access list rather than a dead cluster.
  //
  // The libuv codes matter as much as the Mongo* names here: a hostname that
  // does not resolve surfaces as a plain Error carrying `querySrv ENOTFOUND`,
  // whose name is just "Error". Without them a mistyped cluster address falls
  // past every branch in this function and gets reported as a bug in the route
  // that asked for data, rather than as a database nobody can reach.
  if (
    name === 'MongoServerSelectionError' ||
    name === 'MongoNetworkError' ||
    name === 'MongoNetworkTimeoutError' ||
    name === 'MongoTimeoutError' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    text.includes('server selection timed out') ||
    text.includes('getaddrinfo') ||
    text.includes('querysrv')
  ) {
    return 'cannot-reach-cluster'
  }

  // Anything else the driver itself raised is still a database failure, not a
  // bug in the route that called it.
  if (name.startsWith('Mongo')) return 'unknown'

  return null
}

/**
 * Re-raises a driver failure as a typed 503, or returns the error untouched
 * when it is not a database problem at all (a real bug still deserves its 500).
 */
export function asDbError(error: unknown): DbError | null {
  if (error instanceof DbError) return error
  const reason = classifyDbFailure(error)
  if (!reason) return null
  return new DbUnavailableError(FAILURE_MESSAGE[reason], reason)
}

/** A one-line description safe to write to the server log. */
export function describeDbError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code
    return `${error.name}${code === undefined ? '' : ` (code ${String(code)})`}: ${error.message}`
  }
  return String(error)
}

/**
 * Reads a connection setting, tolerating the two ways a value gets mangled on
 * its way into a hosting dashboard.
 *
 * A local .env file is parsed by dotenv, which strips the quotes around a
 * value. A dashboard does not parse anything — it stores exactly what was
 * typed into the box. So the very same string that works locally arrives here
 * with its quotes still attached, and `"mongodb+srv://…` is not a scheme the
 * driver recognises. A trailing newline from the copy does the same thing.
 * Neither is ever part of a real connection string, so both are removed here
 * rather than left to fail as an unreadable parse error.
 */
function readSetting(name: string): string | undefined {
  const raw = process.env[name]
  if (typeof raw !== 'string') return undefined
  const unwrapped = raw.trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim()
  return unwrapped || undefined
}

/**
 * The per-server reasons behind a failed server selection.
 *
 * The driver's own message for this is often no more than "Server selection
 * timed out after 8000 ms", which does not say whether the cluster refused the
 * connection, never answered, or was never found — three different problems
 * with three different fixes. Each server it tried keeps its own error, and
 * that is the part that names the cause.
 */
function describeUnreachableCluster(error: unknown): string {
  const servers = (error as { reason?: { servers?: unknown } })?.reason?.servers
  if (!(servers instanceof Map) || servers.size === 0) return 'no per-server detail'
  return [...servers.entries()]
    .map(([host, description]) => {
      const cause = (description as { error?: unknown })?.error
      return `${String(host)} — ${cause ? describeDbError(cause) : 'no answer'}`
    })
    .join('; ')
}

/**
 * What is wrong with a connection string, in terms that name the mistake
 * without printing the string itself.
 *
 * Everything before "://" is the scheme, which cannot contain credentials, so
 * it is safe to show — and it is where this goes wrong most of the time. The
 * count of "@" after it is the other common mistake: a password containing an
 * "@" splits the host off in the wrong place unless it is percent-encoded.
 */
function describeUriShape(uri: string): string {
  const schemeEnd = uri.indexOf('://')
  if (schemeEnd < 0) {
    return `${uri.length} characters, with no "://" in it at all`
  }
  const rest = uri.slice(schemeEnd + 3)
  const ats = (rest.match(/@/g) ?? []).length
  return [
    `${uri.length} characters`,
    `scheme ${JSON.stringify(uri.slice(0, schemeEnd))}`,
    ats > 1
      ? `${ats} "@" characters after the scheme — a password containing "@" has to be percent-encoded as %40`
      : `${ats} "@" character after the scheme`,
  ].join(', ')
}

const DB_NAME = readSetting('MONGODB_DB') ?? 'devyora'

/**
 * One connection promise, reused across invocations.
 *
 * A serverless function is frozen and thawed rather than restarted, so a
 * client created on one request is still open on the next. Connecting per
 * request would instead open a new pool every time and exhaust the cluster's
 * connection limit under any real traffic. Caching the *promise* (not the
 * resolved client) also means two concurrent cold requests share one connect
 * rather than racing to open two pools.
 */
let clientPromise: Promise<MongoClient> | null = null

/** True when MONGODB_URI is set. Lets routes answer cleanly instead of throwing. */
export function isDatabaseConfigured(): boolean {
  return Boolean(readSetting('MONGODB_URI'))
}

function connect(uri: string): Promise<MongoClient> {
  return new MongoClient(uri, {
    // Fail fast rather than letting a request hang until the platform's own
    // timeout: the caller can show a real message instead of a dead spinner.
    serverSelectionTimeoutMS: 8_000,
    // A serverless instance handles one request at a time, so a large pool is
    // wasted connections against the cluster's cap.
    maxPoolSize: 5,
  }).connect()
}

/** The shared database handle. Throws a DbError when it cannot be reached. */
export async function getDb(): Promise<Db> {
  const uri = readSetting('MONGODB_URI')
  if (!uri) throw new DbConfigError()

  try {
    if (!clientPromise) {
      // Built inside this block on purpose. The driver rejects a connection
      // string it cannot parse by throwing from the constructor — synchronously,
      // before there is any promise to reject. Built outside the try, that
      // throw leaves getDb without ever classifying or logging it, which is
      // exactly the failure an admin most needs named.
      clientPromise = connect(uri).catch((error: unknown) => {
        // Don't cache a failed connect, or every later request in this instance
        // reuses the rejection and the function never recovers.
        clientPromise = null
        throw error
      })
    }
    const client = await clientPromise
    return client.db(DB_NAME)
  } catch (error) {
    // The driver's own error names the cluster and the connection string; the
    // caller gets the cause without either, and the log keeps the detail.
    console.error('[db] connection failed:', describeDbError(error))
    const failure = asDbError(error) ?? error
    if (failure instanceof DbError && failure.reason === 'bad-connection-string') {
      // This is the one cause nobody can act on from the message alone: the
      // string is wrong, but not in a way the screen may repeat back. Its
      // shape goes to the log, where naming the mistake costs no secrets.
      console.error('[db] MONGODB_URI shape:', describeUriShape(uri))
      console.error('[db] MONGODB_DB value:', JSON.stringify(DB_NAME))
    }
    if (failure instanceof DbError && failure.reason === 'cannot-reach-cluster') {
      // Which server, and why it did not answer — the detail the driver's own
      // timeout message leaves out, and the only thing that separates a
      // network access list from a paused cluster or a bad address.
      console.error('[db] cluster unreachable:', describeUnreachableCluster(error))
    }
    throw failure
  }
}

/** A typed collection handle. */
export async function getCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getDb()
  return db.collection<T>(name)
}

/**
 * Confirms the database is actually usable, not merely configured.
 *
 * A ping is the cheapest call that still proves the whole path works: the
 * connection string parsed, the server was reachable, and the credentials were
 * accepted. /api/health uses it so an outage can be placed from a browser.
 *
 * Deliberately one shape rather than a discriminated union. A union keyed on a
 * boolean only gives up its `reason` after the compiler narrows it, and
 * narrowing is a thing a build can be configured out of — the platform that
 * compiles these functions did exactly that, and rejected the health check for
 * reading a property it could not see. A `reason` that is simply optional,
 * carried when the ping failed and absent when it did not, is something no
 * compiler setting can disagree about.
 */
export async function pingDb(): Promise<{ ok: boolean; reason?: DbFailureReason }> {
  try {
    const db = await getDb()
    await db.command({ ping: 1 })
    return { ok: true }
  } catch (error) {
    console.error('[db] ping failed:', describeDbError(error))
    return { ok: false, reason: classifyDbFailure(error) ?? 'unknown' }
  }
}

/** Closes the pooled connection. Only used by tests and scripts. */
export async function closeDb(): Promise<void> {
  if (!clientPromise) return
  const client = await clientPromise.catch(() => null)
  clientPromise = null
  await client?.close()
}
