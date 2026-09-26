import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  ClientsStoreError,
  createArchitect,
  listArchitects,
  toOwnerScope,
} from './_lib/clientsStore.js'
import { verifyAuthHeader } from './_lib/auth.js'
import { DbError, asDbError } from './_lib/db.js'

/**
 * The salesperson's architects and contractors.
 *
 * GET  /api/architects?q=            — their own architects, searchable.
 * POST /api/architects            — add one (name and mobile required).
 *
 * Reads and writes are scoped to the signed-in salesperson by the store, so
 * one salesperson can never see another's contacts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }
  const scope = toOwnerScope(session)

  try {
    if (req.method === 'GET') {
      const query = typeof req.query?.q === 'string' ? req.query.q : undefined
      res.status(200).json(await listArchitects(scope, query))
      return
    }

    if (req.method === 'POST') {
      let body: unknown = req.body
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body)
        } catch {
          res.status(400).json({ error: 'Request body was not valid JSON.' })
          return
        }
      }
      const customer = await createArchitect(scope, (body ?? {}) as Record<string, unknown>)
      res.status(201).json(customer)
      return
    }

    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed. Use GET or POST.' })
  } catch (error) {
    // A driver failure is the datastore's fault, not the request's. Classifying
    // it here means the screen says what is actually wrong instead of showing a
    // bare 500 that could equally be a bug in this route.
    const failure = asDbError(error) ?? error
    const status =
      failure instanceof ClientsStoreError || failure instanceof DbError ? failure.status : 500
    const message =
      failure instanceof ClientsStoreError || failure instanceof DbError
        ? failure.message
        : 'Could not load your architects. Please try again.'
    console.error(`[${req.method} /api/architects] failed:`, error)
    res.status(status).json({ error: message })
  }
}
