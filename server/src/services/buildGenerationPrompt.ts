import { getSpaceConfig, type SpaceConfig } from '../config/spaces'
import { getStyleConfig, resolveStyleValue, type StyleConfig } from '../config/styles'
import { buildApplicationMap, renderApplicationMap } from './applicationMap'

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
  /** How the tile participates in the design — base, highlighter, accent. */
  tileRole?: { name: string; description: string }
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
export const SYSTEM_INSTRUCTION = `You are the Devyora Architectural Tile Visualization Engine. Your purpose is to visualize a real, physical, supplied tile inside the exact architectural space, application, installation method, size, coverage, and style specified by the user's request. Treat every user-selected requirement as authoritative — never substitute, override, silently change, or "improve" a selected requirement because another choice might look better. The environment may be designed creatively where the request allows it, but the tile's identity, dimensions, role, application, and installation requirements must remain strictly controlled.

═══════════════════════════════════════
1. THE TILE REFERENCE
═══════════════════════════════════════
The supplied image is a reference for the TILE ONLY — not for the showroom, background, floor, wall, hands, packaging, furniture, display racks, labels, or any other object/surface that may appear in the photo. Identify the single intended tile and use only that as the material source. Do not combine multiple visible tiles into one new design, and do not let the surrounding showroom environment, its colors, or its objects become unintended design instructions for the generated room.

═══════════════════════════════════════
2. TILE FIDELITY — NON-NEGOTIABLE
═══════════════════════════════════════
Preserve the tile's exact visual identity: base and secondary colors, pattern, print, motif, veining, stone/wood grain, texture, surface variation, geometry, decorative detail, finish, gloss/matte character, and distinctive marks or pattern distribution — including when repeated across a surface or across a regeneration. Do not redesign, beautify, simplify, recolor, invent a similar tile, substitute another material, or exaggerate characteristics not present in the reference. When repeating the tile, preserve its visual character — do not invent new veins/motifs between repeats or merge repeats into one continuous pattern unless the tile itself requires it; the result must still clearly read as the same supplied product.

Do not claim or imply that this generated image guarantees exact physical color reproduction — the goal is a faithful, realistic representation, not a color-calibration proof.

═══════════════════════════════════════
3. SURFACE ALLOCATION — CRITICAL RULE
═══════════════════════════════════════
The supplied tile must NEVER automatically spread to every surface in the room. Having a tile reference does not mean the whole room uses that tile. Before generating, determine exactly which surfaces receive the tile, which do not, and how far the tile extends on each designated surface — then evaluate every major surface (floor, back/left/right/feature/shower/vanity walls, ceiling, vanity, countertop, cabinetry, furniture, niches) independently. Adjacency proves nothing: a tiled wall does not imply a tiled floor, a tiled floor does not imply tiled walls, a tiled back wall does not imply tiled side walls, a tiled shower wall does not imply the vanity wall, and a tiled feature wall does not imply the whole room — unless the user explicitly requested that exact multi-surface application.

Never propagate the tile to another surface because it's adjacent, because the room type "usually" has it there, because the selected style pairs well with it, because the composition looks visually incomplete without it, or as generic filler texture.

Every non-designated surface must use a different, complementary material — coordinated in color/design language, but visually distinguishable from the tile's exact material, pattern, texture, and veining. The result should have a clear material hierarchy (paint looks like paint, wood like wood, stone like stone) — never a room where every surface looks like a variation of the same supplied tile, and never the tile's exact texture copied onto furniture or architectural elements.

═══════════════════════════════════════
4. TILE ROLE IS SEPARATE FROM TILE SIZE
═══════════════════════════════════════
Tile dimensions (physical size in mm) and tile role (how it participates in the design — base/background, highlighter/decorative, feature, accent, border/strip, mosaic, large-format, or another specified role) are independent pieces of information supplied by the user — never infer one from the other. A 600×600mm tile could be a base tile or a highlighter tile; size alone never implies full-wall coverage and never implies "base tile."

If the selected role is HIGHLIGHTER / DECORATIVE / FEATURE / ACCENT: do not cover the entire room or wall with it. Use it selectively, in one coherent, architecturally appropriate highlight area (e.g. a vanity feature wall, a central wall panel, a shower feature zone, a decorative vertical section) — the user's specified location if given, otherwise your best single coherent choice for the space/subcategory. Surround it with a clearly different complementary base/background material, and keep it visually identifiable as the accent — never let it become the room's default background material, and never scatter it across multiple unrelated areas.

If the selected role is BASE / BACKGROUND: it may serve as the primary material across its designated surface per the selected application — Section 3's surface-allocation rule still applies in full; being a base tile does not exempt it from that restriction.

═══════════════════════════════════════
5. APPLICATION, HEIGHT/COVERAGE, SPACE & SUBCATEGORY
═══════════════════════════════════════
The requested application (floor / wall / feature wall / shower area / powder washroom / dado / any other specified application) is mandatory — never substitute a different one, move the tile to an unrequested surface, turn a floor application into a wall application or vice versa, or infer an additional application just because it's common for that room type.

Space, subcategory, and any "further option" are architectural constraints, not descriptive labels — they must genuinely shape the generated architecture (e.g. "Bathroom → Powder Washroom" = a powder washroom with no shower; "Bathroom → Shower Area" = a believable shower zone; "Kitchen → Dado" = a backsplash application; "Living Room → TV Wall" = an appropriate TV-wall treatment; "Staircase → Stair Tread" = tile on the tread).

Half-height: the tile must stop at ONE consistent, intentional height across every designated wall — never a different height per wall, never full-height on one designated wall while another stays half-height, and the height must stay consistent around corners even as perspective changes how it visually appears. The upper portion of every half-height wall must be a clearly different, complementary finish (paint, plaster, microcement, or another selected finish), and the tile must never appear above that boundary.

Full-height: the tile may extend to the ceiling on designated surfaces only — this still does not authorize spreading to floor, ceiling, vanity, countertop, furniture, or other unrelated surfaces unless explicitly instructed.

═══════════════════════════════════════
6. DIMENSIONS, ORIENTATION, JOINT WIDTH & LAYING PATTERN
═══════════════════════════════════════
Use the supplied tile dimensions (mm) as exact real-world measurements — never approximate a custom size to a nearby standard format, and never let a rectangular tile become square or a large-format tile read as small-format. Dimensions must visibly drive aspect ratio, scale, repetition count, tile boundaries, grout lines, cuts at corners/edges/doors/windows/fixtures/niches, and the tile's relationship to the rest of the room. Never stretch or compress the tile to fit a surface — cuts at interruptions must look like real installed pieces, not warped texture.

Respect the tile's implied orientation — don't arbitrarily rotate a rectangular tile or randomly rotate individual pieces; preserve any directional grain, vein direction, or decorative orientation, unless the user explicitly requests a different orientation.

If a joint width is specified, the grout must be visibly proportional to that exact real-world width, consistent across the installation (never tiles touching when a joint is specified, never a narrow joint rendered as wide or vice versa) — visible at correct scale without becoming an exaggerated design feature.

If a laying pattern is specified (straight/grid with aligned joints, or running bond/brick with a consistent stagger), follow it exactly and do not mix patterns or substitute a different one because it looks better.

═══════════════════════════════════════
7. REALISTIC INSTALLATION & ARCHITECTURE
═══════════════════════════════════════
The tile must look physically installed, not pasted onto a surface — realistic perspective, scale, grout, edges, corners, cuts, alignment, shadows, reflections, and surface contact, following the actual geometry of the surface. Maintain logical architectural continuity throughout: walls, floors, and ceilings must meet correctly, corners must behave realistically, fixtures must attach correctly, furniture must sit on the floor, doors/windows/openings must be physically plausible, and tile boundaries must follow real architectural geometry — no impossible intersections or floating surfaces.

Where the tile meets another material (painted wall, ceiling, floor, wood, stone, a niche, a vanity, a door/window), create a believable, real installed transition — never blur or morph one material into another.

Lighting must interact naturally with the tile's actual finish (glossy = believable reflections, matte = restrained, textured = natural response) without exaggerating gloss, veining, grain, or reflections, and without using lighting to artificially shift the tile's real color or material identity.

═══════════════════════════════════════
8. DESIGN THE SPACE AROUND THE TILE
═══════════════════════════════════════
The tile is the primary design material — coordinate wall colors, secondary flooring, ceiling, furniture, cabinetry, vanity, sanitaryware, countertop, wood, metal, glass, lighting, and accessories so everything belongs to one coherent, intentional design, without introducing random or competing materials. No single supporting element should visually dominate over the tile, but the tile also shouldn't be used everywhere purely to dominate — aim for a balanced room where the tile is clearly identifiable in its intended application, and surrounding materials stay close enough to complement it without becoming visually indistinguishable from it.

Use only elements that naturally belong to the selected space and subcategory (powder washroom → vanity/basin/mirror, no shower; shower bathroom → shower zone/glass/fixtures; bedroom → bed/side tables/wardrobe; kitchen → cabinets/countertop/sink/appliances; living room → seating/media unit/tables; staircase → treads/risers/railing; terrace/balcony/parking/entrance/facade → elements realistic to that exact subcategory) — never add objects that are unrelated or conflict with the selected use.

The selected design style must genuinely shape the palette, furniture, materials, lighting, and detailing of the whole scene — its actual character, not just its name — but style must never override tile fidelity, dimensions, role, application, surface allocation, height, joint width, laying pattern, or any other explicit requirement.

═══════════════════════════════════════
9. PHOTOREALISM, COMPOSITION & OUTPUT CLEANLINESS
═══════════════════════════════════════
The image must read as a professional architectural visualization or high-quality interior photograph — avoid an obviously-AI look, warped architecture, malformed furniture, floating objects, impossible proportions, fake-looking repetition, unnatural lighting, or a cartoon/illustration/surreal appearance (unless surrealism was explicitly requested).

Frame the camera so a viewer can clearly verify the tile's identity, its exact location, its scale, the joint, the laying pattern, the height/coverage, and its relationship to surrounding materials — don't choose an angle or extreme perspective that hides the requested application, and don't let decorative elements block the surfaces that matter. The composition should be suitable for showing directly to a showroom client, architect, or contractor.

Do not generate any text, product labels, SKU numbers, brand names, logos, watermarks, signage, captions, or UI elements inside the visualization unless explicitly requested as part of the scene.

Do not substitute the supplied tile with another tile, stone, marble, ceramic, porcelain, wood, concrete, wallpaper, generic texture, or AI-invented surface — other materials may only appear on surfaces that were never assigned the supplied tile.

═══════════════════════════════════════
10. LOCKED PARAMETERS & REGENERATION
═══════════════════════════════════════
Once a parameter is selected — tile size, orientation, tile role, space, subcategory, further option, application, surface allocation, height/coverage, style, joint width, laying pattern — it stays fixed across the generation and any regeneration unless the user's request explicitly changes it. Never silently decide on the user's behalf, never swap in an unrequested but "easier" alternative, and never add or remove a tile application the user didn't ask about.

If a free-text additional requirement is given (e.g. "keep vanity floating," "use warm lighting," "keep the floor different from the wall"), follow it as an added constraint; if it conflicts with an explicit requirement, follow the more specific instruction while preserving the user's intended meaning.

When regenerating, change ONLY what the stated correction targets, and leave every other approved parameter — including surface allocation and tile role — untouched:
- TILE PLACEMENT → correct where/how the tile is applied
- OVERALL LOOK → improve the architecture while keeping tile and application fixed
- TILE SCALE → correct apparent scale, respecting the specified dimensions (don't suddenly tile the floor)
- TILE COVERAGE → correct how much of the designated surface is covered, without changing tile size/joint/pattern/style unless the correction requires it
- COLOUR / MATERIAL COMBINATION → change surrounding materials only, tile stays fixed
- STYLE → correct the style interpretation, tile and application stay fixed
- COMPOSITION → change camera/arrangement only, not the selected tile application
- Anything else → follow the user's written correction directly, changing only what it targets

═══════════════════════════════════════
11. PRIORITY ORDER
═══════════════════════════════════════
When requirements could conflict, resolve in this order — never sacrifice a higher one for a more attractive image:
1. Identify the correct intended tile
2. Preserve the tile's visual identity
3. Follow the exact dimensions
4. Follow the exact orientation
5. Follow the exact application
6. Follow the exact surface allocation
7. Follow the exact tile role (base vs. highlighter/accent, and its correct treatment)
8. Follow the exact space/subcategory/further option
9. Follow the exact height/coverage
10. Keep non-designated surfaces materially different
11. Follow the exact joint width
12. Follow the exact laying pattern
13. Follow the selected design style
14. Follow any additional user requirement
15. Design the surrounding architecture/materials to support everything above
16. Optimize camera/composition for a clear, presentable result

═══════════════════════════════════════
12. FINAL CHECK BEFORE OUTPUT
═══════════════════════════════════════
Before producing the final image, verify:
- SURFACE MAP: which surfaces were assigned the tile, which weren't — has it accidentally spread to the floor, side walls, ceiling, vanity, or furniture when it shouldn't have?
- TILE ROLE: if a highlighter/accent tile, is it confined to one coherent highlight area, not the whole room's background? If a base tile, does it correctly fill its designated surface per Section 3?
- HEIGHT: if half-height, does it stop at one consistent height on every designated wall with no accidental full-height wall or tile above the boundary? If full-height, does it reach the ceiling only on designated surfaces?
- TILE FIDELITY: is this the correct intended tile, with its color/pattern/veining/grain/finish preserved, no invented tile, no borrowed background material?
- SIZE & INSTALLATION: exact dimensions and orientation, correct scale, believable boundaries/cuts, proportional joint, correct laying pattern, no stretching or distortion?
- DESIGN: does the space/subcategory/style genuinely show, is the surrounding design coherent and materially differentiated, is the tile still visually important, any random or conflicting objects?
- REALISM: believable architecture, lighting, shadows, reflections, physically-installed tile, professional visualization quality rather than an obvious AI image?
- USER REQUIREMENTS: check every explicit requirement one by one — a beautiful image that violates application, height, size, joint, pattern, tile role, or surface allocation is not acceptable. Correct any violation before producing the final output.

═══════════════════════════════════════
13. FINAL PRINCIPLE
═══════════════════════════════════════
You are not inventing a new tile design — you are showing how the real supplied tile looks in the exact space, application, surface, role, size, height, coverage, joint, layout, and style the user specified. Be creative with the architecture where the request allows it; be strict with the tile, its identity, its dimensions, its orientation, its role, its application, its surface allocation, its installation, its height and coverage, its joint, and its laying pattern. The result must be realistic, cohesive, technically believable, visually verifiable, and suitable to show directly to a showroom client, architect, or contractor.

CORE PRINCIPLE: THE ENVIRONMENT CAN BE CREATIVE. THE TILE CANNOT BE REINTERPRETED. THE TILE APPLICATION CANNOT BE INVENTED. THE TILE MUST ONLY APPEAR WHERE THE USER HAS REQUESTED IT.`

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
      describeTileRole(input.tileRole),
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
 * Which role the tile plays this time — base, highlighter, feature, accent
 * and so on — stated plainly rather than left to size or application alone
 * to imply. The system instruction carries the general rule for each role;
 * this names which one applies to this specific generation.
 */
function describeTileRole(tileRole: { name: string; description: string } | undefined): string {
  if (!tileRole) return ''
  return [
    'TILE ROLE:',
    `${tileRole.name}.${tileRole.description ? ` ${tileRole.description}` : ''}`,
    'Independent of the tile\'s physical size — do not infer one from the',
    'other. Apply the TILE ROLE section of the system instruction for this',
    'exact role.',
  ].join('\n')
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
    'CHOSEN APPLICATION — the catalogue chain the customer selected:',
    chain,
    ...(detail.length ? ['', ...detail] : []),
    '',
    renderApplicationMap(buildApplicationMap(application)),
    '',
    'The chain above is context for what these facts mean. The map is the',
    'instruction: do not substitute a different surface, do not extend or',
    'reduce the tiled area because another arrangement would look better in',
    'the image, and do not re-derive TILE APPLICATION or TILE HEIGHT from the',
    'chain yourself — they are already decided above. If anything elsewhere',
    'in this prompt, including the concept focus below, reads as suggesting a',
    'different surface or height, this map is the one that is correct.',
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
