import { randomUUID } from 'crypto'
import { GoogleGenAI } from '@google/genai'
import { buildGenerationPrompts } from './buildGenerationPrompt'

export interface GenerateVisualizationInput {
  tileImage: string
  space: string
  style: string
  tileSize?: string
}

export interface GenerateVisualizationResult {
  generationId: string
  images: string[]
  space: string
  style: string
  tileSize: string
}

/**
 * Thrown when generation fails; carries the HTTP status the route should use.
 *
 * `cause` keeps the original SDK/network error. Without it the friendly message
 * replaced the real one and the actual reason (bad key, unknown model, quota)
 * was lost before it reached the logs — which made a failure in production
 * impossible to diagnose from the outside.
 */
export class GenerationError extends Error {
  status: number

  constructor(message: string, status = 502, cause?: unknown) {
    super(message)
    this.name = 'GenerationError'
    this.status = status
    if (cause !== undefined) this.cause = cause
  }
}

// Any image model id the SDK accepts. Overridable without a code change.
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image'

interface ParsedDataUrl {
  data: string
  mimeType: string
}

/**
 * Accepts either a bare base64 string or a full data URL and returns the raw
 * base64 payload plus its mime type.
 */
export function parseTileImage(tileImage: string): ParsedDataUrl {
  const dataUrlMatch = tileImage.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s)
  if (dataUrlMatch) {
    return { mimeType: dataUrlMatch[1], data: dataUrlMatch[2] }
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(tileImage) && tileImage.length > 32) {
    return { mimeType: 'image/jpeg', data: tileImage.replace(/\s/g, '') }
  }
  throw new GenerationError(
    'The tile photo could not be read. Please retake or re-upload the tile photo.',
    400,
  )
}

/** Maps an SDK/network error onto a user-facing message plus HTTP status. */
function toGenerationError(error: unknown): GenerationError {
  if (error instanceof GenerationError) return error

  const raw = error instanceof Error ? error.message : String(error)
  const status =
    typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : undefined
  const haystack = `${status ?? ''} ${raw}`.toLowerCase()

  if (haystack.includes('api key') || haystack.includes('unauthenticated') || status === 401 || status === 403) {
    return new GenerationError(
      'The image service rejected our credentials. Please check the server API key configuration.',
      502,
      error,
    )
  }
  if (status === 429 || haystack.includes('rate limit') || haystack.includes('quota') || haystack.includes('resource_exhausted')) {
    return new GenerationError(
      'The image service is busy right now. Please wait a moment and try again.',
      503,
      error,
    )
  }
  if (haystack.includes('safety') || haystack.includes('blocked') || haystack.includes('policy')) {
    return new GenerationError(
      'The image service declined to generate from this photo. Please try a different tile photo.',
      422,
      error,
    )
  }
  if (haystack.includes('fetch failed') || haystack.includes('econnrefused') || haystack.includes('enotfound') || haystack.includes('timeout')) {
    return new GenerationError(
      'We could not reach the image service. Please check the connection and try again.',
      504,
      error,
    )
  }
  return new GenerationError(
    // Keep the raw message visible: this is the catch-all branch, so it is the
    // one most likely to hide something we have not seen before.
    `We could not create your concepts. (${raw || 'unknown error'})`,
    502,
    error,
  )
}

/**
 * Generates three architectural tile visualizations for the given input.
 *
 * Calls the Gemini image model once per concept, each with a different
 * variation focus taken from the space config, so the three results are
 * genuinely different concepts rather than three near-identical images.
 */
export async function generateVisualization(
  input: GenerateVisualizationInput,
): Promise<GenerateVisualizationResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new GenerationError(
      'Image generation is not configured on the server (missing GEMINI_API_KEY).',
      500,
    )
  }

  const tile = parseTileImage(input.tileImage)
  const prompts = buildGenerationPrompts({
    space: input.space,
    style: input.style,
    tileSize: input.tileSize,
  })

  const ai = new GoogleGenAI({ apiKey })

  let interactions
  try {
    interactions = await Promise.all(
      prompts.map((prompt) =>
        ai.interactions.create({
          model: IMAGE_MODEL,
          input: [
            { type: 'text', text: prompt.text },
            { type: 'image', data: tile.data, mime_type: tile.mimeType },
          ],
        }),
      ),
    )
  } catch (error) {
    throw toGenerationError(error)
  }

  const images = interactions.map((interaction, index) => {
    const image = interaction.output_image
    if (!image?.data) {
      throw new GenerationError(
        `The image service returned no image for concept ${index + 1}. Please try again.`,
        502,
      )
    }
    return `data:${image.mime_type ?? 'image/png'};base64,${image.data}`
  })

  return {
    generationId: randomUUID(),
    images,
    space: input.space,
    // Echo the concrete style actually used, not the literal "surprise"
    // the client may have sent — all three prompts resolve to the same
    // style, so any entry carries it.
    style: prompts[0].resolvedStyle,
    tileSize: input.tileSize ?? '',
  }
}
