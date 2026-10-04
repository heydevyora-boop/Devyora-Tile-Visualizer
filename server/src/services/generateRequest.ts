// Local-development copy of the request validator, used by the Express server in
// server/. The deployed copy in client/api/_lib/ must stay identical.
// KEEP IN SYNC with client/api/_lib/generateRequest.ts.

/** A tile's physical size. Millimetres are the only unit used anywhere. */
export interface TileDimensions {
  lengthMm: number
  breadthMm: number
}

/**
 * The tile part of a generation request, after validation.
 *
 * The highlighter and the plain tile are two separate references and are never
 * merged. Each carries its own dimensions: today's showroom flow picks one
 * common size, so both are given the same numbers, but nothing here assumes two
 * different tile products measure the same, so a screen that asks for them
 * separately needs no change to the request or the backend.
 */
export interface ValidatedTiles {
  highlighterTileImage: string
  /** Null when there is no plain tile — whether or not that was a deliberate choice. */
  plainTileImage: string | null
  /** True for a supplied plain tile; false only for an explicit "No Plain Tile". */
  plainTileProvided: boolean
  highlighterDimensions: TileDimensions
  /** Null exactly when there is no plain tile. */
  plainDimensions: TileDimensions | null
}

/** Thrown for a request the caller got wrong; carries the HTTP status. */
export class GenerateRequestError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'GenerateRequestError'
    this.status = status
  }
}

/** The limits the tile-size screen already enforces, repeated here because the browser is not trusted. */
const MIN_EDGE_MM = 10
const MAX_EDGE_MM = 4000

function requireEdge(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN_EDGE_MM || value > MAX_EDGE_MM) {
    throw new GenerateRequestError(
      `${label} must be a whole number of millimetres between ${MIN_EDGE_MM} and ${MAX_EDGE_MM}.`,
    )
  }
  return value
}

/**
 * Reads one tile's dimensions. Strictly numeric: a string such as "1200x600"
 * is refused rather than parsed, because the whole point of this field is that
 * the size reaches the backend as numbers and not as a sentence.
 */
export function parseDimensions(value: unknown, label: string): TileDimensions {
  if (!value || typeof value !== 'object') {
    throw new GenerateRequestError(`The ${label} size is required, as lengthMm and breadthMm.`)
  }
  const { lengthMm, breadthMm } = value as { lengthMm?: unknown; breadthMm?: unknown }
  return {
    lengthMm: requireEdge(lengthMm, `The ${label} length`),
    breadthMm: requireEdge(breadthMm, `The ${label} breadth`),
  }
}

/** "1200x600" — the id the prompt's size description already understands. */
export function toSizeId(dimensions: TileDimensions): string {
  return `${dimensions.lengthMm}x${dimensions.breadthMm}`
}

/**
 * Validates the tile inputs of a generation request.
 *
 * "No Plain Tile" is an explicit decision, so `plainTileProvided` must be a
 * real boolean and must agree with the image: a photo alongside "No Plain
 * Tile", or "provided" with no photo, is a contradictory request and is
 * refused rather than guessed at. Nothing here ever turns an absent plain tile
 * into the highlighter, or the reverse.
 */
export function validateTiles(body: Record<string, unknown>): ValidatedTiles {
  const { highlighterTileImage, plainTileImage, plainTileProvided, tileDimensions } = body as {
    highlighterTileImage?: unknown
    plainTileImage?: unknown
    plainTileProvided?: unknown
    tileDimensions?: { highlighter?: unknown; plain?: unknown } | null
  }

  const missing: string[] = []
  if (typeof highlighterTileImage !== 'string' || !highlighterTileImage) {
    missing.push('highlighterTileImage')
  }
  if (typeof plainTileProvided !== 'boolean') missing.push('plainTileProvided')
  if (!tileDimensions || typeof tileDimensions !== 'object') missing.push('tileDimensions')
  if (missing.length > 0) {
    throw new GenerateRequestError(`Missing required field(s): ${missing.join(', ')}`)
  }

  const plainImage =
    typeof plainTileImage === 'string' && plainTileImage ? plainTileImage : null
  if (plainTileProvided === true && !plainImage) {
    throw new GenerateRequestError('A plain tile photo is required when a plain tile is provided.')
  }
  if (plainTileProvided === false && plainImage) {
    throw new GenerateRequestError(
      'A plain tile photo was sent, but No Plain Tile was selected. Please choose one or the other.',
    )
  }

  const dimensions = tileDimensions as { highlighter?: unknown; plain?: unknown }
  const highlighterDimensions = parseDimensions(dimensions.highlighter, 'highlighter tile')
  // The plain tile's size is required exactly when there is a plain tile, and
  // refused when there is not — a size for a tile that does not exist would be
  // invented data.
  let plainDimensions: TileDimensions | null = null
  if (plainTileProvided === true) {
    plainDimensions = parseDimensions(dimensions.plain, 'plain tile')
  } else if (dimensions.plain !== undefined && dimensions.plain !== null) {
    throw new GenerateRequestError('A plain tile size was sent, but No Plain Tile was selected.')
  }

  return {
    highlighterTileImage: highlighterTileImage as string,
    plainTileImage: plainImage,
    plainTileProvided: plainTileProvided as boolean,
    highlighterDimensions,
    plainDimensions,
  }
}
