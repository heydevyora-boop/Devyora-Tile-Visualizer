import { Router } from 'express'
import { isDatabaseConfigured, pingDb } from '../services/db'

/**
 * Local-dev health check.
 *
 * KEEP IN SYNC with the deployed Vercel copy in client/api/health.ts, which
 * carries the full reasoning: the point is to tell a missing API key, a
 * broken image SDK and an unreachable database apart, since all three look
 * like the same opaque failure from the browser.
 */
const router = Router()

router.get('/health', async (_req, res) => {
  let database: 'ready' | 'not-configured' | 'unreachable' = 'not-configured'
  let databaseReason: string | undefined
  if (isDatabaseConfigured()) {
    const ping = await pingDb()
    if (ping.ok) {
      database = 'ready'
    } else {
      database = 'unreachable'
      databaseReason = ping.reason
    }
  }

  res.json({
    status: 'ok',
    apiKeyConfigured: (process.env.GEMINI_API_KEY ?? '').trim().length > 0,
    database,
    ...(databaseReason ? { databaseReason } : {}),
    nodeVersion: process.version,
  })
})

export default router
