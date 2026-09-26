import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  TileFormatsError,
  createTileFormat,
  listTileFormats,
  reorderTileFormats,
  updateTileFormat,
} from './_lib/tileFormatsStore.js'
import { verifyAuthHeader } from './_lib/auth.js'
import { DbError, asDbError } from './_lib/db.js'

/**
 * The standard tile formats.
 *
 * GET   — any signed-in account; the flow needs the active list to render.
 *         ?all=1 additionally returns disabled formats, for the admin screen.
 * POST  — admin only; add a format.
 * PATCH — admin only; edit or disable one, or rewrite the order.
 *
 * Reading is open to salespeople because the consultation cannot start
 * without it; changing the catalogue is the showroom's decision, so it is
 * kept to the admin.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }

  const requireAdmin = () => {
    if (session.role !== 'admin') {
      throw new TileFormatsError('Only an administrator can change the tile formats.', 403)
    }
  }

  const parseBody = (): Record<string, unknown> => {
    let body: unknown = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        throw new TileFormatsError('Request body was not valid JSON.')
      }
    }
    return (body ?? {}) as Record<string, unknown>
  }

  try {
    if (req.method === 'GET') {
      const includeDisabled = req.query?.all === '1' && session.role === 'admin'
      res.status(200).json(await listTileFormats(includeDisabled))
      return
    }

    if (req.method === 'POST') {
      requireAdmin()
      res.status(201).json(await createTileFormat(parseBody()))
      return
    }

    if (req.method === 'PATCH') {
      requireAdmin()
      const body = parseBody()
      if (Array.isArray(body.order)) {
        res.status(200).json(await reorderTileFormats(body.order))
        return
      }
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) throw new TileFormatsError('A format id is required.')
      res.status(200).json(await updateTileFormat(id, body))
      return
    }

    res.setHeader('Allow', 'GET, POST, PATCH')
    res.status(405).json({ error: 'Method not allowed.' })
  } catch (error) {
    // A driver failure is the datastore's fault, not the request's. Classifying
    // it here means the screen says what is actually wrong instead of showing a
    // bare 500 that could equally be a bug in this route.
    const failure = asDbError(error) ?? error
    const status =
      failure instanceof TileFormatsError || failure instanceof DbError ? failure.status : 500
    const message =
      failure instanceof TileFormatsError || failure instanceof DbError
        ? failure.message
        : 'Could not load the tile formats.'
    console.error(`[${req.method} /api/tile-formats] failed:`, error)
    res.status(status).json({ error: message })
  }
}
