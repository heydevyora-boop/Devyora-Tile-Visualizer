import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Config + dependency check that costs nothing — no image is generated.
 *
 * Open https://<site>/api/health in a browser to confirm the deployed function
 * can see its environment AND can actually load the image SDK, before spending
 * credits debugging generation.
 *
 * The SDK load is the important part: if @google/genai fails to load on the
 * server, /api/generate crashes during module initialisation and Vercel
 * returns an opaque 500 with no JSON body — which looks identical to a
 * generation failure from the browser but has a completely different cause.
 *
 * This endpoint is public and unauthenticated, so the response says only
 * whether things are configured and working — never which provider or model
 * is behind them, and never the key itself. Anything diagnostic enough to
 * name a package or carry an error message goes to the runtime log instead.
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

  res.status(200).json({
    status: 'ok',
    apiKeyConfigured,
    imageService,
    nodeVersion: process.version,
    vercelEnv: process.env.VERCEL_ENV ?? 'not-vercel',
  })
}
