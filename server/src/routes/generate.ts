import { Router } from 'express'
import { generateVisualization } from '../services/generateVisualization'

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

  const result = await generateVisualization({ tileImage, space, style, tileSize })
  res.json(result)
})

export default router
