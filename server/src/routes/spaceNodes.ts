import { Router, type Request, type Response } from 'express'
import {
  SpaceNodesError,
  createSpaceNode,
  listChildren,
  listSpaceNodes,
  reorderSpaceNodes,
  updateSpaceNode,
} from '../services/spaceNodesStore'
import { verifyAuthHeader } from '../config/auth'
import { DbConfigError } from '../services/db'

/** KEEP IN SYNC with the deployed Vercel copy in client/api/space-nodes.ts. */
const router = Router()

function fail(res: Response, label: string, error: unknown): void {
  const status =
    error instanceof SpaceNodesError || error instanceof DbConfigError ? error.status : 500
  const message =
    error instanceof SpaceNodesError || error instanceof DbConfigError
      ? error.message
      : 'Could not load the space catalogue.'
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
    res.status(403).json({ error: 'Only an administrator can change the space catalogue.' })
    return null
  }
  return session
}

router.get('/space-nodes', async (req, res) => {
  const session = sessionFor(req, res)
  if (!session) return
  try {
    if (req.query.all === '1' && session.role === 'admin') {
      res.json(await listSpaceNodes(true))
      return
    }
    const raw = req.query.parentId
    const parentId = typeof raw === 'string' && raw && raw !== 'root' ? raw : null
    res.json(await listChildren(parentId))
  } catch (error) {
    fail(res, 'GET /api/space-nodes', error)
  }
})

router.post('/space-nodes', async (req, res) => {
  if (!adminOnly(req, res)) return
  try {
    res.status(201).json(await createSpaceNode((req.body ?? {}) as Record<string, unknown>))
  } catch (error) {
    fail(res, 'POST /api/space-nodes', error)
  }
})

router.patch('/space-nodes', async (req, res) => {
  if (!adminOnly(req, res)) return
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    if (Array.isArray(body.order)) {
      res.json(await reorderSpaceNodes(body.order))
      return
    }
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) throw new SpaceNodesError('An entry id is required.')
    res.json(await updateSpaceNode(id, body))
  } catch (error) {
    fail(res, 'PATCH /api/space-nodes', error)
  }
})

export default router
