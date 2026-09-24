import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  ClientsStoreError,
  createCustomer,
  listCustomers,
  toOwnerScope,
} from './_lib/clientsStore.js'
import { verifyAuthHeader } from './_lib/auth.js'
import { DbConfigError } from './_lib/db.js'

/**
 * The salesperson's client book.
 *
 * GET  /api/customers?q=&architectId=  — their own customers, searchable.
 * POST /api/customers                  — add one (name and mobile required).
 *
 * Reads and writes are scoped to the signed-in salesperson by the store, so
 * one salesperson can never see or attach to another's clients.
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
      const architectId =
        typeof req.query?.architectId === 'string' ? req.query.architectId : undefined
      res.status(200).json(await listCustomers(scope, { query, architectId }))
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
      const customer = await createCustomer(scope, (body ?? {}) as Record<string, unknown>)
      res.status(201).json(customer)
      return
    }

    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed. Use GET or POST.' })
  } catch (error) {
    const status =
      error instanceof ClientsStoreError || error instanceof DbConfigError ? error.status : 500
    const message =
      error instanceof ClientsStoreError || error instanceof DbConfigError
        ? error.message
        : 'Could not load your clients. Please try again.'
    console.error(`[${req.method} /api/customers] failed:`, error)
    res.status(status).json({ error: message })
  }
}
