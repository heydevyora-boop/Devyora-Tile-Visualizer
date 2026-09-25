import { Router, type Request, type Response } from 'express'
import {
  DesignOptionsError,
  createDesignOption,
  listAllDesignOptions,
  listDesignOptions,
  reorderDesignOptions,
  updateDesignOption,
} from '../services/designOptionsStore'
import { verifyAuthHeader } from '../config/auth'
import { DbError, asDbError } from '../services/db'

/** KEEP IN SYNC with the deployed Vercel copy in client/api/design-options.ts. */
const router = Router()

function fail(res: Response, label: string, error: unknown): void {
  // A driver failure is the datastore's fault, not the request's. Classifying it
  // here means the screen says what is actually wrong instead of showing a bare
  // 500 that could equally be a bug in this route.
  const failure = asDbError(error) ?? error
  const status =
    failure instanceof DesignOptionsError || failure instanceof DbError ? failure.status : 500
  const message =
    failure instanceof DesignOptionsError || failure instanceof DbError
      ? failure.message
      : 'Could not load the design options.'
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

function adminOnly(req: Request, res: Response) {
  const session = sessionFor(req, res)
  if (!session) return null
  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Only an administrator can change these options.' })
    return null
  }
  return session
}

router.get('/design-options', async (req, res) => {
  const session = sessionFor(req, res)
  if (!session) return
  try {
    if (req.query.all === '1' && session.role === 'admin') {
      res.json(await listAllDesignOptions())
      return
    }
    const kind = req.query.kind
    // 'reason' belongs here too: the salesperson's "what would you like to
    // change?" panel reads the revision reasons through this same route.
    if (kind !== 'style' && kind !== 'joint' && kind !== 'pattern' && kind !== 'reason') {
      throw new DesignOptionsError('Ask for style, joint, pattern or reason.')
    }
    res.json(await listDesignOptions(kind))
  } catch (error) {
    fail(res, 'GET /api/design-options', error)
  }
})

router.post('/design-options', async (req, res) => {
  if (!adminOnly(req, res)) return
  try {
    res.status(201).json(await createDesignOption((req.body ?? {}) as Record<string, unknown>))
  } catch (error) {
    fail(res, 'POST /api/design-options', error)
  }
})

router.patch('/design-options', async (req, res) => {
  if (!adminOnly(req, res)) return
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    if (Array.isArray(body.order)) {
      res.json(await reorderDesignOptions(body.order))
      return
    }
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) throw new DesignOptionsError('An option id is required.')
    res.json(await updateDesignOption(id, body))
  } catch (error) {
    fail(res, 'PATCH /api/design-options', error)
  }
})

export default router
