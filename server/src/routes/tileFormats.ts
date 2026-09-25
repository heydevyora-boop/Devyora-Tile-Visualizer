import { Router, type Request, type Response } from 'express'
import {
  TileFormatsError,
  createTileFormat,
  listTileFormats,
  reorderTileFormats,
  updateTileFormat,
} from '../services/tileFormatsStore'
import { verifyAuthHeader } from '../config/auth'
import { DbConfigError } from '../services/db'

/**
 * The standard tile formats. Reading is open to any signed-in account because
 * the consultation cannot start without the list; changing the catalogue is
 * the showroom's decision and stays with the admin.
 *
 * KEEP IN SYNC with the deployed Vercel copy in client/api/tile-formats.ts.
 */
const router = Router()

function fail(res: Response, label: string, error: unknown): void {
  const status =
    error instanceof TileFormatsError || error instanceof DbConfigError ? error.status : 500
  const message =
    error instanceof TileFormatsError || error instanceof DbConfigError
      ? error.message
      : 'Could not load the tile formats.'
  console.error(`[${label}] failed:`, error)
  res.status(status).json({ error: message })
}

function sessionFor(req: Request, res: Response) {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return null
  }
  return session
}

router.get('/tile-formats', async (req, res) => {
  const session = sessionFor(req, res)
  if (!session) return
  try {
    res.json(await listTileFormats(req.query.all === '1' && session.role === 'admin'))
  } catch (error) {
    fail(res, 'GET /api/tile-formats', error)
  }
})

router.post('/tile-formats', async (req, res) => {
  const session = sessionFor(req, res)
  if (!session) return
  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Only an administrator can change the tile formats.' })
    return
  }
  try {
    res.status(201).json(await createTileFormat(req.body ?? {}))
  } catch (error) {
    fail(res, 'POST /api/tile-formats', error)
  }
})

router.patch('/tile-formats', async (req, res) => {
  const session = sessionFor(req, res)
  if (!session) return
  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Only an administrator can change the tile formats.' })
    return
  }
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    if (Array.isArray(body.order)) {
      res.json(await reorderTileFormats(body.order))
      return
    }
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) throw new TileFormatsError('A format id is required.')
    res.json(await updateTileFormat(id, body))
  } catch (error) {
    fail(res, 'PATCH /api/tile-formats', error)
  }
})

export default router
