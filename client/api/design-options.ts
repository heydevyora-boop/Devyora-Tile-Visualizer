import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  DesignOptionsError,
  createDesignOption,
  listAllDesignOptions,
  listDesignOptions,
  reorderDesignOptions,
  updateDesignOption,
} from './_lib/designOptionsStore.js'
import { verifyAuthHeader } from './_lib/auth.js'
import { DbError, asDbError } from './_lib/db.js'

/**
 * Design styles, joint widths, laying patterns and revision reasons.
 *
 * GET ?kind=style|joint|pattern|reason — the active options of one kind.
 * GET ?all=1                         — admin: everything, including disabled.
 * POST / PATCH                       — admin only.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }

  const requireAdmin = () => {
    if (session.role !== 'admin') {
      throw new DesignOptionsError('Only an administrator can change these options.', 403)
    }
  }

  const parseBody = (): Record<string, unknown> => {
    let body: unknown = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        throw new DesignOptionsError('Request body was not valid JSON.')
      }
    }
    return (body ?? {}) as Record<string, unknown>
  }

  try {
    if (req.method === 'GET') {
      if (req.query?.all === '1' && session.role === 'admin') {
        res.status(200).json(await listAllDesignOptions())
        return
      }
      const kind = req.query?.kind
      // 'reason' belongs here too: the salesperson's "what would you like to
      // change?" panel reads the revision reasons through this same route.
      if (kind !== 'style' && kind !== 'joint' && kind !== 'pattern' && kind !== 'reason') {
        throw new DesignOptionsError('Ask for style, joint, pattern or reason.')
      }
      res.status(200).json(await listDesignOptions(kind))
      return
    }

    if (req.method === 'POST') {
      requireAdmin()
      res.status(201).json(await createDesignOption(parseBody()))
      return
    }

    if (req.method === 'PATCH') {
      requireAdmin()
      const body = parseBody()
      if (Array.isArray(body.order)) {
        res.status(200).json(await reorderDesignOptions(body.order))
        return
      }
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) throw new DesignOptionsError('An option id is required.')
      res.status(200).json(await updateDesignOption(id, body))
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
      failure instanceof DesignOptionsError || failure instanceof DbError ? failure.status : 500
    const message =
      failure instanceof DesignOptionsError || failure instanceof DbError
        ? failure.message
        : 'Could not load the design options.'
    console.error(`[${req.method} /api/design-options] failed:`, error)
    res.status(status).json({ error: message })
  }
}
