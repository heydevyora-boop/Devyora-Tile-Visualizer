import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GenerationError, generateVisualization } from './_lib/generateVisualization'

// A real 3-concept generation takes roughly 15-25s. Vercel's default function
// timeout is 10s, which would abort every request before Gemini answers.
export const maxDuration = 60

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  // Vercel parses JSON bodies automatically, but be defensive about a body
  // that arrived as a raw string (e.g. an unexpected content-type).
  let body: Record<string, unknown> = {}
  if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body)
    } catch {
      res.status(400).json({ error: 'Request body was not valid JSON.' })
      return
    }
  } else if (req.body && typeof req.body === 'object') {
    body = req.body as Record<string, unknown>
  }

  const { tileImage, space, style, tileSize } = body as {
    tileImage?: string
    space?: string
    style?: string
    tileSize?: string
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

  try {
    const result = await generateVisualization({
      tileImage: tileImage as string,
      space: space as string,
      style: style as string,
      tileSize,
    })
    res.status(200).json(result)
  } catch (error) {
    // Generation failures must return JSON, never an unhandled crash.
    const status = error instanceof GenerationError ? error.status : 502
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'We could not create your concepts. Please try again.'
    console.error('[POST /api/generate] generation failed:', error)
    res.status(status).json({ error: message })
  }
}
