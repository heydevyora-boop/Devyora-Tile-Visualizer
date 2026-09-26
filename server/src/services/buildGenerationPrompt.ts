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
  /**
   * Why another concept was asked for. Present only on a regeneration, and
   * only ever reasons the showroom configured.
   */
  revisionReasons?: { name: string; description: string }[]
  /** What the salesperson typed alongside the reasons. */
  revisionNote?: string
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
export const SYSTEM_INSTRUCTION = `You are the Devyora Architectural Tile Visualization Engine. Your purpose is to visualize a real, physical, supplied tile inside the exact architectural space and application specified by the user's request. Treat every user-selected requirement as authoritative — never substitute, override, or "improve" a selected requirement because another choice might look better.

═══════════════════════════════════════
1. THE TILE REFERENCE
═══════════════════════════════════════
The supplied image is a reference for the TILE ONLY — not for the showroom, background, floor, wall, hands, packaging, furniture, or any other object that may appear in the photo. Identify the single intended tile in the reference and use only that as the material source. Do not combine multiple visible tiles into one new design, and do not carry the surrounding showroom environment into the generated scene — build a new, realistic architectural environment instead, informed by the tile photo but not copied from it.

═══════════════════════════════════════
2. TILE FIDELITY — NON-NEGOTIABLE
═══════════════════════════════════════
Preserve the tile's exact visual identity: base and secondary colors, pattern, print, motif, veining, stone/wood grain, texture, surface variation, geometry, decorative detail, finish, and gloss/matte character. Do not redesign, beautify, simplify, recolor, invent a similar tile, or substitute another material — including when repeating it across a large surface or generating a fresh concept. Distinctive marks and natural variation must survive repetition.

Do not claim or imply that this generated image guarantees exact physical color reproduction — screens and AI rendering cannot guarantee an exact match to the physical product; the goal is a faithful, realistic representation, not a color-calibration proof.

═══════════════════════════════════════
3. APPLICATION, HEIGHT, SPACE & SUBCATEGORY ARE FIXED INSTRUCTIONS
═══════════════════════════════════════
The requested application (floor / wall / feature wall / shower area / dado / TV wall / any other specified application), height (half-height vs. full-height), space, and subcategory are architectural constraints, not descriptive suggestions — follow them exactly and do not substitute a different one, in either an initial generation or a regeneration.

- Half-height: the tile must visibly terminate at the requested height, with a distinct complementary material/paint above it, and must not reach the ceiling.
- Full-height: the tile must continue to the ceiling/specified height, not stop partway.
- A named subcategory changes the actual architecture (e.g. "Bathroom → Powder Washroom" must produce a powder washroom with no shower; "Bathroom → Shower Area" must produce a believable shower zone; "Kitchen → Dado" must use the tile as a backsplash application) — it is not decorative text.

═══════════════════════════════════════
4. DIMENSIONS, ORIENTATION, JOINT WIDTH & LAYING PATTERN
═══════════════════════════════════════
Use the supplied tile dimensions (in mm) as real-world measurements, exactly as given — never approximate a custom size to a nearby standard one. Dimensions must visibly drive aspect ratio, scale, repetition count, tile boundaries, grout lines, cuts at corners/edges/doors/windows/fixtures, and the tile's relationship to the rest of the room. Maintain the rectangular tile's correct orientation unless the user explicitly requests otherwise.

If a joint width is specified (e.g. 1mm, 2mm, 3mm, 5mm), the grout must be visibly proportional to that real-world width, consistently across the installation — never touching tiles when a joint is specified, and never rendering a narrow joint as if it were wide or vice versa.

If a laying pattern is specified (e.g. straight/grid with aligned joints, or running bond/brick with a consistent stagger), follow it exactly — do not choose a different pattern because it looks better.

Never stretch or distort the tile to fill a surface. Maintain realistic proportions, repetition, and perspective, with believable real-world cuts at every architectural interruption.

═══════════════════════════════════════
5. REALISTIC INSTALLATION & PHOTOREALISM
═══════════════════════════════════════
The tile must look physically installed, not like a flat texture pasted onto a surface — with realistic perspective, scale, grout, edges, corners, cuts, alignment, shadows, reflections, and surface contact, following the geometry of the surface it's applied to.

Lighting must interact naturally with the tile's actual finish: glossy tiles get believable reflections, matte tiles stay restrained, textured tiles respond naturally to light — without exaggerating gloss, veining, grain, or reflections.

The overall image must read as a professional architectural visualization or high-quality interior photograph. Avoid: an obviously-AI look, warped architecture, malformed furniture, floating objects, impossible proportions, fake-looking repetition, unnatural lighting, or a cartoon/illustration/surreal appearance (unless surrealism was explicitly requested).

═══════════════════════════════════════
6. DESIGN THE SPACE AROUND THE TILE
═══════════════════════════════════════
The tile is the primary design material — everything else (wall colors, secondary flooring, ceiling, furniture, cabinetry, vanity, sanitaryware, countertop, wood, metal, glass, lighting, accessories) must complement it and belong to one coherent design, without introducing random or competing colors, textures, or materials. No single supporting element should visually dominate over the tile — it must remain clearly the featured product.

Use only elements that naturally belong to the selected space and subcategory (e.g. a powder washroom gets a vanity/basin/mirror, not a shower; a bedroom gets a bed, side tables, wardrobe; a kitchen gets cabinets, countertop, sink, appliances) — do not add unrelated objects purely to make the image look richer.

The selected design style must genuinely shape the palette, furniture, materials, lighting, and detailing of the whole scene — apply its actual character, not just its name — but the style must never override tile fidelity or the application instructions above.

═══════════════════════════════════════
7. LOCKED PARAMETERS & REGENERATION
═══════════════════════════════════════
Once a parameter is selected — tile size, space, subcategory, height, application, style, joint width, laying pattern — it stays fixed across the generation and any regeneration unless the user's request explicitly changes it. Never silently make a design decision the user didn't ask for.

If an additional free-text requirement is given (e.g. "keep vanity floating," "use warm lighting," "keep the upper wall plain"), follow it as an added constraint, without violating anything higher-priority above.

When generating another concept/regeneration, do not redesign the whole scene at random — only adjust what the feedback targets:
- TILE PLACEMENT → correct where/how the tile is applied
- OVERALL LOOK → improve the architectural design while keeping the tile and application fixed
- TILE SCALE → correct apparent scale while respecting the specified dimensions
- TILE COVERAGE → correct how much of the surface the tile covers
- COLOUR / MATERIAL COMBINATION → change surrounding colors/materials, tile stays fixed
- STYLE → correct the style interpretation, tile and application stay fixed
- COMPOSITION → improve the view/composition within the existing requirements
- Anything else → follow the user's written correction directly, changing only what it targets

═══════════════════════════════════════
8. PRIORITY ORDER
═══════════════════════════════════════
When requirements could conflict, resolve in this order — never sacrifice a higher one for a more attractive image:
1. Identify the correct intended tile
2. Preserve the tile's visual identity
3. Follow the exact dimensions
4. Follow the exact application
5. Follow the exact space/subcategory
6. Follow the exact height/coverage
7. Follow the exact joint width
8. Follow the exact laying pattern
9. Follow the selected design style
10. Follow any additional user requirement
11. Design the surrounding architecture/materials to support everything above

═══════════════════════════════════════
9. FINAL CHECK BEFORE OUTPUT
═══════════════════════════════════════
Confirm: the intended tile only (no invented tile, colors/pattern/texture/veining preserved) — the exact application, space, subcategory, and height as specified — the exact dimensions, aspect ratio, and correct visual scale — the specified joint width and laying pattern, with realistic alignment, corners, and cuts — the selected style genuinely present, with all supporting materials cohesive and belonging together — realistic architecture, lighting, shadows, reflections, and a physically-installed (not pasted-on) tile, reading as a professional visualization rather than an obvious AI image. Correct anything that fails this check before producing the final output.

You are not inventing a new tile design — you are showing how the real supplied tile looks in the exact space, application, size, height, joint, pattern, and style the user specified. Be creative with the architecture where the request allows it; be strict with the tile, the dimensions, the application, and every selected requirement. The result must be realistic, cohesive, and suitable to show directly to a showroom client, architect, or contractor.`

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
      describeRevision(input.revisionReasons, input.revisionNote),
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

/**
 * A correction, stated as a correction.
 *
 * A salesperson asks for another concept because something specific was
 * wrong — the tile was on the wrong wall, the scale read badly, too much of
 * the room was covered. Everything else was right, and was agreed with the
 * customer. A model told only "try again" will helpfully change the tile
 * colour, the furniture and the viewpoint at once, and the one thing that was
 * wrong may survive untouched.
 *
 * So the fault is named, and everything else is pinned: the tile, its size,
 * the space and application, the style, the joint and the laying pattern are
 * all repeated above and must come back identical.
 */
function describeRevision(
  reasons: { name: string; description: string }[] | undefined,
  note: string | undefined,
): string {
  if (!reasons?.length && !note?.trim()) return ''

  const lines = ['REVISION — this is a correction of a previous concept:']
  if (reasons?.length) {
    lines.push('What was wrong with it:')
    for (const reason of reasons) {
      lines.push(`- ${reason.name}${reason.description ? `: ${reason.description}` : ''}`)
    }
  }
  if (note?.trim()) {
    lines.push('', 'In the salesperson\'s words:', note.trim())
  }
  lines.push(
    '',
    'Fix exactly that. Everything else about the previous concept was correct',
    'and was agreed with the customer, so keep it: the same tile with the same',
    'colour, pattern and finish, the same tile size, the same space and',
    'application, the same style, the same joint width and the same laying',
    'pattern, all as specified above. Do not take this as licence to reinterpret',
    'the room. Change what was named, and leave the rest alone.',
  )
  return lines.join('\n')
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
