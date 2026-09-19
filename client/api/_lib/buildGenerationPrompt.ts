// Deployed copy of the rule engine used by the Vercel serverless function in
// client/api/. Vercel only uploads files under the project Root Directory
// (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/.
import { getSpaceConfig, type SpaceConfig } from './spaces'
import { getStyleConfig, resolveStyleValue, type StyleConfig } from './styles'

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
 * Instructions that must hold for every concept. These are the constraints
 * that keep the render faithful to the salesperson's physical tile.
 */
function fidelityRules(tileSizeLabel: string): string {
  return [
    'STRICT FIDELITY RULES — these override any stylistic instruction:',
    '1. The attached photograph is a REAL physical tile. Reproduce that exact tile: its precise colour, tone, veining, pattern, grain direction and surface texture must match the photograph.',
    '2. Do NOT invent, substitute, recolour or restyle the tile. Do not swap it for a similar-looking material. If the tile is beige travertine, every tile in the render is that same beige travertine.',
    '3. Do NOT stretch, squash, skew or warp the tile. Keep its true proportions and repeat it naturally across the surface.',
    `4. Render the tile at its real-world size of ${tileSizeLabel}. The number of tiles visible must be consistent with that size relative to the room, fixtures and any human-scale elements.`,
    '5. Lay the tiles in a realistic grid with correct, consistent perspective and vanishing lines. Joint lines must stay straight and converge correctly with the room geometry.',
    '6. Include realistic, evenly spaced grout joints appropriate to the tile size, in a colour that suits the tile. Grout must not be exaggerated or cartoonish.',
    '7. Respect real lighting physics: reflections, sheen and shadows on the tile must match the finish visible in the photograph and the lighting in the scene.',
    '8. Output a photorealistic architectural interior photograph. No text, no watermarks, no labels, no collage, no people looking at the camera.',
  ].join('\n')
}

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
      'You are an architectural visualiser producing a client-facing concept image for a tile showroom.',
      '',
      'TASK: Using the attached photograph of a physical tile, render a photorealistic interior showing that exact tile installed in the space described below.',
      '',
      describeSpace(spaceConfig, input.space),
      '',
      describeStyle(styleConfig, resolvedStyle),
      '',
      `CONCEPT ${index + 1} OF 3 — this concept must focus on: ${focus}`,
      'The three concepts are shown side by side to a client, so this one must be visibly different in framing and hero surface from the other two.',
      '',
      fidelityRules(tileSizeLabel),
    ].join('\n'),
  }))
}

/** Turns a stored tile size id such as "1200x600" into "1200 × 600 mm". */
export function formatTileSize(tileSize: string): string {
  const match = tileSize.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i)
  return match ? `${match[1]} × ${match[2]} mm` : tileSize
}
