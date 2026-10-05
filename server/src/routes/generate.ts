import { Router } from 'express'
import { GenerationError, generateVisualization } from '../services/generateVisualization'
import { getSpaceConfig } from '../config/spaces'
import { verifyAuthHeader } from '../config/auth'
import { SpaceNodesError, resolveApplicationPath } from '../services/spaceNodesStore'
import {
  DesignOptionsError,
  findActiveOption,
  requireJointWidth,
} from '../services/designOptionsStore'
import { GenerateRequestError, toSizeId, validateTiles } from '../services/generateRequest'
import { buildGenerationBrief } from '../services/generationBrief'
import { assertSelectionsUnchanged, resolveCorrection } from '../services/correctionRequest'
import { getArchitect, getCustomer, toOwnerScope } from '../services/clientsStore'
import { recordRevision } from '../services/revisionsStore'
import { DbError, asDbError } from '../services/db'

const router = Router()

router.post('/generate', async (req, res) => {
  // Checked before anything else, and long before the model is called: every
  // generation costs real money. Any signed-in account may generate — this is
  // what the whole showroom tool does — so the role is not checked, only that
  // there is a valid session.
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return
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
  } = req.body ?? {}

  // The tile part of the request — two separate references, each with its own
  // size as numbers — is checked as a unit first, before anything else is read
  // or looked up, in the same order as the deployed handler in client/api/ so
  // one bad request gets the same answer from both.
  let tiles: ReturnType<typeof validateTiles>
  try {
    tiles = validateTiles(req.body ?? {})
  } catch (error) {
    const known = error instanceof GenerateRequestError
    res.status(known ? error.status : 400).json({
      error: known ? error.message : 'The tile details could not be read.',
    })
    return
  }
  // The size the prompt's geometry description reads. Built here from the
  // numbers, so the text is never the source of truth for the size.
  const tileSize = toSizeId(tiles.highlighterDimensions)

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
  if (!getSpaceConfig(space)) {
    res.status(400).json({ error: 'That space is not one we can visualise. Please pick one from the list.' })
    return
  }

  try {
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

    const result = await generateVisualization({
      brief,
      highlighterTileImage: tiles.highlighterTileImage,
      plainTileImage: tiles.plainTileImage,
      // A correction joins its parent's consultation.
      generationId: correction?.generationId,
    })
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
        // A design style is no longer part of the flow. The field stays on the
        // record so concepts made before this change still read correctly.
        styleName: null,
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
    res.json({ ...result, revision })
  } catch (error) {
    // Generation failures must not take the server down.
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
        : 'We could not create your concepts. Please try again.'
    console.error('[POST /api/generate] generation failed:', error)
    res.status(status).json({ error: message })
  }
})

export default router
