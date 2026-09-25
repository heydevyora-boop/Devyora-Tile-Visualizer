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
import { DbConfigError } from '../services/db'

/** KEEP IN SYNC with the deployed Vercel copy in client/api/design-options.ts. */
const router = Router()

function fail(res: Response, label: string, error: unknown): void {
  const status =
    error instanceof DesignOptionsError || error instanceof DbConfigError ? error.status : 500
  const message =
    error instanceof DesignOptionsError || error instanceof DbConfigError
      ? error.message
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
    if (kind !== 'style' && kind !== 'joint' && kind !== 'pattern') {
      throw new DesignOptionsError('Ask for style, joint or pattern.')
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
