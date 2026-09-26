import { randomUUID } from 'crypto'
import { GoogleGenAI } from '@google/genai'
import { SYSTEM_INSTRUCTION, buildGenerationPrompt } from './buildGenerationPrompt'
import { isGoogleDriveConfigured, uploadImageToDrive } from './googleDrive'
import { IMAGE_ASPECT_RATIO, IMAGE_MODEL, IMAGE_SIZE } from '../config/imageModel'

export interface GenerateVisualizationInput {
  tileImage: string
  space: string
  style: string
  tileSize?: string
  /** The verified application chain, root category first. */
  application?: { name: string; description: string }[]
  jointWidthMm?: number
  layingPattern?: { name: string; description: string }
  styleDescription?: string
  additionalRequirement?: string
  /**
   * Which concept of this consultation to produce, from zero. Each request
   * makes exactly one image; asking again with the next index gives a
   * different viewpoint of the same room.
   */
  conceptIndex?: number
  revisionReasons?: { name: string; description: string }[]
  revisionNote?: string
}

export interface GenerateVisualizationResult {
  generationId: string
  /** The one concept this request produced. */
  image: string
  /** Which concept this is, from zero. */
  conceptIndex: number
  /** The crop exactly as made — a Drive URL, or a base64 fallback. */
  tileImageUrl: string
  /** The processed copy the model saw, when processing changed anything. */
  processedTileUrl?: string
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
    // The raw message stays out of the response on purpose, even here in the
    // catch-all: an SDK error can name the provider, a model, or a host, and
    // this is the one branch that would otherwise say whatever it is handed.
    // It is not lost — `cause` carries it to the server log below.
    'We could not create your concepts. Please try again.',
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
/**
 * Encoding quality for the tile reference. Higher than the transport quality
 * used for finished concepts: this image is what the tile's identity is read
 * from, and 4:4:4 chroma keeps coloured veining from smearing.
 */
const TILE_REFERENCE_QUALITY = 95

/**
 * Prepares the crop for the model without throwing away what makes the tile
 * recognisable.
 *
 * The reference photograph is the only thing standing between a concept and
 * an invented marble, so it is treated gently: resized only when it is larger
 * than the model can use, never enlarged, aspect ratio untouched, and encoded
 * at a quality high enough that grain and veining survive. A heavily
 * compressed reference reads as a smoother, blanker stone, and the render
 * follows the reference.
 *
 * Orientation is normalised from EXIF, because a phone held sideways records
 * the rotation as a tag rather than in the pixels — left unapplied, the model
 * sees the tile on its side. Metadata is dropped in the same pass: it is
 * nothing the model uses, and a photograph taken in a showroom can carry a
 * GPS location.
 */
async function prepareTileReference(tile: ParsedDataUrl): Promise<ParsedDataUrl> {
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
    const needsResize = longestEdge > MAX_INPUT_EDGE
    const needsRotation = Boolean(metadata.orientation && metadata.orientation !== 1)

    // Already the right way up and small enough: re-encoding would only cost
    // detail for nothing.
    if (!needsResize && !needsRotation) return tile

    let pipeline = sharp(input).rotate() // no argument: applies the EXIF tag
    if (needsResize) {
      pipeline = pipeline.resize({
        width: MAX_INPUT_EDGE,
        height: MAX_INPUT_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3',
      })
    }
    const prepared = await pipeline
      .jpeg({ quality: TILE_REFERENCE_QUALITY, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer()

    console.log(
      '[generateVisualization] tile reference prepared',
      JSON.stringify({
        from: `${metadata.width}x${metadata.height}`,
        resized: needsResize,
        reoriented: needsRotation,
        kb: Math.round(prepared.length / 1024),
      }),
    )
    return { data: prepared.toString('base64'), mimeType: 'image/jpeg' }
  } catch (error) {
    console.warn(
      '[generateVisualization] could not prepare the tile reference, sending it as supplied:',
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
    // Names nothing about what is missing or which service it configures —
    // that belongs in the runtime log, not on a showroom screen.
    throw new GenerationError('This feature is temporarily unavailable. Please contact the team.', 503)
  }

  // Both are kept: the crop exactly as the salesperson made it, and the
  // processed copy the model is actually shown.
  const original = parseTileImage(input.tileImage)
  const tile = await prepareTileReference(original)
  const conceptIndex = Math.max(0, Math.trunc(input.conceptIndex ?? 0))
  const prompt = buildGenerationPrompt({
    space: input.space,
    application: input.application,
    jointWidthMm: input.jointWidthMm,
    layingPattern: input.layingPattern,
    styleDescription: input.styleDescription,
    additionalRequirement: input.additionalRequirement,
    revisionReasons: input.revisionReasons,
    revisionNote: input.revisionNote,
    style: input.style,
    tileSize: input.tileSize,
  }, conceptIndex)
  // Generated up front so it can name the Drive files below, and reused
  // as-is on the returned result rather than generating a second, different id.
  const generationId = randomUUID()

  const ai = new GoogleGenAI({ apiKey })

  // Exactly one request, for exactly the concept asked for. Nothing is
  // generated alongside it and discarded: every call here is billed, and a
  // consultation only ever shows what the salesperson asked to see.
  let interaction
  try {
    interaction = await withRetry(
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
      conceptIndex,
    )
  } catch (error) {
    throw toGenerationError(error)
  }

  console.log(
    `[generateVisualization] concept ${conceptIndex + 1} usage`,
    JSON.stringify({
      model: IMAGE_MODEL,
      interactionId: interaction.id,
      usage: (interaction as { usage?: unknown }).usage,
    }),
  )

  const output = interaction.output_image
  if (!output?.data) {
    throw new GenerationError(
      'The image service returned no image. Please try again.',
      502,
    )
  }

  const compressed = await compressForTransport([
    { data: output.data, mimeType: output.mime_type ?? 'image/png' },
  ])

  // Two separate destination folders: concepts and tile sources are uploaded
  // to different Drive folders, so each keeps its own env var.
  const generatedFolderId = process.env.GOOGLE_DRIVE_GENERATED_FOLDER_ID
  const cropFolderId = process.env.GOOGLE_DRIVE_CROP_FOLDER_ID

  // Both tile references are kept: the crop exactly as the salesperson made
  // it, and the processed copy the model actually saw. When a concept is
  // questioned later, the two together show whether the tile or the
  // processing was at fault.
  const [image, tileImageUrl, processedTileUrl] = await Promise.all([
    uploadOrFallback(
      compressed[0].buffer,
      compressed[0].mimeType,
      `${generationId}-concept-${conceptIndex + 1}.${extensionFor(compressed[0].mimeType)}`,
      `concept ${conceptIndex + 1}`,
      generatedFolderId,
    ),
    uploadOrFallback(
      Buffer.from(original.data, 'base64'),
      original.mimeType,
      `${generationId}-tile-source.${extensionFor(original.mimeType)}`,
      'tile source',
      cropFolderId,
    ),
    tile.data === original.data
      ? Promise.resolve<string | undefined>(undefined)
      : uploadOrFallback(
          Buffer.from(tile.data, 'base64'),
          tile.mimeType,
          `${generationId}-tile-processed.${extensionFor(tile.mimeType)}`,
          'processed tile reference',
          cropFolderId,
        ),
  ])

  return {
    generationId,
    conceptIndex,
    image,
    tileImageUrl,
    processedTileUrl,
    space: input.space,
    // Echo the concrete style actually used, not the literal "surprise"
    // the client may have sent.
    style: prompt.resolvedStyle,
    tileSize: input.tileSize ?? '',
  }
}
