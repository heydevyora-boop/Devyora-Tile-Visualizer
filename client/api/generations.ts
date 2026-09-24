import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  GenerationsStoreError,
  appendGeneration,
  listGenerations,
  toGenerationRecord,
} from './_lib/generationsStore.js'
import { toOwnerScope } from './_lib/clientsStore.js'
import { verifyAuthHeader } from './_lib/auth.js'
import { DbConfigError } from './_lib/db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Both methods need a session: the scope decides what is readable.
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }
  const scope = toOwnerScope(session)

  if (req.method === 'GET') {
    // An admin reviews every salesperson's work; a salesperson sees only their
    // own, which the store enforces from the scope rather than a query param.
    try {
      const customerId =
        typeof req.query?.customerId === 'string' ? req.query.customerId : undefined
      const records = await listGenerations(scope, { customerId })
      res.status(200).json(records)
    } catch (error) {
      const status = error instanceof DbConfigError ? error.status : 500
      console.error('[GET /api/generations] read failed:', error)
      res.status(status).json({ error: 'Could not load the saved visualisations.' })
    }
    return
  }

  if (req.method === 'POST') {
    // Any signed-in account may save a completed generation — this is the
    // fire-and-forget write every showroom user triggers after generating.
    let body: unknown = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        res.status(400).json({ error: 'Request body was not valid JSON.' })
        return
      }
    }

    try {
      const record = toGenerationRecord(body, scope)
      await appendGeneration(record)
      res.status(201).json({ generationId: record.generationId, saved: true })
    } catch (error) {
      const status =
        error instanceof GenerationsStoreError || error instanceof DbConfigError
          ? error.status
          : 500
      const message =
        error instanceof Error && error.message ? error.message : 'Could not save this generation.'
      console.error('[POST /api/generations] save failed:', error)
      res.status(status).json({ error: message })
    }
    return
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed. Use GET or POST.' })
}
