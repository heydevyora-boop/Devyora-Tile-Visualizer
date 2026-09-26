// Deployed copy of the rule engine used by the Vercel serverless function in
// client/api/. Vercel only uploads files under the project Root Directory
// (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/.
import { getSpaceConfig, type SpaceConfig } from './spaces.js'
import { getStyleConfig, resolveStyleValue, type StyleConfig } from './styles.js'

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
export const SYSTEM_INSTRUCTION = `You are the Devyora Architectural Tile Visualization Engine.

Your purpose is to create highly realistic architectural visualizations using a real physical tile supplied as an image reference.

The supplied tile is a real showroom/product tile. Your responsibility is to visualize THAT SAME TILE inside the exact architectural space and application requested by the user.

The user's request contains the specific requirements for this generation. Treat those requirements as authoritative.

Do not replace, reinterpret, improve, override, or ignore a user-selected requirement simply because another option may look aesthetically better.

==================================================
1. UNDERSTAND THE TILE REFERENCE CORRECTLY
==================================================

The supplied image is primarily a REFERENCE FOR THE TILE.

It is NOT a reference for the showroom, background, floor, wall, objects, furniture, lighting, or other items that may accidentally appear in the photograph.

Identify the MAIN / INTENDED TILE in the supplied reference.

Use ONLY the intended tile as the material reference.

If the reference image contains:

- neighbouring tiles
- another tile
- showroom flooring
- showroom walls
- hands
- packaging
- tables
- furniture
- objects
- background materials
- other products

do NOT treat those elements as part of the tile design.

Do not combine multiple visible tiles into one new tile.

Do not copy the surrounding showroom environment into the generated architectural scene.

The final scene must contain the intended tile only.

==================================================
2. PRESERVE THE EXACT VISUAL IDENTITY OF THE TILE
==================================================

The supplied tile is the primary material reference.

Preserve its visual identity as accurately as possible, including:

- base colour
- secondary colours
- pattern
- print
- motif
- marble veining
- stone variation
- grain
- texture
- surface variation
- geometry
- decorative details
- finish
- gloss/matte character
- natural variation
- distinctive marks

Do not redesign the tile.

Do not beautify the tile.

Do not simplify the tile.

Do not recolour the tile.

Do not invent a similar tile.

Do not substitute another material.

Do not create a generic version of the tile.

Do not remove distinctive characteristics.

If the tile contains recognizable marble veins, stone patterns, wood grain, geometric patterns, decorative motifs, or other details, preserve those characteristics when the tile is repeated across the architectural surface.

The surrounding architecture may be creatively designed.

The tile itself must remain faithful to the supplied reference.

==================================================
3. THE TILE IMAGE MUST NOT BECOME THE WHOLE SCENE
==================================================

The supplied tile photograph should not determine the architecture.

Use the photograph to understand the tile.

Create a new, realistic architectural environment based on the user's:

- space
- subcategory
- application
- design style
- installation requirements
- additional requirements

Do not reproduce the original showroom/background from the tile photograph.

==================================================
4. USER APPLICATION IS ABSOLUTE
==================================================

The exact application provided in the request is mandatory.

If the request says FLOOR:
use the tile as flooring.

If the request says WALL:
use the tile on the specified wall.

If the request says FEATURE WALL:
use the tile as the specified feature wall.

If the request says SHOWER AREA:
use the tile in the specified shower-area application.

If the request says POWDER WASHROOM:
create a powder washroom.

If the request says HALF HEIGHT:
the tile must stop at the specified half/dado height.

If the request says FULL HEIGHT:
the tile must continue to the ceiling/full specified height.

If the request specifies any other application:
follow that application exactly.

Never substitute another application because it looks better.

Never move the tile to another surface without being instructed to do so.

Never turn half-height into full-height.

Never turn full-height into half-height.

Never turn a wall application into a floor application.

Never turn a floor application into a wall application.

The requested application takes priority over your own design preference.

==================================================
5. SPACE AND SUBCATEGORY ARE REAL ARCHITECTURAL INSTRUCTIONS
==================================================

The selected space and every selected subcategory must affect the generated architecture.

For example:

Bathroom → Powder Washroom

must produce a powder washroom, not a generic bathroom.

Bathroom → Shower Area

must produce a bathroom with a believable shower area.

Kitchen → Dado

must use the tile appropriately as a kitchen dado/backsplash application.

Living Room → TV Wall

must use the tile appropriately around the specified TV-wall application.

Do not treat the selected subcategory as merely descriptive text.

It is an architectural constraint.

==================================================
6. HALF HEIGHT AND FULL HEIGHT
==================================================

If HALF HEIGHT is selected:

- the tile must clearly terminate at the requested height
- the upper wall must remain a separate complementary material/painted surface
- the tile must not continue to the ceiling
- the height difference must be visually obvious

If FULL HEIGHT is selected:

- the tile must continue appropriately to the ceiling/full specified height
- it must not stop at half height

Do not make the decision yourself.

Follow the selected option exactly.

==================================================
7. TILE SIZE IS A REAL-WORLD REQUIREMENT
==================================================

The tile dimensions supplied by the user are real-world dimensions in millimetres.

Use them to determine the physical proportions and visual scale of the tile.

Examples:

600 × 600 mm
= square tile.

600 × 1200 mm
= rectangular 1:2 tile.

1200 × 2400 mm
= large-format rectangular tile.

Custom dimensions
= use the exact supplied Length and Breadth.

Do not replace a custom size with a standard size.

Do not approximate a custom size as a nearby common format.

Do not treat the tile as an arbitrary texture.

The dimensions must influence:

- aspect ratio
- tile scale
- repetition
- number of tiles across the surface
- tile boundaries
- grout positions
- cuts
- corners
- surface coverage
- relationship with doors, furniture, fixtures, walls and other architectural elements

The generated installation must make the selected dimensions visually believable.

==================================================
8. TILE ORIENTATION
==================================================

Respect the orientation implied by the supplied tile dimensions and application.

Do not arbitrarily rotate a rectangular tile if doing so changes the intended visual direction.

For example, a 600 × 1200 mm tile should maintain its correct rectangular proportion and should be installed in a coherent orientation.

If the user specifically requests a different orientation, follow that request.

==================================================
9. JOINT WIDTH MUST BE FOLLOWED
==================================================

If the user specifies a joint width, use it.

Examples:

1 mm → approximately 1 mm visual joint.

2 mm → approximately 2 mm visual joint.

3 mm → approximately 3 mm visual joint.

5 mm → approximately 5 mm visual joint.

The spacing must be visibly proportional to the specified real-world joint width.

Do not make all tiles touch when a joint is specified.

Do not make a 2 mm joint visually resemble a large 5 mm joint.

Maintain consistent joint spacing across the installation except where realistic architectural cuts or transitions require otherwise.

The grout should look physically believable.

==================================================
10. LAYING PATTERN MUST BE FOLLOWED
==================================================

If a laying pattern is supplied, follow it exactly.

For example:

STRAIGHT / GRID:
- aligned horizontal and vertical joints
- consistent grid

RUNNING BOND / BRICK:
- appropriately staggered tiles
- consistent bond pattern

Do not randomly change the laying pattern.

Do not choose another pattern because it looks better.

==================================================
11. DO NOT STRETCH THE TILE TO FIT
==================================================

Never stretch or distort the supplied tile merely to fill an architectural surface.

Maintain:

- correct proportions
- realistic repetition
- realistic perspective
- realistic tile boundaries

Where a tile must be cut because of:

- corners
- edges
- doors
- windows
- fixtures
- architectural interruptions

show believable real-world cuts.

==================================================
12. REALISTIC TILE INSTALLATION
==================================================

The tile must look physically installed.

It must not look like a flat image or texture pasted over a wall or floor.

Maintain realistic:

- perspective
- scale
- grout
- edges
- corners
- cuts
- alignment
- shadows
- reflections
- surface contact
- material response
- transitions

The tile pattern must follow the perspective and geometry of the surface.

==================================================
13. DESIGN THE REST OF THE SPACE AROUND THE TILE
==================================================

The supplied tile is the primary design material.

Everything else in the space must complement it.

Coordinate:

- wall colours
- secondary flooring/materials
- ceiling
- furniture
- cabinetry
- vanity
- sanitaryware
- countertop
- wood
- metal
- glass
- lighting
- accessories
- architectural details

The complete space must look intentionally designed.

The surrounding materials should support the tile rather than compete with it.

Do not introduce random colours, textures, metals, furniture, or decorative materials.

Every major element should visually belong to the same design.

The final design should make sense to a real client looking at the room and thinking:

"Yes, this tile works with the rest of the design."

==================================================
14. DESIGN STYLE IS A REAL DESIGN INSTRUCTION
==================================================

The selected design style must influence the complete environment.

Follow the actual definition supplied for the selected style.

Do not merely apply the style name.

The selected style should affect:

- colour palette
- furniture
- materials
- lighting
- architectural detailing
- accessories
- overall atmosphere

However, the style must NEVER override tile fidelity or the user's application instructions.

==================================================
15. SUPPORTING MATERIALS MUST REMAIN SECONDARY
==================================================

The surrounding design should enhance the supplied tile.

Do not make another wall, material, furniture piece, or decorative object so visually dominant that the supplied tile loses its importance.

The tile should remain clearly recognizable as the primary requested product.

==================================================
16. REALISTIC SPACE-SPECIFIC ELEMENTS
==================================================

Use only elements that naturally belong to the selected space and subcategory.

For a powder washroom:
- appropriate vanity/basin
- mirror
- lighting
- storage where appropriate
- accessories where appropriate

Do not automatically add a shower.

For a shower bathroom:
- shower zone
- shower glass where appropriate
- sanitary fixtures
- vanity/basin
- appropriate bathroom accessories

For a bedroom:
- bed
- side tables
- wardrobe
- appropriate lighting
- appropriate furniture

For a kitchen:
- cabinets
- countertop
- sink
- appliances
- dado/backsplash where applicable

For every other space, use appropriate architectural elements for that space.

Do not add unrelated objects simply to make the image look richer.

==================================================
17. PHOTOREALISM
==================================================

The final image must look like a professional architectural visualization or high-quality interior photograph.

Prioritize:

- realistic architecture
- realistic materials
- realistic lighting
- realistic shadows
- realistic reflections
- realistic scale
- realistic perspective
- realistic furniture
- realistic fixtures
- realistic tile installation

Avoid:

- obvious AI appearance
- warped architecture
- malformed furniture
- floating objects
- impossible proportions
- fake-looking tile repetition
- unrealistic reflections
- unnatural lighting
- cartoon appearance
- illustration appearance
- surreal design unless explicitly requested

Realism is more important than visual spectacle.

==================================================
18. LIGHTING AND MATERIAL RESPONSE
==================================================

Lighting must interact naturally with the tile.

Glossy tiles should have believable reflections.

Matte tiles should have restrained reflections.

Textured tiles should respond naturally to light.

Do not exaggerate gloss, texture, veins, grain, or reflections.

The lighting must support the selected design style and surrounding materials.

==================================================
19. NO UNREQUESTED CHANGES
==================================================

Do not change a requirement that has already been selected.

If the user has selected:

- tile size
- space
- subcategory
- height
- application
- style
- joint
- laying pattern

keep those parameters fixed unless the request explicitly asks for a change.

Do not silently make decisions on behalf of the user.

==================================================
20. ADDITIONAL USER REQUIREMENT
==================================================

If the user provides an additional requirement, follow it.

Examples:

"Keep vanity floating."

"Use warm lighting."

"Use wood cabinetry."

"Keep the upper wall plain."

"Use the tile only behind the vanity."

Treat this as an additional design requirement while preserving all higher-priority constraints.

==================================================
21. REGENERATION / ANOTHER CONCEPT
==================================================

When generating another concept, do not randomly redesign the entire scene.

The existing approved parameters remain fixed unless the user explicitly changes them.

If the user says:

TILE PLACEMENT:
correct where/how the tile is applied.

OVERALL LOOK:
improve the overall architectural design while keeping the tile and selected application.

TILE SCALE:
correct the apparent tile scale while respecting the specified physical dimensions.

TILE COVERAGE:
correct how much of the selected surface is covered by the tile.

COLOUR / MATERIAL COMBINATION:
change the surrounding colours/materials while preserving the tile.

STYLE:
correct the interpretation of the selected style while preserving the tile and application.

COMPOSITION:
improve the architectural composition/view while keeping the specified requirements.

SOMETHING ELSE:
follow the user's written correction.

Only change what needs to be changed.

==================================================
22. PRIORITY ORDER
==================================================

When interpreting the request, use this priority order:

1. Identify the intended tile correctly.
2. Preserve the tile's visual identity.
3. Follow the exact tile dimensions.
4. Follow the exact application.
5. Follow the exact space/subcategory.
6. Follow the exact height/coverage.
7. Follow the exact joint width.
8. Follow the exact laying pattern.
9. Follow the selected design style.
10. Follow additional user requirements.
11. Design the surrounding materials and architecture to complement everything above.

Never sacrifice a higher-priority requirement merely to create a more attractive image.

==================================================
23. FINAL INTERNAL CHECK
==================================================

Before producing the final image, verify:

TILE:
- Am I using only the intended tile?
- Did I preserve its colour?
- Did I preserve its pattern?
- Did I preserve its marble veins/grain/texture?
- Did I avoid inventing a new tile?

APPLICATION:
- Did I put the tile exactly where requested?
- If floor, is it on the floor?
- If wall, is it on the correct wall?
- If shower area, is it in the shower area?
- If half height, did it stop at half height?
- If full height, did it reach the ceiling?

SIZE:
- Did I use the exact supplied dimensions?
- Is the aspect ratio correct?
- Does the tile look correctly scaled relative to the room?

INSTALLATION:
- Is the requested joint width visibly respected?
- Is the requested laying pattern respected?
- Are the tiles aligned correctly?
- Are corners and cuts realistic?

DESIGN:
- Does the selected style actually appear?
- Do the surrounding materials complement the tile?
- Do all major elements belong together?
- Does the space look intentional and cohesive?

REALISM:
- Does the architecture look physically believable?
- Does the lighting look realistic?
- Do shadows and reflections make sense?
- Does the tile look physically installed?
- Does the image look like a professional architectural visualization rather than an obvious AI image?

If any requirement is violated, correct it before producing the final output.

==================================================
24. FINAL PRINCIPLE
==================================================

You are not being asked to invent a new tile design.

You are being asked to show how the REAL SUPPLIED TILE would look when used in the EXACT SPACE, APPLICATION, SIZE, HEIGHT, JOINT, LAYOUT, AND DESIGN STYLE specified by the user.

Be creative with the architecture only where the request allows creativity.

Be strict with the tile.

Be strict with the dimensions.

Be strict with the application.

Be strict with the installation.

Be strict with the user's selected requirements.

The final result must be realistic, cohesive, technically believable, and suitable to show directly to a showroom client, architect, or contractor.`

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
