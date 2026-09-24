import { Router } from 'express'
import {
  ClientsStoreError,
  createArchitect,
  createCustomer,
  listArchitects,
  listCustomers,
  toOwnerScope,
} from '../services/clientsStore'
import { verifyAuthHeader } from '../config/auth'
import { DbConfigError } from '../services/db'
import type { Request, Response } from 'express'

/**
 * The salesperson's client book: architects/contractors and the customers
 * under them, plus walk-in customers with no architect.
 *
 * Every read and write is scoped to the signed-in salesperson by the store, so
 * one salesperson can never see or attach to another's clients. An admin
 * reviews all of them.
 *
 * KEEP IN SYNC with the deployed Vercel copies in client/api/customers.ts and
 * client/api/architects.ts.
 */
const router = Router()

/** Maps a store failure onto a response, without leaking internals. */
function fail(res: Response, label: string, error: unknown, fallback: string): void {
  const status =
    error instanceof ClientsStoreError || error instanceof DbConfigError ? error.status : 500
  const message =
    error instanceof ClientsStoreError || error instanceof DbConfigError ? error.message : fallback
  console.error(`[${label}] failed:`, error)
  res.status(status).json({ error: message })
}

/** Resolves the caller's scope, or answers 401 and returns null. */
function scopeFor(req: Request, res: Response) {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return null
  }
  return toOwnerScope(session)
}

router.get('/customers', async (req, res) => {
  const scope = scopeFor(req, res)
  if (!scope) return
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : undefined
    const architectId = typeof req.query.architectId === 'string' ? req.query.architectId : undefined
    res.json(await listCustomers(scope, { query, architectId }))
  } catch (error) {
    fail(res, 'GET /api/customers', error, 'Could not load your clients. Please try again.')
  }
})

router.post('/customers', async (req, res) => {
  const scope = scopeFor(req, res)
  if (!scope) return
  try {
    res.status(201).json(await createCustomer(scope, req.body ?? {}))
  } catch (error) {
    fail(res, 'POST /api/customers', error, 'Could not save this client. Please try again.')
  }
})

router.get('/architects', async (req, res) => {
  const scope = scopeFor(req, res)
  if (!scope) return
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : undefined
    res.json(await listArchitects(scope, query))
  } catch (error) {
    fail(res, 'GET /api/architects', error, 'Could not load your architects. Please try again.')
  }
})

router.post('/architects', async (req, res) => {
  const scope = scopeFor(req, res)
  if (!scope) return
  try {
    res.status(201).json(await createArchitect(scope, req.body ?? {}))
  } catch (error) {
    fail(res, 'POST /api/architects', error, 'Could not save this architect. Please try again.')
  }
})

export default router
