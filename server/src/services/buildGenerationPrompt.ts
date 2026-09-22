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
  const tileSizeLabel = input.tileSize ? formatTileSize(input.tileSize) : 'the size specified by the showroom'

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
      `Tile real-world size: ${tileSizeLabel}. The number of tiles visible must be consistent with that size relative to the room, fixtures and any human-scale elements.`,
      '',
      `CONCEPT ${index + 1} OF 3 — this concept must focus on: ${focus}`,
    ].join('\n'),
  }))
}

/** Turns a stored tile size id such as "1200x600" into "1200 × 600 mm". */
export function formatTileSize(tileSize: string): string {
  const match = tileSize.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i)
  return match ? `${match[1]} × ${match[2]} mm` : tileSize
}
