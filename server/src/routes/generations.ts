import { Router } from 'express'
import {
  GenerationsStoreError,
  appendGeneration,
  listGenerations,
  toGenerationRecord,
} from '../services/generationsStore'
import { verifyAuthHeader } from '../config/auth'

const router = Router()

// Any signed-in account (any role) may save a completed generation — this is
// the fire-and-forget write every showroom user triggers after generating,
// not an admin-only action.
router.post('/generations', async (req, res) => {
  if (!verifyAuthHeader(req.headers.authorization)) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }
  try {
    const record = toGenerationRecord(req.body)
    await appendGeneration(record)
    res.status(201).json({ generationId: record.generationId, saved: true })
  } catch (error) {
    // Saving history must never take the server down, and must never be the
    // reason a user loses a generation they already paid for.
    const status = error instanceof GenerationsStoreError ? error.status : 500
    const message =
      error instanceof Error && error.message ? error.message : 'Could not save this generation.'
    console.error('[POST /api/generations] save failed:', error)
    res.status(status).json({ error: message })
  }
})

// Only admins may read the full history.
router.get('/generations', async (req, res) => {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session || session.role !== 'admin') {
    res.status(401).json({ error: 'Sign in as an administrator to view history.' })
    return
  }
  try {
    const records = await listGenerations()
    res.json(records)
  } catch (error) {
    console.error('[GET /api/generations] read failed:', error)
    res.status(500).json({ error: 'Could not load the generation history.' })
  }
})

export default router
