import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  GenerationsStoreError,
  appendGeneration,
  listGenerations,
  toGenerationRecord,
} from './_lib/generationsStore.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const records = await listGenerations()
      res.status(200).json(records)
    } catch (error) {
      console.error('[GET /api/generations] read failed:', error)
      res.status(500).json({ error: 'Could not load the generation history.' })
    }
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

    try {
      const record = toGenerationRecord(body)
      await appendGeneration(record)
      res.status(201).json({ generationId: record.generationId, saved: true })
    } catch (error) {
      const status = error instanceof GenerationsStoreError ? error.status : 500
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
