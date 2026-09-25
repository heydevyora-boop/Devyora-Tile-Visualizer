import { getSpaceConfig, type SpaceConfig } from '../config/spaces'
import { getStyleConfig, resolveStyleValue, type StyleConfig } from '../config/styles'

export interface PromptInput {
  space: string
  /** May be "surprise" — resolved to a concrete style before prompts are built. */
  style: string
  tileSize?: string
}

export interface BuiltPrompt {
  /** 1-based index of the concept this prompt produces. */
  conceptIndex: number
  /** The variation focus this prompt is built around. */
  focus: string
  /** The full text prompt sent to the image model alongside the tile photo. */
  text: string
  /**
   * The concrete style id actually used for this prompt. Equal to the input
   * style unless the input was "surprise", in which case this is the style
   * that was randomly picked.
   */
  resolvedStyle: string
}

/**
 * Sent as the model's system instruction on every generation call.
 *
 * Holds everything that is identical for all three concepts: the visualiser's
 * role, the tile-preservation rules that keep the render faithful to the
 * salesperson's physical tile, and the output constraints. Per-request detail
 * (space, style, tile size, concept focus) goes in the prompt text instead.
 *
 * This is backend-only. It must never be returned to the client.
 */
export const SYSTEM_INSTRUCTION = [
  'You are an architectural visualizer for Devyora, a premium architectural',
  "materials showroom. You produce client-facing, photorealistic concept images",
  "showing a customer's physical tile installed in a real interior space.",
  '',
  'With every request you receive a photograph of a real, physical tile. That',
  'photograph is the design reference for the image you produce.',
  '',
  'TILE ISOLATION — read this before anything else:',
  'The photograph has been cropped by hand to the one tile the customer chose.',
  'Treat the dominant tile surface in it as the single design reference.',
  'A hand-held crop is rarely perfectly clean, so the frame may still contain',
  'a sliver of a neighbouring tile, a wall, a floor, packaging, a box edge,',
  'fingers holding the tile, or the surface it is resting on. None of that is',
  'the reference.',
  'a. Take the colour, pattern, texture and finish from the main tile only.',
  'b. Ignore anything else in the frame. Do not read a partial tile at the',
  '   edge as a second design, and never blend two designs into one.',
  'c. Produce exactly one tile design and use it throughout the room. The',
  '   floor and any tiled wall show that same tile, not a mixture.',
  'd. Never render a hand, packaging, a label or the background surface from',
  '   the photograph into the generated room.',
  'e. If the frame is ambiguous, commit to the tile occupying the most area',
  '   and at the centre of the crop, rather than averaging what you see.',
  '',
  'TILE PRESERVATION — these take priority over any stylistic instruction:',
  "1. Preserve the supplied tile's visual identity: its dominant colours,",
  '   pattern, texture, grain direction and visible finish characteristics.',
  '2. Do not invent a substantially different tile. Do not substitute it for',
  '   another material or turn it into a different product.',
  '3. Apply the tile naturally to architectural surfaces, with realistic',
  '   repetition across the surface.',
  '4. Do not stretch, squash, skew or warp the tile. Keep its true proportions.',
  '5. Render the tile at a realistic scale relative to the room, its fixtures',
  '   and human-scale elements.',
  '6. Lay the tiles in correct, consistent perspective. Joint lines must stay',
  '   straight and converge correctly with the room geometry.',
  '7. Include plausible, evenly spaced grout joints in a colour that suits the',
  '   tile — never exaggerated or cartoonish.',
  '8. Respect real lighting physics: reflections, sheen and shadows must match',
  '   the finish visible in the photograph and the lighting of the scene.',
  '9. The result must read as a physically believable installation, not a',
  '   texture pasted onto a surface.',
  '',
  'ARCHITECTURAL REALISM:',
  'Prioritise architectural realism — correct proportions, realistic fixtures',
  'and furniture appropriate to the space, realistic lighting — while keeping',
  'the supplied tile as the design reference.',
  '',
  'OUTPUT:',
  'A single photorealistic architectural interior photograph. No text, no',
  'watermarks, no labels, no collage, no people looking at the camera.',
  '',
  'Each request produces one of three concepts shown side by side to a customer,',
  'so each must be visibly distinct from the other two in framing and in how the',
  'tile is applied.',
].join('\n')

function describeStyle(style: StyleConfig | undefined, rawStyle: string): string {
  if (!style) {
    return `Design style: ${rawStyle}.`
  }
  return [
    `Design style: ${style.label} — ${style.description}.`,
    `Style cues to express in the surrounding architecture, furniture, materials and lighting: ${style.keywords.join(', ')}.`,
  ].join('\n')
}

function describeSpace(space: SpaceConfig | undefined, rawSpace: string): string {
  if (!space) {
    return `Space: ${rawSpace}. Apply the tile to the surfaces where it would realistically be used in this kind of space.`
  }
  return [
    `Space: ${space.label}.`,
    `In this space the tile may be applied to: ${space.surfaces.join(', ')}. Do not apply it to surfaces outside that list.`,
    `Environment: ${space.environment}`,
  ].join('\n')
}

/**
 * Builds the three prompts (one per concept) for a given space/style.
 *
 * Pure function — makes no network calls, so prompts can be printed and
 * reviewed without spending API credits.
 */
export function buildGenerationPrompts(input: PromptInput): BuiltPrompt[] {
  const resolvedStyle = resolveStyleValue(input.style)
  const spaceConfig = getSpaceConfig(input.space)
  const styleConfig = getStyleConfig(resolvedStyle)

  const variations: string[] = spaceConfig
    ? [...spaceConfig.variationStrategy]
    : [
        'Wide establishing view of the space at standing eye level, with the tile as the hero surface.',
        'Closer view emphasising the tile surface texture and joint lines.',
        'Alternative angle of the same space showing the tile across a different surface or viewpoint.',
      ]

  return variations.map((focus, index) => ({
    conceptIndex: index + 1,
    focus,
    resolvedStyle,
    text: [
      'Using the attached photograph of a physical tile, render a photorealistic interior showing that tile installed in the space described below.',
      '',
      describeSpace(spaceConfig, input.space),
      '',
      describeStyle(styleConfig, resolvedStyle),
      '',
      describeTileGeometry(input.tileSize),
      '',
      `CONCEPT ${index + 1} OF 3 — this concept must focus on: ${focus}`,
    ].join('\n'),
  }))
}

/** Greatest common divisor, for reducing a size to its simplest ratio. */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * Turns a physical tile size into instructions the model can lay out.
 *
 * A size is not a caption. It decides how many tiles fit a wall, where the
 * joints fall, which tiles get cut at the edges and how the grid converges in
 * perspective. Stating the millimetres alone left the model free to paint one
 * stretched copy of the photograph across a floor, which is the single most
 * obvious way a concept stops looking like a real installation. So the size is
 * converted here into the geometry it implies, in the model's own terms.
 */
function describeTileGeometry(tileSize: string | undefined): string {
  const match = tileSize?.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i)
  if (!match) {
    return [
      'TILE GEOMETRY:',
      'Lay the tile as a repeating module of consistent, believable size, with',
      'regular grout joints. Never stretch a single tile across a surface.',
    ].join('\n')
  }

  const a = Number(match[1])
  const b = Number(match[2])
  const shortSide = Math.min(a, b)
  const longSide = Math.max(a, b)
  const divisor = gcd(longSide, shortSide) || 1
  const ratio = `${shortSide / divisor}:${longSide / divisor}`

  // How a tile of this size reads in a room, in the terms a fitter would use.
  const character =
    longSide >= 1800
      ? 'a large-format slab: few units cover a wall or floor, joints are sparse and every one is conspicuous'
      : longSide >= 1200
        ? 'a large-format tile: joints are widely spaced and the surface reads as broad, calm planes'
        : longSide >= 600
          ? 'a standard architectural format: an even, clearly readable grid'
          : longSide >= 300
            ? 'a small format: joints are frequent and the grid is visually busy'
            : 'a mosaic-scale format: a dense, fine grid of many small units'

  const shape =
    shortSide === longSide
      ? 'Square. The grid is equal in both directions.'
      : `Rectangular, ${ratio}. The long edge is ${longSide} mm and the short edge ${shortSide} mm; keep that proportion exactly in every tile.`

  return [
    'TILE GEOMETRY — the tile is a physical object of a fixed size:',
    `One tile measures ${a} mm x ${b} mm. ${shape}`,
    `At this size it reads as ${character}.`,
    'Consequences you must render:',
    `- Repetition: cover each tiled surface with whole tiles of this size, repeated. Work out how many fit the wall or floor at ${longSide} mm x ${shortSide} mm and show that many. Never enlarge one tile to fill the surface, and never stretch, squash or skew the photograph to make it fit.`,
    '- Grout: a continuous joint between every pair of tiles, forming a regular grid at exactly those intervals. Joint width consistent everywhere.',
    '- Edges and cuts: where the surface does not divide evenly, cut tiles at the perimeter, at internal corners and around fixtures, exactly as a fitter would.',
    '- Corners: joints meet cleanly; the pattern continues around a corner as two cut tiles, not as one bent tile.',
    '- Alignment: a consistent lay pattern across the whole surface, joints running true.',
    '- Perspective: the grid converges with the room geometry. Tiles further away appear smaller and their joints closer together.',
    '- Scale: judge the tile against the fixtures and any human-scale element in the room. A viewer must be able to tell this tile from one twice its size.',
  ].join('\n')
}

/** Turns a stored tile size id such as "1200x600" into "1200 × 600 mm". */
export function formatTileSize(tileSize: string): string {
  const match = tileSize.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i)
  return match ? `${match[1]} × ${match[2]} mm` : tileSize
}
