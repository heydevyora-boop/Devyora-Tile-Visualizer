import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GenerationError, generateVisualization } from './_lib/generateVisualization.js'
import { IMAGE_MODEL } from './_lib/imageModel.js'
import { getSpaceConfig } from './_lib/spaces.js'
import { verifyAuthHeader } from './_lib/auth.js'
import { SpaceNodesError, resolveApplicationPath } from './_lib/spaceNodesStore.js'
import {
  DesignOptionsError,
  findActiveOption,
  requireJointWidth,
} from './_lib/designOptionsStore.js'
import { GenerateRequestError, toSizeId, validateTiles } from './_lib/generateRequest.js'
import { buildGenerationBrief } from './_lib/generationBrief.js'
import { assertSelectionsUnchanged, resolveCorrection } from './_lib/correctionRequest.js'
import { getArchitect, getCustomer, toOwnerScope } from './_lib/clientsStore.js'
import { DbError, asDbError } from './_lib/db.js'
import { recordRevision } from './_lib/revisionsStore.js'

// One concept takes roughly 15-25s, and a retry on a busy service can double that. Vercel's default function
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
    const session = verifyAuthHeader(req.headers.authorization)
    if (!session) {
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

    const {
      space,
      spacePath,
      jointOptionId,
      jointWidthMm,
      patternOptionId,
      highlighterLocationOptionId,
      customerId,
      additionalRequirement,
      conceptIndex,
      parentRevisionId,
      reasonIds,
      revisionNote,
    } = body as {
      space?: string
      spacePath?: string[]
      jointOptionId?: string
      jointWidthMm?: number
      patternOptionId?: string
      highlighterLocationOptionId?: string
      customerId?: string
      additionalRequirement?: string
      conceptIndex?: number
      parentRevisionId?: string
      reasonIds?: string[]
      revisionNote?: string
    }

    // The tile part of the request — two separate references, each with its own
    // size as numbers — is checked as a unit before anything else is looked up
    // or billed. It throws a GenerateRequestError, mapped to a 400 below.
    const tiles = validateTiles(body)
    // The size the prompt's geometry description reads. Built here from the
    // numbers, so the text is never the source of truth for the size.
    const tileSize = toSizeId(tiles.highlighterDimensions)

    // Both photos travel in the one request body, so the cap applies to them together.
    const photoBytes = tiles.highlighterTileImage.length + (tiles.plainTileImage?.length ?? 0)
    if (photoBytes > MAX_BODY_BYTES) {
      res.status(413).json({
        error:
          'The tile photos are too large to upload. Please retake or re-crop them and try again.',
      })
      return
    }

    const missingFields: string[] = []
    if (!space) missingFields.push('space')
    if (!highlighterLocationOptionId) missingFields.push('highlighterLocationOptionId')

    if (missingFields.length > 0) {
      res.status(400).json({
        error: `Missing required field(s): ${missingFields.join(', ')}`,
      })
      return
    }

    // Checked before the model is called: an unrecognised space would
    // otherwise fall through to a generic prompt and still spend a real
    // generation.
    if (!getSpaceConfig(space as string)) {
      res
        .status(400)
        .json({ error: 'That space is not one we can visualise. Please pick one from the list.' })
      return
    }

    // Logged so the real numbers show up in Vercel's runtime logs even on success.
    console.log('[POST /api/generate] start', {
      model: IMAGE_MODEL,
      keyConfigured: Boolean(process.env.GEMINI_API_KEY),
      highlighterTileImageBytes: tiles.highlighterTileImage.length,
      plainTileProvided: tiles.plainTileProvided,
      plainTileImageBytes: tiles.plainTileImage?.length ?? 0,
      space,
      tileSize,
    })

    // The browser sends the ids it was shown; the chain is re-checked against
    // the catalogue here, so a stale or hand-edited selection cannot instruct
    // the model with an application the showroom never configured.
    // Mandatory: the placement is a hard constraint, so a request without one
    // is refused (resolveApplicationPath says so) rather than generated generically.
    const resolved = await resolveApplicationPath(spacePath)
    // The joint width may be one of the showroom's presets or typed in, so it
    // is validated as a measurement either way. The pattern and the highlighter
    // location are looked up by id, so a disabled or invented option cannot
    // reach the model.
    // Kept as the option, not just its millimetres: the saved record names the
    // joint the showroom offered ("Standard 2 mm"), which a bare number cannot.
    const jointOption = jointOptionId
      ? await findActiveOption('joint', String(jointOptionId))
      : null
    const joint = jointOptionId
      ? jointOption?.valueMm ?? undefined
      : jointWidthMm !== undefined
        ? requireJointWidth(jointWidthMm)
        : undefined
    const pattern = patternOptionId
      ? await findActiveOption('pattern', String(patternOptionId))
      : null
    // Where the highlighter goes is a hard architectural input, so an option
    // that is missing, disabled or invented is refused outright rather than
    // quietly replaced with a plausible one.
    const highlighterLocation = await findActiveOption(
      'highlighterLocation',
      String(highlighterLocationOptionId),
    )
    if (!highlighterLocation) {
      res.status(400).json({
        error: 'That highlighter location is not one we offer. Please pick one from the list.',
      })
      return
    }
    // A request for another concept is checked against the concept it corrects
    // before anything is billed: the parent must exist and be this salesperson's,
    // the reason must be one the showroom still offers, and the written
    // correction is capped. Null for a first concept.
    const correction = await resolveCorrection(toOwnerScope(session), {
      parentRevisionId,
      conceptIndex,
      reasonIds,
      revisionNote,
    })
    // Length-capped here as well as in the browser: the field is free text and
    // reaches the model, so an unbounded value is not accepted on trust.
    const requirement =
      typeof additionalRequirement === 'string' && additionalRequirement.trim()
        ? additionalRequirement.trim().slice(0, 300)
        : undefined
    // The structured context for this generation, assembled server-side.
    // Identity is never taken from the browser: the salesperson comes from the
    // verified session, and the architect is looked up from the customer,
    // which is itself scoped to that salesperson. None of it is put in the
    // prompt — who the customer is does not belong in an image instruction —
    // but it is logged so a generation can be traced back to the consultation
    // it came from.
    const customer = customerId
      ? await getCustomer(toOwnerScope(session), String(customerId))
      : null
    // Everything the customer selected, as separate structured values. This is
    // the record of the request: the model's input is rendered from it, and it
    // is logged here and stored on the concept so that exactly what was asked
    // can be inspected afterwards. It holds no photographs.
    const brief = buildGenerationBrief({
      highlighterDimensions: tiles.highlighterDimensions,
      plainTileProvided: tiles.plainTileProvided,
      plainDimensions: tiles.plainDimensions,
      path: resolved.path,
      highlighterLocation: {
        id: highlighterLocation.id,
        name: highlighterLocation.name,
        description: highlighterLocation.description,
      },
      jointWidthMm: joint ?? null,
      jointPreset: jointOption?.name ?? null,
      layingPattern: pattern
        ? { id: pattern.id, name: pattern.name, description: pattern.description }
        : null,
      additionalInstructions: requirement ?? null,
      reasons: correction?.reasons ?? [],
      additionalInstruction: correction?.note ?? null,
      parentRevisionId: correction?.parent.id ?? null,
      conceptIndex: correction && typeof conceptIndex === 'number' ? conceptIndex : 0,
      viewpoint: correction?.viewpoint ?? 0,
    })
    // A correction carries every approved selection of the concept it corrects,
    // unchanged. One that does not is a different brief, and is refused here.
    if (correction) assertSelectionsUnchanged(correction.parent, brief)
    // Who this is for stays out of the brief, and out of the prompt: who the
    // customer is does not belong in an image instruction. It is logged beside
    // the brief so a generation can be traced to the consultation it came from.
    console.log(
      '[POST /api/generate] context',
      JSON.stringify({
        salespersonId: session.sub,
        customerId: customer?.id ?? null,
        architectId: customer?.architectId ?? null,
      }),
    )
    console.log('[POST /api/generate] brief', JSON.stringify(brief))

    const startedAt = Date.now()
    const result = await withTimeout(
      generateVisualization({
        brief,
        highlighterTileImage: tiles.highlighterTileImage,
        plainTileImage: tiles.plainTileImage,
        // A correction joins its parent's consultation.
        generationId: correction?.generationId,
        // No new model call may start once this route has stopped waiting.
        deadlineMs: startedAt + INTERNAL_BUDGET_MS,
      }),
      INTERNAL_BUDGET_MS,
    )
    // Recorded after the image exists, so a failed attempt never leaves a
    // revision claiming a concept that was never produced.
    // The architect comes from the customer, who is themselves scoped to this
    // salesperson, so the relationship in the record is the real one rather
    // than whatever a request claimed.
    const architect = customer?.architectId
      ? await getArchitect(toOwnerScope(session), customer.architectId)
      : null
    const revision = await recordRevision({
      scope: toOwnerScope(session),
      generationId: result.generationId,
      customerId: customer?.id ?? null,
      parentRevisionId: correction?.parent.id ?? null,
      reasons: (correction?.reasons ?? []).map((reason) => ({ id: reason.id, name: reason.name })),
      note: correction?.note ?? '',
      imageUrl: result.image,
      // Captured now, not rebuilt later: the catalogue can be edited, and a
      // record that re-read today's version would describe a concept nobody
      // ever produced.
      context: {
        salespersonName: session.displayName,
        customerName: customer?.name ?? null,
        architectId: architect?.id ?? customer?.architectId ?? null,
        architectName: architect?.name ?? null,
        // The uncropped photo never reaches this route; it is supplied when
        // the concept is saved, by the only place that has it.
        originalTileImage: null,
        croppedTileImage: result.processedTileUrl ?? null,
        tileSize,
        plainTileProvided: tiles.plainTileProvided,
        plainTileImage: result.plainTileImageUrl ?? null,
        plainTileSize: tiles.plainDimensions ? toSizeId(tiles.plainDimensions) : null,
        highlighterLocation: highlighterLocation.name,
        // The full structured record of what was selected, so a concept can be
        // inspected later exactly as it was asked for.
        brief,
        space: resolved.path[0]?.name ?? (typeof space === 'string' ? space : null),
        spacePath: resolved.path.map((node) => ({ id: node.id, name: node.name })),
        jointName: jointOption?.name ?? null,
        jointWidthMm: joint ?? null,
        patternName: pattern?.name ?? null,
        additionalRequirement: requirement ?? null,
      },
    }).catch((error: unknown) => {
      // History must never be the reason a salesperson loses a concept they
      // have already paid for.
      console.error('[POST /api/generate] could not record the revision:', error)
      return null
    })
    // `historyRecorded` lets the caller tell "the image was made" from "the
    // image was made and logged" — the log is what the admin history reads.
    const payload = JSON.stringify({ ...result, revision, historyRecorded: revision !== null })
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
    // A database that cannot be reached is not a generation failure, and saying
    // so as a 502 sends the admin looking in the wrong place.
    const failure = asDbError(error) ?? error
    const status =
      failure instanceof SpaceNodesError ||
      failure instanceof DesignOptionsError ||
      failure instanceof GenerateRequestError ||
      failure instanceof DbError
        ? failure.status
        : failure instanceof GenerationError
          ? failure.status
          : 502
    // Only errors this code raised are safe to repeat back: a driver or SDK
    // message can carry a host, a key fragment or a stack.
    const message =
      failure instanceof SpaceNodesError ||
      failure instanceof DesignOptionsError ||
      failure instanceof GenerateRequestError ||
      failure instanceof DbError ||
      failure instanceof GenerationError
        ? failure.message
        : 'We could not create your concept. Please try again.'
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
