import { Router } from 'express'
import {
  GenerationsStoreError,
  appendGeneration,
  listGenerations,
  toGenerationRecord,
} from '../services/generationsStore'
import { toOwnerScope } from '../services/clientsStore'
import { verifyAuthHeader } from '../config/auth'
import { DbError, asDbError } from '../services/db'

const router = Router()

// Any signed-in account may save a completed generation — this is the
// fire-and-forget write every showroom user triggers after generating.
// Ownership is taken from the session, never from the body.
router.post('/generations', async (req, res) => {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }
  try {
    const record = toGenerationRecord(req.body, toOwnerScope(session))
    await appendGeneration(record)
    res.status(201).json({ generationId: record.generationId, saved: true })
  } catch (error) {
    // Saving history must never take the server down, and must never be the
    // reason a user loses a generation they already paid for.
    const failure = asDbError(error) ?? error
    const status =
      failure instanceof GenerationsStoreError || failure instanceof DbError ? failure.status : 500
    // Only errors this code raised are safe to repeat back: a driver message can
    // carry the cluster address and the user it connected as.
    const message =
      failure instanceof GenerationsStoreError || failure instanceof DbError
        ? failure.message
        : 'Could not save this generation.'
    console.error('[POST /api/generations] save failed:', error)
    res.status(status).json({ error: message })
  }
})

// An admin reviews every salesperson's work; a salesperson sees only their
// own. The store enforces that from the scope, not from a query parameter.
router.get('/generations', async (req, res) => {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }
  try {
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined
    res.json(await listGenerations(toOwnerScope(session), { customerId }))
  } catch (error) {
    // An unreachable or misconfigured datastore is a 503 with a cause the admin
    // can act on, not an anonymous 500.
    const failure = asDbError(error) ?? error
    const status = failure instanceof DbError ? failure.status : 500
    const message =
      failure instanceof DbError ? failure.message : 'Could not load the saved visualisations.'
    console.error('[GET /api/generations] read failed:', error)
    res.status(status).json({ error: message })
  }
})

export default router
