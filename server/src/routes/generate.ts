import { Router } from 'express'
import { GenerationError, generateVisualization } from '../services/generateVisualization'

const router = Router()

router.post('/generate', async (req, res) => {
  const { tileImage, space, style, tileSize } = req.body ?? {}

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

  try {
    const result = await generateVisualization({ tileImage, space, style, tileSize })
    res.json(result)
  } catch (error) {
    // Generation failures must not take the server down.
    const status = error instanceof GenerationError ? error.status : 502
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'We could not create your concepts. Please try again.'
    console.error('[POST /api/generate] generation failed:', error)
    res.status(status).json({ error: message })
  }
})

export default router
