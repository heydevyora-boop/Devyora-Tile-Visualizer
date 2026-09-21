import type { VercelRequest, VercelResponse } from '@vercel/node'
import { IMAGE_MODEL } from './_lib/imageModel.js'

/**
 * Config + dependency check that costs nothing — no Gemini call is made.
 *
 * Open https://<site>/api/health in a browser to confirm the deployed function
 * can see its environment AND can actually load the Gemini SDK, before
 * spending credits debugging generation.
 *
 * The SDK load is the important part: if @google/genai fails to load on the
 * server, /api/generate crashes during module initialisation and Vercel
 * returns an opaque 500 with no JSON body — which looks identical to a
 * generation failure from the browser but has a completely different cause.
 * The key itself is never returned, only whether one is present and its shape,
 * which catches the usual mistakes: not set, set on the wrong environment, or
 * pasted with surrounding quotes or whitespace.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const key = process.env.GEMINI_API_KEY ?? ''
  const trimmed = key.trim()

  let sdk: { loaded: boolean; error?: string } = { loaded: false }
  try {
    const mod = await import('@google/genai')
    sdk = { loaded: typeof mod.GoogleGenAI === 'function' }
    if (!sdk.loaded) sdk.error = 'module loaded but GoogleGenAI export is missing'
  } catch (error) {
    sdk = {
      loaded: false,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    }
  }

  res.status(200).json({
    status: 'ok',
    geminiKeyConfigured: trimmed.length > 0,
    geminiKeyLength: trimmed.length,
    // A key that still has quotes or stray whitespace is a common paste error.
    geminiKeyLooksClean: key === trimmed && !/^['"]|['"]$/.test(trimmed),
    imageModel: IMAGE_MODEL,
    debugErrorsEnabled: Boolean(process.env.DEBUG_API_ERRORS),
    sdk,
    nodeVersion: process.version,
    vercelEnv: process.env.VERCEL_ENV ?? 'not-vercel',
  })
}
