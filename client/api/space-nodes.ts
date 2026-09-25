import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  SpaceNodesError,
  createSpaceNode,
  listChildren,
  listSpaceNodes,
  reorderSpaceNodes,
  updateSpaceNode,
} from './_lib/spaceNodesStore.js'
import { verifyAuthHeader } from './_lib/auth.js'
import { DbConfigError } from './_lib/db.js'

/**
 * The space catalogue: categories, their applications, and any deeper choices.
 *
 * GET  ?parentId=<id|root>  — the active children at one level, for the flow.
 *      ?all=1               — admin: the whole tree including disabled entries.
 * POST / PATCH              — admin only.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }

  const requireAdmin = () => {
    if (session.role !== 'admin') {
      throw new SpaceNodesError('Only an administrator can change the space catalogue.', 403)
    }
  }

  const parseBody = (): Record<string, unknown> => {
    let body: unknown = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        throw new SpaceNodesError('Request body was not valid JSON.')
      }
    }
    return (body ?? {}) as Record<string, unknown>
  }

  try {
    if (req.method === 'GET') {
      if (req.query?.all === '1' && session.role === 'admin') {
        res.status(200).json(await listSpaceNodes(true))
        return
      }
      const raw = req.query?.parentId
      const parentId = typeof raw === 'string' && raw && raw !== 'root' ? raw : null
      res.status(200).json(await listChildren(parentId))
      return
    }

    if (req.method === 'POST') {
      requireAdmin()
      res.status(201).json(await createSpaceNode(parseBody()))
      return
    }

    if (req.method === 'PATCH') {
      requireAdmin()
      const body = parseBody()
      if (Array.isArray(body.order)) {
        res.status(200).json(await reorderSpaceNodes(body.order))
        return
      }
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) throw new SpaceNodesError('An entry id is required.')
      res.status(200).json(await updateSpaceNode(id, body))
      return
    }

    res.setHeader('Allow', 'GET, POST, PATCH')
    res.status(405).json({ error: 'Method not allowed.' })
  } catch (error) {
    const status =
      error instanceof SpaceNodesError || error instanceof DbConfigError ? error.status : 500
    const message =
      error instanceof SpaceNodesError || error instanceof DbConfigError
        ? error.message
        : 'Could not load the space catalogue.'
    console.error(`[${req.method} /api/space-nodes] failed:`, error)
    res.status(status).json({ error: message })
  }
}
