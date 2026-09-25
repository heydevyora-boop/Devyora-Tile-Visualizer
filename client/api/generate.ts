import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GenerationError, generateVisualization } from './_lib/generateVisualization.js'
import { IMAGE_MODEL } from './_lib/imageModel.js'
import { getSpaceConfig } from './_lib/spaces.js'
import { getStyleConfig, isSurpriseStyle } from './_lib/styles.js'
import { verifyAuthHeader } from './_lib/auth.js'
import { SpaceNodesError, resolveApplicationPath } from './_lib/spaceNodesStore.js'

// A real 3-concept generation takes roughly 15-25s. Vercel's default function
// timeout is 10s, which would abort every request before Gemini answers.
export const maxDuration = 60

/**
 * Our own budget, deliberately under `maxDuration`.
 *
 * If Vercel hits its own limit first it kills the function and returns an
 * opaque platform error page with no JSON body — which is exactly the
 * undiagnosable "Request failed with status 500/504" the UI was showing.
 * Failing a few seconds early lets us return a readable JSON error instead.
 */
const INTERNAL_BUDGET_MS = 50_000

/**
 * Vercel rejects request bodies over 4.5MB before the handler ever runs.
 * Checking here lets us say so clearly rather than letting the platform
 * return a bare 413 the UI cannot explain.
 */
const MAX_BODY_BYTES = 4_000_000

/**
 * Vercel also caps the RESPONSE at 4.5MB. Past that it discards whatever the
 * function returned and answers 500 with an HTML body — a failure that happens
 * after our code has already succeeded, so no try/catch inside the handler can
 * see it. Measuring before sending turns that invisible platform 500 into a
 * readable JSON error that names the real problem.
 */
const MAX_RESPONSE_BYTES = 4_000_000

/** Serialises an unknown thrown value into something worth logging/returning. */
function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      // SDK/HTTP errors commonly carry one of these.
      status: (error as { status?: unknown }).status,
      code: (error as { code?: unknown }).code,
      cause:
        error.cause instanceof Error
          ? { name: error.cause.name, message: error.cause.message }
          : error.cause,
      stack: error.stack,
    }
  }
  return { name: 'NonError', message: String(error) }
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new GenerationError(
                `Image generation did not finish within ${Math.round(ms / 1000)}s. ` +
                  'The image service may be slow right now — please try again.',
                504,
              ),
            ),
          ms,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Everything is inside this try. Previously a throw during body handling (or
  // any other pre-flight step) escaped the handler entirely, which Vercel
  // surfaces as FUNCTION_INVOCATION_FAILED: a 500 with an HTML body and no
  // usable message. Now every failure leaves here as JSON.
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      res.status(405).json({ error: 'Method not allowed. Use POST.' })
      return
    }

    // Checked before the body is even read, and long before the model is
    // called: every generation costs real money, and this endpoint is public
    // on the deployed site. Any signed-in account may generate — this is what
    // the whole showroom tool does — so the role is not checked, only that
    // there is a valid session.
    if (!verifyAuthHeader(req.headers.authorization)) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    let body: Record<string, unknown> = {}
    if (typeof req.body === 'string') {
      if (req.body.length > MAX_BODY_BYTES) {
        res.status(413).json({
          error:
            'The tile photo is too large to upload. Please retake or re-crop it and try again.',
        })
        return
      }
      try {
        body = JSON.parse(req.body)
      } catch {
        res.status(400).json({ error: 'Request body was not valid JSON.' })
        return
      }
    } else if (req.body && typeof req.body === 'object') {
      body = req.body as Record<string, unknown>
    }

    const { tileImage, space, style, tileSize, spacePath } = body as {
      tileImage?: string
      space?: string
      style?: string
      tileSize?: string
      spacePath?: string[]
    }

    const missingFields: string[] = []
    if (!tileImage) missingFields.push('tileImage')
    if (!space) missingFields.push('space')
    if (!style) missingFields.push('style')

    if (missingFields.length > 0) {
      res.status(400).json({
        error: `Missing required field(s): ${missingFields.join(', ')}`,
      })
      return
    }

    if (typeof tileImage === 'string' && tileImage.length > MAX_BODY_BYTES) {
      res.status(413).json({
        error:
          'The tile photo is too large to upload. Please retake or re-crop it and try again.',
      })
      return
    }

    // Checked before the model is called: an unrecognised space or style would
    // otherwise fall through to a generic prompt and still spend a real
    // generation. "Surprise" is a valid style the backend resolves itself.
    if (!getSpaceConfig(space as string)) {
      res
        .status(400)
        .json({ error: 'That space is not one we can visualise. Please pick one from the list.' })
      return
    }
    if (!isSurpriseStyle(style as string) && !getStyleConfig(style as string)) {
      res
        .status(400)
        .json({ error: 'That design style is not one we offer. Please pick one from the list.' })
      return
    }

    // Logged so the real numbers show up in Vercel's runtime logs even on success.
    console.log('[POST /api/generate] start', {
      model: IMAGE_MODEL,
      keyConfigured: Boolean(process.env.GEMINI_API_KEY),
      tileImageBytes: typeof tileImage === 'string' ? tileImage.length : 0,
      space,
      style,
      tileSize,
    })

    // The browser sends the ids it was shown; the chain is re-checked against
    // the catalogue here, so a stale or hand-edited selection cannot instruct
    // the model with an application the showroom never configured.
    const resolved = spacePath ? await resolveApplicationPath(spacePath) : null

    const startedAt = Date.now()
    const result = await withTimeout(
      generateVisualization({
        tileImage: tileImage as string,
        space: (resolved?.spaceId ?? space) as string,
        application: resolved?.path.map((node) => ({
          name: node.name,
          description: node.description,
        })),
        style: style as string,
        tileSize,
      }),
      INTERNAL_BUDGET_MS,
    )
    const payload = JSON.stringify(result)
    const payloadBytes = Buffer.byteLength(payload, 'utf8')
    console.log(
      '[POST /api/generate] done in',
      Date.now() - startedAt,
      'ms, response',
      (payloadBytes / 1024 / 1024).toFixed(2),
      'MB',
    )

    if (payloadBytes > MAX_RESPONSE_BYTES) {
      // Better a clear message than the platform silently replacing our reply.
      const mb = (payloadBytes / 1024 / 1024).toFixed(1)
      console.error(`[POST /api/generate] response too large: ${mb}MB > 4MB cap`)
      res.status(502).json({
        error:
          `The generated images came back too large to return (${mb}MB). ` +
          'Please try again — if it keeps happening, the image quality setting needs lowering.',
      })
      return
    }

    res.setHeader('Content-Type', 'application/json')
    res.status(200).send(payload)
  } catch (error) {
    // A rejected application is the caller's mistake, not a generation
    // failure, so it keeps its own status rather than being reported as 502.
    const status =
      error instanceof SpaceNodesError
        ? error.status
        : error instanceof GenerationError
          ? error.status
          : 502
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'We could not create your concepts. Please try again.'
    const detail = describeError(error)

    // The full detail — error name, message, cause and stack — goes to the
    // Vercel runtime log, which is where it is safe to read. It is
    // deliberately never attached to the response: the browser gets only the
    // friendly message, so a stack trace cannot reach a showroom screen
    // because an env var was left set.
    console.error('[POST /api/generate] FAILED', JSON.stringify(detail))

    res.status(status).json({ error: message })
  }
}
