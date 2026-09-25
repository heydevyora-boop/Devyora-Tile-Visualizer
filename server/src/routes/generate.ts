import { Router } from 'express'
import { GenerationError, generateVisualization } from '../services/generateVisualization'
import { getSpaceConfig } from '../config/spaces'
import { getStyleConfig, isSurpriseStyle } from '../config/styles'
import { verifyAuthHeader } from '../config/auth'
import { SpaceNodesError, resolveApplicationPath } from '../services/spaceNodesStore'
import {
  DesignOptionsError,
  findActiveOption,
  requireJointWidth,
} from '../services/designOptionsStore'

const router = Router()

router.post('/generate', async (req, res) => {
  // Checked before anything else, and long before the model is called: every
  // generation costs real money. Any signed-in account may generate — this is
  // what the whole showroom tool does — so the role is not checked, only that
  // there is a valid session.
  if (!verifyAuthHeader(req.headers.authorization)) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }

  const {
    tileImage,
    space,
    style,
    tileSize,
    spacePath,
    styleOptionId,
    jointOptionId,
    jointWidthMm,
    patternOptionId,
  } = req.body ?? {}

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

  // Checked before the model is called: an unrecognised space or style would
  // otherwise fall through to a generic prompt and still spend a real
  // generation. "Surprise" is a valid style the backend resolves itself.
  if (!getSpaceConfig(space)) {
    res.status(400).json({ error: 'That space is not one we can visualise. Please pick one from the list.' })
    return
  }
  if (!isSurpriseStyle(style) && !getStyleConfig(style)) {
    res.status(400).json({ error: 'That design style is not one we offer. Please pick one from the list.' })
    return
  }

  try {
    // The browser sends the ids it was shown; the chain is re-checked against
    // the catalogue here, so a stale or hand-edited selection cannot instruct
    // the model with an application the showroom never configured.
    const resolved = spacePath ? await resolveApplicationPath(spacePath) : null
    // The joint width may be one of the showroom's presets or typed in, so it
    // is validated as a measurement either way. The style and pattern are
    // looked up by id, so a disabled or invented option cannot reach the model.
    const joint = jointOptionId
      ? (await findActiveOption('joint', String(jointOptionId)))?.valueMm ?? undefined
      : jointWidthMm !== undefined
        ? requireJointWidth(jointWidthMm)
        : undefined
    const pattern = patternOptionId
      ? await findActiveOption('pattern', String(patternOptionId))
      : null
    const styleOption = styleOptionId
      ? await findActiveOption('style', String(styleOptionId))
      : null
    const result = await generateVisualization({
      tileImage,
      space: resolved?.spaceId ?? space,
      application: resolved?.path.map((node) => ({
        name: node.name,
        description: node.description,
      })),
      style: styleOption?.styleId ?? styleOption?.name ?? style,
      styleDescription: styleOption?.styleId ? undefined : styleOption?.description,
      jointWidthMm: joint,
      layingPattern: pattern ? { name: pattern.name, description: pattern.description } : undefined,
      tileSize,
    })
    res.json(result)
  } catch (error) {
    // Generation failures must not take the server down.
    const status =
      error instanceof SpaceNodesError || error instanceof DesignOptionsError
        ? error.status
        : error instanceof GenerationError
          ? error.status
          : 502
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'We could not create your concepts. Please try again.'
    console.error('[POST /api/generate] generation failed:', error)
    res.status(status).json({ error: message })
  }
})

export default router
