// Deployed copy of the MongoDB connection used by the Vercel serverless
// functions in client/api/. Vercel only uploads files under the project Root
// Directory (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/services/.
import { MongoClient, type Collection, type Db, type Document } from 'mongodb'

/** Thrown when the database is not configured; carries the HTTP status. */
export class DbConfigError extends Error {
  status = 503

  constructor(message = 'The database is not configured on the server.') {
    super(message)
    this.name = 'DbConfigError'
  }
}

const DB_NAME = process.env.MONGODB_DB ?? 'devyora'

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
  return Boolean(process.env.MONGODB_URI)
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

/** The shared database handle. Throws DbConfigError when MONGODB_URI is absent. */
export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new DbConfigError()

  if (!clientPromise) {
    clientPromise = connect(uri).catch((error: unknown) => {
      // Don't cache a failed connect, or every later request in this instance
      // reuses the rejection and the function never recovers.
      clientPromise = null
      throw error
    })
  }

  const client = await clientPromise
  return client.db(DB_NAME)
}

/** A typed collection handle. */
export async function getCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getDb()
  return db.collection<T>(name)
}

/** Closes the pooled connection. Only used by tests and scripts. */
export async function closeDb(): Promise<void> {
  if (!clientPromise) return
  const client = await clientPromise.catch(() => null)
  clientPromise = null
  await client?.close()
}
