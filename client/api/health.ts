import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isDatabaseConfigured, pingDb } from './_lib/db.js'

/**
 * Config + dependency check that costs nothing — no image is generated.
 *
 * Open https://<site>/api/health in a browser to confirm the deployed function
 * can see its environment, can actually load the image SDK, AND can reach the
 * database, before spending credits debugging anything else.
 *
 * Each of those three fails in a way that looks identical from the browser —
 * an opaque 500 on every screen — but needs a completely different fix, so the
 * point of this endpoint is to tell them apart in one request.
 *
 * This endpoint is public and unauthenticated, so the response says only
 * whether things are configured and working — never which provider or model is
 * behind them, never a host or cluster, and never a key. Anything diagnostic
 * enough to name a package, an address or an error message goes to the runtime
 * log instead.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const apiKeyConfigured = (process.env.GEMINI_API_KEY ?? '').trim().length > 0

  let imageService: 'ready' | 'unavailable' = 'unavailable'
  try {
    const mod = await import('@google/genai')
    if (typeof mod.GoogleGenAI === 'function') {
      imageService = 'ready'
    } else {
      console.error('[GET /api/health] image SDK loaded but its client export is missing')
    }
  } catch (error) {
    // Named here, in the log, where it is safe to read — not in the response.
    console.error(
      '[GET /api/health] image SDK failed to load:',
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    )
  }

  // A ping, not just a check that MONGODB_URI exists: "configured" and
  // "reachable" are the two states this outage sits between, and only the
  // round trip tells them apart.
  let database: 'ready' | 'not-configured' | 'unreachable' = 'not-configured'
  let databaseReason: string | undefined
  if (isDatabaseConfigured()) {
    const ping = await pingDb()
    if (ping.ok) {
      database = 'ready'
    } else {
      database = 'unreachable'
      // A cause, not a connection string: which knob to turn, nothing about
      // where the cluster is or who connects to it.
      databaseReason = ping.reason
    }
  }

  res.status(200).json({
    status: 'ok',
    apiKeyConfigured,
    imageService,
    database,
    ...(databaseReason ? { databaseReason } : {}),
    nodeVersion: process.version,
    vercelEnv: process.env.VERCEL_ENV ?? 'not-vercel',
  })
}
