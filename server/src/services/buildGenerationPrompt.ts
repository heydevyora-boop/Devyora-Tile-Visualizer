import { getSpaceConfig, type SpaceConfig } from '../config/spaces'
import { getStyleConfig, resolveStyleValue, type StyleConfig } from '../config/styles'

export interface PromptInput {
  space: string
  /** May be "surprise" — resolved to a concrete style before prompts are built. */
  style: string
  tileSize?: string
  /**
   * The application the salesperson chose, root category first — for example
   * Bathroom -> Powder Washroom -> Half Height. Resolved and verified against
   * the showroom's catalogue before it reaches here.
   */
  application?: { name: string; description: string }[]
  /** Grout joint width in millimetres, chosen from the list or typed in. */
  jointWidthMm?: number
  /** How the tiles are laid out, e.g. a straight grid or a running bond. */
  layingPattern?: { name: string; description: string }
  /**
   * A style the showroom added that has no curated config. Its description is
   * used in place of one.
   */
  styleDescription?: string
  /**
   * What the customer asked for in their own words, where the fixed choices
   * did not cover it. Optional and usually absent.
   */
  additionalRequirement?: string
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
  'TILE FIDELITY — the supplied tile is a real product, not a starting point:',
  'Reproduce the tile in the photograph exactly. Every one of these is part of',
  'its identity and must survive into the render: colour, pattern, print,',
  'veining, grain, texture, motif, geometry, decorative details, finish, and',
  'whether it is gloss or matte. Where the tile varies naturally from piece to',
  'piece, keep that variation rather than repeating one identical face.',
  'Do not redesign it. Do not replace it with a similar tile. Do not invent a',
  'marble, stone or pattern that resembles it. A customer will hold the real',
  'tile beside this image, and any difference is a difference they will see.',
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
  'PHOTOGRAPHIC REALISM:',
  'The result must read as a real architectural interior photograph, or a',
  'high-quality architectural visualisation. Avoid, specifically: distorted or',
  'impossible furniture, wrong proportions, lighting that could not occur,',
  'invented reflections, warped or bent tile geometry, surreal or dreamlike',
  'scenes, and anything that reads as cartoon or obviously machine-made.',
  '',
  'OUTPUT:',
  'A single photorealistic architectural interior photograph. No text, no',
  'watermarks, no labels, no collage, no people looking at the camera.',
  '',
  'Each request produces one of three concepts shown side by side to a customer,',
  'so each must be visibly distinct from the other two in framing and in how the',
  'tile is applied.',
].join('\n')

function describeStyle(
  style: StyleConfig | undefined,
  rawStyle: string,
  showroomDescription?: string,
): string {
  if (!style) {
    // A style the showroom added itself has no curated cues, so its own
    // description is the brief.
    return showroomDescription
      ? `Design style: ${rawStyle} — ${showroomDescription}`
      : `Design style: ${rawStyle}.`
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
/**
 * The prompt for one concept.
 *
 * A consultation asks for one image at a time, so only the requested concept
 * is built — nothing is generated speculatively and then discarded. The
 * variation focus still rotates, so asking for another concept of the same
 * room gives a genuinely different view rather than a near-duplicate.
 */
export function buildGenerationPrompt(input: PromptInput, conceptIndex = 0): BuiltPrompt {
  const all = buildGenerationPrompts(input)
  // Past the end of the list, the focuses cycle: a salesperson may ask for a
  // fourth or fifth view, and each should still be a deliberate viewpoint.
  return all[((conceptIndex % all.length) + all.length) % all.length]
}

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
      describeStyle(styleConfig, resolvedStyle, input.styleDescription),
      '',
      describeApplication(input.application),
      describeJointAndPattern(input.jointWidthMm, input.layingPattern),
      describeTileGeometry(input.tileSize),
      describeAdditionalRequirement(input.additionalRequirement),
      '',
      `CONCEPT ${index + 1} OF 3 — this concept must focus on: ${focus}`,
    ].join('\n'),
  }))
}

/**
 * The exact application, stated as a constraint rather than a preference.
 *
 * The salesperson has chosen where the tile goes and, where the showroom
 * configured it, precisely how far it runs — half height rather than full
 * height, a dado rather than a whole wall. That choice was made in front of a
 * customer and may already have been quoted on. A model left to its own
 * judgement will reliably prefer the more photogenic option, so the choice is
 * given as something that cannot be traded against how good the picture
 * looks.
 */
function describeApplication(application: { name: string; description: string }[] | undefined): string {
  if (!application?.length) return ''
  const chain = application.map((step) => step.name).join(' -> ')
  const detail = application
    .filter((step) => step.description)
    .map((step) => `- ${step.name}: ${step.description}`)

  return [
    'CHOSEN APPLICATION — follow this exactly:',
    chain,
    ...(detail.length ? ['', ...detail] : []),
    '',
    'This is the application the customer selected. Apply the tile to that',
    'surface, to that extent, and nowhere else it was not asked for. Do not',
    'substitute a different surface, and do not extend or reduce the tiled area',
    'because another arrangement would look better in the image. If a height or',
    'extent is named above, that height is a hard requirement: tile up to it',
    'exactly, and finish the wall above it in plain painted plaster.',
  ].join('\n')
}

/**
 * The joint width and the laying pattern, as things to draw rather than notes.
 *
 * Both are decisions a customer makes and a fitter is then held to. A 2 mm
 * joint and a 5 mm joint produce visibly different rooms, and a running bond
 * is not a grid — left unstated, the model settles into a generic medium
 * joint on a straight grid every time, and the customer's choice never
 * reaches the picture they are shown.
 */
function describeJointAndPattern(
  jointWidthMm: number | undefined,
  layingPattern: { name: string; description: string } | undefined,
): string {
  const lines: string[] = []

  if (jointWidthMm) {
    // Said in relation to the tile as well as absolutely: the model has no
    // ruler, but it can judge a joint against the tile beside it.
    const character =
      jointWidthMm <= 1.5
        ? 'a very fine joint — the tiles read as almost butt-jointed, and the grid is subtle'
        : jointWidthMm <= 3
          ? 'a fine, conventional joint — clearly visible but not a feature'
          : 'a wide, deliberate joint — the grid is part of the look'
    lines.push(
      'GROUT JOINT:',
      `Grout joints approximately ${jointWidthMm} mm wide. This is ${character}.`,
      'Keep the width even everywhere, on every joint, in both directions, and',
      'consistent in perspective — joints further from the camera appear',
      'narrower, but are the same real width. Judge the joint against the tile',
      'next to it rather than drawing a generic gap.',
    )
  }

  if (layingPattern) {
    if (lines.length) lines.push('')
    lines.push(
      'LAYING PATTERN:',
      `${layingPattern.name}.${layingPattern.description ? ` ${layingPattern.description}` : ''}`,
      'Follow this pattern across the whole tiled surface, including where it',
      'meets edges and corners. Do not fall back to a plain grid because it is',
      'simpler to draw.',
    )
  }

  return lines.join('\n')
}

/**
 * The customer's own request, carried through as written.
 *
 * Everything else on this screen is a choice from a list; this is the one
 * place a customer says something specific — warm lighting, a floating
 * vanity, wood cabinets. It is placed after the fixed choices deliberately:
 * it adds to them and must not be read as permission to override the
 * application, the size or the joint, which were agreed separately.
 */
function describeAdditionalRequirement(requirement: string | undefined): string {
  const text = requirement?.trim()
  if (!text) return ''
  return [
    'CUSTOMER REQUEST — additional to the choices above, never instead of them:',
    text,
    'Honour this in the room around the tile. If it cannot be reconciled with',
    'the application, tile size, joint or laying pattern already specified,',
    'those take precedence and this is applied as far as it can be.',
  ].join('\n')
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
