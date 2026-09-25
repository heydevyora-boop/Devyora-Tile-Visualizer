// Deployed copy of the rule engine used by the Vercel serverless function in
// client/api/. Vercel only uploads files under the project Root Directory
// (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/.
import { randomUUID } from 'node:crypto'
import { GoogleGenAI } from '@google/genai'
import { SYSTEM_INSTRUCTION, buildGenerationPrompts } from './buildGenerationPrompt.js'
import { isGoogleDriveConfigured, uploadImageToDrive } from './googleDrive.js'
import { IMAGE_ASPECT_RATIO, IMAGE_MODEL, IMAGE_SIZE } from './imageModel.js'

export interface GenerateVisualizationInput {
  tileImage: string
  space: string
  style: string
  tileSize?: string
  /** The verified application chain, root category first. */
  application?: { name: string; description: string }[]
}

export interface GenerateVisualizationResult {
  generationId: string
  images: string[]
  /** The uploaded tile photo — a Drive URL, or a base64 fallback. See uploadOrFallback. */
  tileImageUrl: string
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

  // Checked first, and by exact status only: the body of a 402 can mention
  // "quota", which the rate-limit branch below would otherwise swallow into
  // the "busy right now" message. Deliberately says nothing about why — the
  // user is never told which service is involved or what it costs.
  if (status === 402) {
    return new GenerationError(
      'This feature is temporarily unavailable. Please contact the team.',
      503,
      error,
    )
  }
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

function statusOf(error: unknown): number | undefined {
  return typeof (error as { status?: unknown })?.status === 'number'
    ? (error as { status: number }).status
    : undefined
}

/** Max retry attempts for a transient (429/503) failure, plus the initial try. */
const MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 500

/**
 * Retries a single interactions.create call with exponential backoff on 429
 * (rate limited) and 503 (overloaded) — both transient and worth a couple of
 * retries before giving up. Any other error fails immediately.
 *
 * Takes a thunk rather than the call's params so the create() call at the
 * call site keeps its normal (non-streaming) overload resolution.
 */
async function withRetry<T>(call: () => Promise<T>, conceptIndex: number): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call()
    } catch (error) {
      const status = statusOf(error)
      const retryable = status === 429 || status === 503
      if (!retryable || attempt >= MAX_RETRIES) throw error
      const delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt
      console.warn(
        `[generateVisualization] concept ${conceptIndex + 1}: got ${status}, retrying in ${delayMs}ms ` +
          `(attempt ${attempt + 1}/${MAX_RETRIES})`,
      )
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

/**
 * Longest edge sent to the model. The client already exports crops capped at
 * 1400px, but this is a safety net for any other caller: past this size the
 * extra pixels cost input tokens without adding visible tile detail.
 */
const MAX_INPUT_EDGE = 1536

/** Downscales the tile photo before it is sent, if it is larger than needed. */
async function downscaleForInput(tile: ParsedDataUrl): Promise<ParsedDataUrl> {
  let sharp: (typeof import('sharp'))['default']
  try {
    sharp = (await import('sharp')).default
  } catch (error) {
    console.warn(
      '[generateVisualization] sharp unavailable, sending tile photo at original size:',
      error instanceof Error ? error.message : error,
    )
    return tile
  }

  const input = Buffer.from(tile.data, 'base64')
  try {
    const metadata = await sharp(input).metadata()
    const longestEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0)
    if (longestEdge <= MAX_INPUT_EDGE) return tile

    const resized = await sharp(input)
      .resize({ width: MAX_INPUT_EDGE, height: MAX_INPUT_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer()
    console.log(
      `[generateVisualization] tile photo downscaled: ${metadata.width}x${metadata.height} ` +
        `(${(input.length / 1024).toFixed(0)}KB) -> max edge ${MAX_INPUT_EDGE} (${(resized.length / 1024).toFixed(0)}KB)`,
    )
    return { data: resized.toString('base64'), mimeType: 'image/jpeg' }
  } catch (error) {
    console.warn(
      '[generateVisualization] could not downscale tile photo, sending original:',
      error instanceof Error ? error.message : error,
    )
    return tile
  }
}

/**
 * JPEG quality for the returned concepts. 90 keeps them presentation-grade
 * while cutting the payload by roughly 75%.
 */
const TRANSPORT_JPEG_QUALITY = Number(process.env.GENERATED_IMAGE_QUALITY ?? 90)

interface CompressedImage {
  buffer: Buffer
  mimeType: string
}

/**
 * Re-encodes the model's output as JPEG.
 *
 * Gemini returns lossless PNG. A photographic 1024x1024 render is 1.5-3MB as
 * PNG. JPEG at quality 90 brings that to roughly 300-500KB, which matters
 * regardless of where the bytes end up next: smaller Drive uploads, and a
 * smaller base64 fallback on the rare request where Drive upload fails (see
 * uploadOrFallback below) — a Vercel serverless function may only return
 * 4.5MB, and three uncompressed PNGs as base64 alone would exceed that.
 *
 * Fails open on purpose. If sharp cannot load, returning the original bytes
 * is better than failing a generation the user has already paid for — and the
 * log line says which path was taken.
 */
async function compressForTransport(
  raw: Array<{ data: string; mimeType: string }>,
): Promise<CompressedImage[]> {
  let sharp: (typeof import('sharp'))['default']
  try {
    sharp = (await import('sharp')).default
  } catch (error) {
    console.warn(
      '[generateVisualization] sharp unavailable, using original images:',
      error instanceof Error ? error.message : error,
    )
    return raw.map((image) => ({ buffer: Buffer.from(image.data, 'base64'), mimeType: image.mimeType }))
  }

  return Promise.all(
    raw.map(async (image, index) => {
      const input = Buffer.from(image.data, 'base64')
      try {
        const jpeg = await sharp(input)
          .jpeg({ quality: TRANSPORT_JPEG_QUALITY, mozjpeg: true })
          .toBuffer()
        console.log(
          `[generateVisualization] concept ${index + 1}: ` +
            `${(input.length / 1024).toFixed(0)}KB ${image.mimeType} -> ` +
            `${(jpeg.length / 1024).toFixed(0)}KB jpeg`,
        )
        return { buffer: jpeg, mimeType: 'image/jpeg' }
      } catch (error) {
        console.warn(
          `[generateVisualization] could not compress concept ${index + 1}, using original:`,
          error instanceof Error ? error.message : error,
        )
        return { buffer: input, mimeType: image.mimeType }
      }
    }),
  )
}

/** File extension matching a mime type, for Drive file names. */
function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'bin'
  }
}

/**
 * Uploads one image to the given Google Drive folder and returns its
 * shareable URL. Falls back to a base64 data URL of the same bytes if Drive
 * is not configured, the folder id is missing, or the upload fails for any
 * reason (bad credentials, quota, network) — the user has already paid for
 * this generation, so losing the image outright is worse than serving it
 * inline instead of from Drive.
 */
async function uploadOrFallback(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  label: string,
  folderId: string | undefined,
): Promise<string> {
  if (!isGoogleDriveConfigured() || !folderId) {
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  }
  try {
    const url = await uploadImageToDrive(buffer.toString('base64'), fileName, mimeType, folderId)
    console.log(`[generateVisualization] ${label} uploaded to Drive: ${fileName}`)
    return url
  } catch (error) {
    console.warn(
      `[generateVisualization] Drive upload failed for ${label}, falling back to inline image:`,
      error instanceof Error ? error.message : error,
    )
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  }
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

  const tile = await downscaleForInput(parseTileImage(input.tileImage))
  const prompts = buildGenerationPrompts({
    space: input.space,
    application: input.application,
    style: input.style,
    tileSize: input.tileSize,
  })
  // Generated up front so it can name the Drive files below, and reused
  // as-is on the returned result rather than generating a second, different id.
  const generationId = randomUUID()

  const ai = new GoogleGenAI({ apiKey })

  let interactions
  try {
    interactions = await Promise.all(
      prompts.map((prompt, index) =>
        withRetry(
          () =>
            ai.interactions.create({
              model: IMAGE_MODEL,
              system_instruction: SYSTEM_INSTRUCTION,
              input: [
                { type: 'text', text: prompt.text },
                { type: 'image', data: tile.data, mime_type: tile.mimeType },
              ],
              response_modalities: ['text', 'image'],
              generation_config: {
                image_config: {
                  aspect_ratio: IMAGE_ASPECT_RATIO,
                  image_size: IMAGE_SIZE,
                },
              },
            }),
          index,
        ),
      ),
    )
  } catch (error) {
    throw toGenerationError(error)
  }

  interactions.forEach((interaction, index) => {
    console.log(
      `[generateVisualization] concept ${index + 1} usage`,
      JSON.stringify({
        model: IMAGE_MODEL,
        interactionId: interaction.id,
        usage: (interaction as { usage?: unknown }).usage,
      }),
    )
  })

  const rawImages = interactions.map((interaction, index) => {
    const image = interaction.output_image
    if (!image?.data) {
      throw new GenerationError(
        `The image service returned no image for concept ${index + 1}. Please try again.`,
        502,
      )
    }
    return { data: image.data, mimeType: image.mime_type ?? 'image/png' }
  })

  const compressed = await compressForTransport(rawImages)

  // Two separate destination folders: concepts and tile sources are uploaded
  // to different Drive folders, so each keeps its own env var.
  const generatedFolderId = process.env.GOOGLE_DRIVE_GENERATED_FOLDER_ID
  const cropFolderId = process.env.GOOGLE_DRIVE_CROP_FOLDER_ID

  const [images, tileImageUrl] = await Promise.all([
    Promise.all(
      compressed.map((image, index) =>
        uploadOrFallback(
          image.buffer,
          image.mimeType,
          `${generationId}-concept-${index + 1}.${extensionFor(image.mimeType)}`,
          `concept ${index + 1}`,
          generatedFolderId,
        ),
      ),
    ),
    uploadOrFallback(
      Buffer.from(tile.data, 'base64'),
      tile.mimeType,
      `${generationId}-tile-source.${extensionFor(tile.mimeType)}`,
      'tile source',
      cropFolderId,
    ),
  ])

  return {
    generationId,
    images,
    tileImageUrl,
    space: input.space,
    // Echo the concrete style actually used, not the literal "surprise"
    // the client may have sent — all three prompts resolve to the same
    // style, so any entry carries it.
    style: prompts[0].resolvedStyle,
    tileSize: input.tileSize ?? '',
  }
}
