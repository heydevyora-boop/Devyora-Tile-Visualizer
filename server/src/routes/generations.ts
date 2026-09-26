import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  SavedVisualisationsError,
  getSavedVisualisation,
  listSavedVisualisations,
  removeSavedVisualisation,
  saveVisualisation,
} from '../services/savedVisualisationsStore'
import { toOwnerScope } from '../services/clientsStore'
import { verifyAuthHeader } from '../config/auth'
import { DbError, asDbError } from '../services/db'

/**
 * A client's permanent record of kept concepts.
 *
 * Generating does not write here. A concept becomes part of a client's record
 * only when a salesperson saves it, which is what keeps the record made of
 * agreed work rather than of every experiment along the way.
 *
 * KEEP IN SYNC with the deployed Vercel copy in client/api/generations.ts.
 */
const router = Router()

function fail(res: Response, label: string, error: unknown, fallback: string): void {
  const failure = asDbError(error) ?? error
  const status =
    failure instanceof SavedVisualisationsError || failure instanceof DbError
      ? failure.status
      : 500
  // Only errors this code raised are safe to repeat back: a driver message can
  // carry the cluster address and the user it connected as.
  const message =
    failure instanceof SavedVisualisationsError || failure instanceof DbError
      ? failure.message
      : fallback
  console.error(`[${label}] failed:`, error)
  res.status(status).json({ error: message })
}

function scopeFor(req: Request, res: Response) {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return null
  }
  return toOwnerScope(session)
}

router.get('/generations', async (req, res) => {
  const scope = scopeFor(req, res)
  if (!scope) return
  try {
    const id = typeof req.query?.id === 'string' ? req.query.id : undefined
    if (id) {
      const saved = await getSavedVisualisation(scope, id)
      if (!saved) {
        res.status(404).json({ error: 'That saved concept was not found.' })
        return
      }
      res.status(200).json(saved)
      return
    }
    const customerId = typeof req.query?.customerId === 'string' ? req.query.customerId : undefined
    const architectId =
      typeof req.query?.architectId === 'string' ? req.query.architectId : undefined
    // One salesperson's work, for the admin screen. Harmless from anyone else:
    // the store lets the caller's own scope overwrite it.
    const salesperson =
      typeof req.query?.salesperson === 'string' ? req.query.salesperson : undefined
    res
      .status(200)
      .json(await listSavedVisualisations(scope, { customerId, architectId, salesperson }))
  } catch (error) {
    fail(res, 'GET /api/generations', error, 'Could not load the saved concepts.')
  }
})

router.post('/generations', async (req, res) => {
  const scope = scopeFor(req, res)
  if (!scope) return
  try {
    const saved = await saveVisualisation(scope, (req.body ?? {}) as Record<string, unknown>)
    res.status(201).json(saved)
  } catch (error) {
    fail(res, 'POST /api/generations', error, 'Could not save this concept.')
  }
})

router.delete('/generations', async (req, res) => {
  const scope = scopeFor(req, res)
  if (!scope) return
  try {
    const id = typeof req.query?.id === 'string' ? req.query.id : ''
    if (!id) {
      res.status(400).json({ error: 'Which saved concept should be removed?' })
      return
    }
    const removed = await removeSavedVisualisation(scope, id)
    if (!removed) {
      res.status(404).json({ error: 'That saved concept was not found.' })
      return
    }
    res.status(200).json({ removed: true })
  } catch (error) {
    fail(res, 'DELETE /api/generations', error, 'Could not remove this saved concept.')
  }
})

export default router
