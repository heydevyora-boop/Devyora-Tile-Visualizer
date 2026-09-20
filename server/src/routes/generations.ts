import { Router } from 'express'
import {
  GenerationsStoreError,
  appendGeneration,
  listGenerations,
  toGenerationRecord,
} from '../services/generationsStore'

const router = Router()

router.post('/generations', async (req, res) => {
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

router.get('/generations', async (_req, res) => {
  try {
    const records = await listGenerations()
    res.json(records)
  } catch (error) {
    console.error('[GET /api/generations] read failed:', error)
    res.status(500).json({ error: 'Could not load the generation history.' })
  }
})

export default router
