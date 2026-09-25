import { Router } from 'express'
import {
  GenerationsStoreError,
  appendGeneration,
  listGenerations,
  toGenerationRecord,
} from '../services/generationsStore'
import { toOwnerScope } from '../services/clientsStore'
import { verifyAuthHeader } from '../config/auth'
import { DbConfigError } from '../services/db'

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
    const status =
      error instanceof GenerationsStoreError || error instanceof DbConfigError ? error.status : 500
    const message =
      error instanceof Error && error.message ? error.message : 'Could not save this generation.'
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
    const status = error instanceof DbConfigError ? error.status : 500
    console.error('[GET /api/generations] read failed:', error)
    res.status(status).json({ error: 'Could not load the saved visualisations.' })
  }
})

export default router
