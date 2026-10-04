import type { Customer, DesignOption, SpaceNode } from './api'
import { buildApplicationMap } from './applicationMap'
import { parseTileSizeId } from './tileSizeLabel'

/** Everything the generate request is built from — the flow's own state. */
export interface GenerateRequestState {
  customer: Customer | null
  highlighterTileImage: string | null
  plainTileImage: string | null
  plainTileProvided: boolean | null
  tileSize: string | null
  space: string | null
  spacePath: SpaceNode[]
  highlighterLocationOption: DesignOption | null
  jointWidthMm: number | null
  jointOption: DesignOption | null
  patternOption: DesignOption | null
  additionalRequirement: string
}

/**
 * The body of POST /api/generate.
 *
 * Built in one place because it is sent from two: the first generation, and
 * every "another concept" after it. Two hand-written copies would drift the
 * moment the contract changed.
 *
 * Every part of the brief travels as its own structured field — the two tiles,
 * their sizes as numbers, the application as ids plus the structured map, the
 * highlighter location, joint and pattern as ids or millimetres, and the
 * free-text instructions on their own. Nothing is folded into a sentence here;
 * turning choices into prose is the backend's job, after it has verified them.
 *
 * Throws an Error whose message is safe to show, when the flow is incomplete,
 * so an unfinished consultation is stopped before a billed request is made.
 */
export function buildGenerateRequest(state: GenerateRequestState): Record<string, unknown> {
  if (!state.highlighterTileImage) {
    throw new Error(
      'No highlighter tile photo was found. Please go back and add the highlighter tile.',
    )
  }
  // The plain tile is an explicit decision: a photo, or "No Plain Tile". An
  // undecided one is refused here rather than sent as if it were the same thing
  // as having none.
  if (
    state.plainTileProvided === null ||
    (state.plainTileProvided && !state.plainTileImage)
  ) {
    throw new Error(
      'The plain tile has not been set. Please go back and add a plain tile, or choose No Plain Tile.',
    )
  }
  const dimensions = parseTileSizeId(state.tileSize)
  if (!dimensions) {
    throw new Error('The tile size has not been set. Please go back and choose a tile size.')
  }
  if (!state.highlighterLocationOption) {
    throw new Error(
      'The highlighter location has not been chosen. Please go back and choose where it is used.',
    )
  }

  return {
    // Two separate references — never merged into one image field.
    highlighterTileImage: state.highlighterTileImage,
    plainTileImage: state.plainTileProvided ? state.plainTileImage : null,
    plainTileProvided: state.plainTileProvided,
    // Each tile carries its own size. The showroom picks one common size today,
    // so both are given the same numbers; the shape does not assume they match,
    // so asking for two sizes later changes this one line and nothing else.
    tileDimensions: {
      highlighter: dimensions,
      plain: state.plainTileProvided ? dimensions : null,
    },
    space: state.space,
    // The ids of the chosen application, re-checked server-side.
    spacePath: state.spacePath.map((node) => node.id),
    // The same structured map the server independently derives from its own
    // re-resolved path — sent so the request itself carries the explicit
    // application as data, not only as ids the server has to look up.
    applicationMap: state.spacePath.length ? buildApplicationMap(state.spacePath) : undefined,
    highlighterLocationOptionId: state.highlighterLocationOption.id,
    // An id where the option came from the showroom's list, so the server
    // verifies it; the millimetres only when typed in.
    jointOptionId: state.jointOption?.id,
    jointWidthMm: state.jointOption ? undefined : state.jointWidthMm ?? undefined,
    patternOptionId: state.patternOption?.id,
    // Who this is for. The server resolves the architect from the customer and
    // takes the salesperson from the session, so neither is sent from here.
    customerId: state.customer?.id,
    // Free text, on its own — never merged into any other field.
    additionalRequirement: state.additionalRequirement.trim() || undefined,
  }
}
