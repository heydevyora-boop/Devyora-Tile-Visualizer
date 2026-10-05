import { randomUUID } from 'crypto'
import { GoogleGenAI } from '@google/genai'
import { SYSTEM_INSTRUCTION, buildModelRequest } from './buildGenerationPrompt'
import { isGoogleDriveConfigured, uploadImageToDrive } from './googleDrive'
import { IMAGE_ASPECT_RATIO, IMAGE_MODEL, IMAGE_SIZE } from '../config/imageModel'
import type { GenerationBrief } from './generationBrief'

export interface GenerateVisualizationInput {
  /**
   * What the customer selected, as separate structured values: both tile sizes,
   * the placement, the highlighter location, the joint, the pattern, the
   * instructions and any regeneration reason. Authoritative — the model's input
   * is rendered from this, never the reverse, and nothing about a selection is
   * passed to this service as pre-written prose.
   */
  brief: GenerationBrief
  /** The highlighter photograph. Always required; sent to the model as its own image. */
  highlighterTileImage: string
  /**
   * The plain / base photograph, sent to the model as its own second image.
   * Null exactly when `brief.tiles.plain.provided` is false — the explicit
   * "No Plain Tile" choice, in which case no second image is sent at all.
   */
  plainTileImage: string | null
  /**
   * The consultation this concept belongs to. A correction passes its parent's
   * id so the whole chain shares one; a first concept omits it and gets a new one.
   */
  generationId?: string
  /**
   * Epoch milliseconds after which no new model call may start. The route stops
   * waiting at its own budget, but cannot cancel a call already in flight, so
   * without this a retry could begin after the caller had given up — a billed
   * generation nobody receives.
   */
  deadlineMs?: number
}

export interface GenerateVisualizationResult {
  generationId: string
  /** The one concept this request produced. */
  image: string
  /** Which concept this is, from zero. */
  conceptIndex: number
  /** The highlighter crop exactly as made — a Drive URL, or a base64 fallback. */
  highlighterTileImageUrl: string
  /** The plain crop, same shape. Absent when there was no plain tile. */
  plainTileImageUrl?: string
  /** The processed copy of the highlighter the model saw, when processing changed anything. */
  processedTileUrl?: string
  space: string
  tileSize: string
  plainTileProvided: boolean
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
export function parseTileImage(tileImage: string, label = 'tile photo'): ParsedDataUrl {
  const dataUrlMatch = tileImage.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s)
  if (dataUrlMatch) {
    return { mimeType: dataUrlMatch[1], data: dataUrlMatch[2] }
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(tileImage) && tileImage.length > 32) {
    return { mimeType: 'image/jpeg', data: tileImage.replace(/\s/g, '') }
  }
  throw new GenerationError(
    `The ${label} could not be read. Please retake or re-upload the ${label}.`,
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
  if (status === 429 || status === 503 || haystack.includes('rate limit') || haystack.includes('quota') || haystack.includes('resource_exhausted')) {
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
    'We could not create your concept. Please try again.',
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
async function withRetry<T>(
  call: () => Promise<T>,
  conceptIndex: number,
  deadlineMs: number | undefined,
  counter: { attempts: number },
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    counter.attempts = attempt + 1
    try {
      return await call()
    } catch (error) {
      const status = statusOf(error)
      const retryable = status === 429 || status === 503
      if (!retryable || attempt >= MAX_RETRIES) throw error
      const delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt
      // A retry that would start after the caller has stopped waiting is a
      // billed call nobody can receive, so the original error stands instead.
      if (deadlineMs !== undefined && Date.now() + delayMs >= deadlineMs) {
        console.warn(
          `[generateVisualization] concept ${conceptIndex + 1}: got ${status}, not retrying — out of time`,
        )
        throw error
      }
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
 * Generates ONE architectural tile visualization for the given brief.
 *
 * One request is one model call and one image. Asking for another concept —
 * or a correction of this one — is a new request.
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

  // The photos must agree with the brief about whether a plain tile exists. A
  // mismatch is a bug upstream, and it is refused before anything is billed
  // rather than sent as a request whose structure and images disagree.
  const { brief } = input
  if (brief.tiles.plain.provided !== (input.plainTileImage !== null)) {
    throw new GenerationError(
      'The plain tile photo does not match the plain tile selection. Please go back and set the plain tile again.',
      400,
    )
  }

  // Both are kept: the crop exactly as the salesperson made it, and the
  // processed copy the model is actually shown. Each tile is parsed and
  // processed on its own; the two are never combined.
  const original = parseTileImage(input.highlighterTileImage, 'highlighter tile photo')
  const plainOriginal = input.plainTileImage
    ? parseTileImage(input.plainTileImage, 'plain tile photo')
    : null
  const tile = await prepareTileReference(original)
  const plainTile = plainOriginal ? await prepareTileReference(plainOriginal) : null
  const conceptIndex = brief.concept.index

  // The brief rendered as ordered input: the structured selections, the facts
  // computed from them, and each tile photograph as its own part directly after
  // a label that names it. The system instruction is separate and static.
  const plan = buildModelRequest(brief)
  const references = { highlighter: tile, plain: plainTile }
  const modelInput = plan.parts.map((part) => {
    if (part.kind === 'text') return { type: 'text' as const, text: part.text }
    const reference = references[part.tile]
    if (!reference) throw new GenerationError('A tile photograph was missing from the request.', 400)
    return { type: 'image' as const, data: reference.data, mime_type: reference.mimeType }
  })
  console.log(
    '[generateVisualization] request parts:',
    plan.parts.map((part) => (part.kind === 'text' ? 'text' : `image(${part.tile})`)).join(', '),
  )
  // Generated up front so it can name the Drive files below, and reused
  // as-is on the returned result rather than generating a second, different id.
  const generationId = input.generationId ?? randomUUID()

  const ai = new GoogleGenAI({ apiKey })

  // Exactly one request, for exactly the concept asked for. Nothing is
  // generated alongside it and discarded: every call here is billed, and a
  // consultation only ever shows what the salesperson asked to see.
  let interaction
  const counter = { attempts: 0 }
  try {
    interaction = await withRetry(
      () =>
        ai.interactions.create({
          model: IMAGE_MODEL,
          system_instruction: SYSTEM_INSTRUCTION,
          input: modelInput,
          response_modalities: ['text', 'image'],
          generation_config: {
            image_config: {
              aspect_ratio: IMAGE_ASPECT_RATIO,
              image_size: IMAGE_SIZE,
            },
          },
        }),
      conceptIndex,
      input.deadlineMs,
      counter,
    )
  } catch (error) {
    console.warn(
      `[generateVisualization] concept ${conceptIndex + 1} failed after ${counter.attempts} model call(s)`,
    )
    throw toGenerationError(error)
  }

  console.log(
    `[generateVisualization] concept ${conceptIndex + 1} usage`,
    JSON.stringify({
      model: IMAGE_MODEL,
      interactionId: interaction.id,
      // Every attempt is a billed call; one request normally makes exactly one.
      attempts: counter.attempts,
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
  const [image, highlighterTileImageUrl, processedTileUrl, plainTileImageUrl] = await Promise.all([
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
      `${generationId}-highlighter-tile-source.${extensionFor(original.mimeType)}`,
      'highlighter tile source',
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
    plainOriginal
      ? uploadOrFallback(
          Buffer.from(plainOriginal.data, 'base64'),
          plainOriginal.mimeType,
          `${generationId}-plain-tile-source.${extensionFor(plainOriginal.mimeType)}`,
          'plain tile source',
          cropFolderId,
        )
      : Promise.resolve<string | undefined>(undefined),
  ])

  return {
    generationId,
    conceptIndex,
    image,
    highlighterTileImageUrl,
    plainTileImageUrl,
    processedTileUrl,
    space: brief.placement.space.spaceId ?? brief.placement.space.name,
    tileSize: `${brief.tiles.highlighter.sizeMm.lengthMm}x${brief.tiles.highlighter.sizeMm.breadthMm}`,
    plainTileProvided: brief.tiles.plain.provided,
  }
}
