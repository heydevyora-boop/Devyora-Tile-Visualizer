import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  SavedVisualisationsError,
  getSavedVisualisation,
  listSavedVisualisations,
  removeSavedVisualisation,
  saveVisualisation,
} from './_lib/savedVisualisationsStore.js'
import { toOwnerScope } from './_lib/clientsStore.js'
import { getGenerationImage, listGenerationActivity } from './_lib/revisionsStore.js'
import { verifyAuthHeader } from './_lib/auth.js'
import { DbError, asDbError } from './_lib/db.js'

/**
 * A client's permanent record of kept concepts.
 *
 * GET  /api/generations                 — everything this caller may see.
 * GET  /api/generations?customerId=…    — one client's record.
 * GET  /api/generations?view=activity   — the admin log: every generation, saved or not.
 *      &lite=1                          — the same records without images, so all fit.
 *      &image=<id>                      — one generation's image (owner-scoped).
 * GET  /api/generations?id=…            — one saved concept, in full. This
 *                                         reads the stored record; it never
 *                                         regenerates the image.
 * POST /api/generations                 — Save to Client: keep one concept.
 * DELETE /api/generations?id=…          — remove it from the client's record.
 *
 * Generating does not write here. A concept becomes part of a client's record
 * only when a salesperson saves it, which is what keeps the record made of
 * agreed work rather than of every experiment along the way.
 *
 * KEEP IN SYNC with the local-dev Express copy in server/src/routes/generations.ts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }
  const scope = toOwnerScope(session)

  const fail = (error: unknown, fallback: string) => {
    const failure = asDbError(error) ?? error
    const status =
      failure instanceof SavedVisualisationsError || failure instanceof DbError
        ? failure.status
        : 500
    // Only errors this code raised are safe to repeat back: a driver message
    // can carry the cluster address and the user it connected as.
    const message =
      failure instanceof SavedVisualisationsError || failure instanceof DbError
        ? failure.message
        : fallback
    console.error(`[${req.method} /api/generations] failed:`, error)
    res.status(status).json({ error: message })
  }

  try {
    if (req.method === 'GET') {
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
      // The admin activity log: every generation, saved to a client or not.
      if (req.query?.view === 'activity') {
        // One generation's image, for a list fetched with lite=1.
        if (typeof req.query?.image === 'string' && req.query.image) {
          const image = await getGenerationImage(scope, req.query.image)
          if (!image) {
            res.status(404).json({ error: 'That generation was not found.' })
            return
          }
          res.status(200).json(image)
          return
        }
        const salesperson =
          typeof req.query?.salesperson === 'string' ? req.query.salesperson : undefined
        // lite=1: every record, without images (see listGenerationActivity).
        const lite = req.query?.lite === '1'
        res.status(200).json(await listGenerationActivity(scope, { salesperson, lite }))
        return
      }
      const customerId =
        typeof req.query?.customerId === 'string' ? req.query.customerId : undefined
      const architectId =
        typeof req.query?.architectId === 'string' ? req.query.architectId : undefined
      // One salesperson's work, for the admin screen. Harmless from anyone
      // else: the store lets the caller's own scope overwrite it.
      const salesperson =
        typeof req.query?.salesperson === 'string' ? req.query.salesperson : undefined
      res
        .status(200)
        .json(await listSavedVisualisations(scope, { customerId, architectId, salesperson }))
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
      const saved = await saveVisualisation(scope, (body ?? {}) as Record<string, unknown>)
      res.status(201).json(saved)
      return
    }

    if (req.method === 'DELETE') {
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
      return
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'Method not allowed. Use GET, POST or DELETE.' })
  } catch (error) {
    fail(error, 'Could not load the saved concepts.')
  }
}
