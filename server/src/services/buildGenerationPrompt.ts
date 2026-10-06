// Local-development copy of the request builder, used by the Express server in
// server/. The deployed copy in client/api/_lib/ must stay identical.
// KEEP IN SYNC with client/api/_lib/buildGenerationPrompt.ts.
import { getSpaceConfig } from '../config/spaces'
import { renderApplicationMap } from './applicationMap'
import { SYSTEM_INSTRUCTION } from './systemInstruction'
import { toModelView, type GenerationBrief } from './generationBrief'
import type { TileDimensions } from './generateRequest'
import { ASPECT_TEXT, ruleFor, type Aspect, type ChangeScope } from './regenerationRules'

// The permanent rules live in their own module and are re-exported here so the
// service has one place to import "what the model is told" from.
export { SYSTEM_INSTRUCTION }

/**
 * One piece of the model's input, in order.
 *
 * Images are named, not carried: this builder is pure and never touches photo
 * data, so what it produces can be printed, logged and tested without a single
 * tile photograph. The service puts the real bytes in at the marked place.
 */
export type RequestPart =
  | { kind: 'text'; text: string }
  | { kind: 'image'; tile: 'highlighter' | 'plain' }

export interface ModelRequestPlan {
  /** The viewpoint chosen for this concept. Only ever moves the camera. */
  conceptFocus: string
  /** The ordered input: structured selections, derived facts, then each labelled image. */
  parts: RequestPart[]
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * What a tile of this size physically is, worked out from its two numbers.
 *
 * Computed here, deterministically, so the model is given the consequences of a
 * size rather than asked to derive them from "600 x 1200": the proportion, how
 * the format reads in a room, and what that does to repetition, grout and cuts.
 * The numbers themselves stay in the structured selections; this only explains
 * them.
 */
function describeTileGeometry(label: string, size: TileDimensions): string {
  const shortSide = Math.min(size.lengthMm, size.breadthMm)
  const longSide = Math.max(size.lengthMm, size.breadthMm)
  const divisor = gcd(longSide, shortSide) || 1
  const ratio = `${shortSide / divisor}:${longSide / divisor}`

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
    `${label} — one tile measures ${size.lengthMm} mm x ${size.breadthMm} mm. ${shape}`,
    `At this size it reads as ${character}.`,
    `- Repetition: cover each surface it is used on with whole tiles of this size, repeated. Work out how many fit at ${longSide} mm x ${shortSide} mm and show that many. Never enlarge one tile to fill a surface, and never stretch, squash or skew the photograph to make it fit.`,
    '- Grout: a continuous joint between every pair of tiles, forming a regular grid at exactly those intervals.',
    '- Edges and cuts: where a surface does not divide evenly, cut tiles at the perimeter, at internal corners and around fixtures, as a fitter would.',
    '- Corners: joints meet cleanly; the pattern turns a corner as two cut tiles, not one bent tile.',
    '- Perspective: the grid converges with the room geometry; tiles further away look smaller with joints closer together.',
    '- Scale: judge the tile against the fixtures and any human-scale element. A viewer must be able to tell this tile from one twice its size.',
  ].join('\n')
}

function sameSize(a: TileDimensions, b: TileDimensions): boolean {
  return a.lengthMm === b.lengthMm && a.breadthMm === b.breadthMm
}

function describeJoint(widthMm: number): string {
  const character =
    widthMm <= 1.5
      ? 'a very fine joint — the tiles read as almost butt-jointed, and the grid is subtle'
      : widthMm <= 3
        ? 'a fine, conventional joint — clearly visible but not a feature'
        : 'a wide, deliberate joint — the grid is part of the look'
  return `GROUT JOINT — ${widthMm} mm. This is ${character}. Even on every joint, in both directions.`
}

/**
 * Facts the application computed from the brief. None is a new choice and none
 * can contradict the brief: every line here is derived from it, which is why
 * they sit under their own heading and say so.
 */
function describeDerivedFacts(brief: GenerationBrief): string {
  const blocks: string[] = []

  blocks.push(describeTileGeometry('HIGHLIGHTER TILE GEOMETRY', brief.tiles.highlighter.sizeMm))
  const plainSize = brief.tiles.plain.sizeMm
  if (brief.tiles.plain.provided && plainSize) {
    blocks.push(
      sameSize(plainSize, brief.tiles.highlighter.sizeMm)
        ? `PLAIN TILE GEOMETRY — the plain tile is the same size as the highlighter, ${plainSize.lengthMm} mm x ${plainSize.breadthMm} mm, and the geometry above applies to it equally.`
        : describeTileGeometry('PLAIN TILE GEOMETRY (a different size from the highlighter)', plainSize),
    )
  }

  if (brief.installation.jointWidthMm !== null) {
    blocks.push(describeJoint(brief.installation.jointWidthMm))
  }

  blocks.push(renderApplicationMap(brief.placement.application))

  const room = getSpaceConfig(brief.placement.space.spaceId ?? brief.placement.space.name)
  if (room) {
    blocks.push(
      `ROOM CONTEXT — what a ${room.label.toLowerCase()} typically contains: ${room.environment} This is general background only: the subcategory and further options in the structured selections decide what is actually present, and where they differ they win.`,
    )
  }

  return [
    'DERIVED FACTS — computed by the application from the structured selections above. They explain the selections; they add no choices and change none.',
    '',
    blocks.join('\n\n'),
  ].join('\n')
}

/**
 * Camera viewpoints, cycling so a fourth concept is still a deliberate view.
 *
 * Camera only, and deliberately blind to surfaces. They refer to "the designated
 * tiled surfaces" and "the highlighter area" rather than naming a floor or a
 * wall, because which surfaces are tiled is decided by the placement and by
 * nothing else. The per-room viewpoints this replaced named surfaces ("bathroom
 * floor as the hero surface"), which for a wall application told the model to
 * tile a floor the application map says is not tiled.
 */
const CONCEPT_FOCUSES = [
  'A wide establishing view of the whole space at standing eye level, showing the designated tiled surfaces and the highlighter area in context.',
  'A closer three-quarter view that emphasises the highlighter area and the joint and laying-pattern detail, with the surrounding base surfaces still visible.',
  'A different angle on the same space — from another corner or a slightly raised viewpoint — showing how the highlighter area and the base surfaces relate to each other.',
]

function pickConceptFocus(brief: GenerationBrief): string {
  // The viewpoint, not the concept number: a correction keeps its parent's
  // camera unless the correction is about the camera.
  const index = brief.concept.viewpoint
  return CONCEPT_FOCUSES[((index % CONCEPT_FOCUSES.length) + CONCEPT_FOCUSES.length) % CONCEPT_FOCUSES.length]
}

/**
 * What this correction is, in words the model can act on.
 *
 * Derived from the brief's regeneration fields alone: what was wrong, what may
 * change, what must stay exactly as approved. It restates the approved
 * selections as a held constraint, so a correction is never a bare "do it
 * again" — it is the same request with one thing named as wrong.
 */
function describeRegeneration(brief: GenerationBrief): string {
  const { reasons, additionalInstruction, mayChange, mustKeep } = brief.regeneration
  const listAspects = (aspects: Aspect[]) => aspects.map((aspect) => `- ${ASPECT_TEXT[aspect]}`).join('\n')
  const named = mayChange.filter((scope): scope is Aspect => scope !== 'asWritten')
  const asWritten = (mayChange as ChangeScope[]).includes('asWritten')

  const lines: string[] = [
    'REGENERATION — this is a correction of an earlier concept, not a new design.',
    'Everything in the structured selections above is what the customer already approved. It is unchanged. This request differs only in what is named below.',
    '',
    `WHAT WAS WRONG: ${reasons.length ? reasons.map((reason) => reason.name).join(', ') : 'see the written correction'}.`,
  ]
  if (additionalInstruction) {
    lines.push(`THE SALESPERSON'S WRITTEN CORRECTION, verbatim: "${additionalInstruction}"`)
  }
  lines.push('', 'HOW TO CORRECT IT:')
  for (const reason of reasons) lines.push(`- ${ruleFor(reason).how}`)
  if (!reasons.length) {
    lines.push('- Follow the written correction exactly as written, and change only what it targets.')
  }
  if (named.length) lines.push('', 'YOU MAY CHANGE ONLY:', listAspects(named))
  if (asWritten) {
    lines.push(
      '',
      'AND whatever the written correction names, nothing beyond it. It can never change an approved selection.',
    )
  }
  lines.push('', 'KEEP EXACTLY AS APPROVED AND AS BEFORE:', listAspects(mustKeep))
  // "The fixtures as before" must not hold a bad bathroom layout in place: the
  // model never sees the earlier image, and the layout rule is not optional.
  if (isBathroom(brief) && mustKeep.includes('architecturalDesign')) {
    lines.push(
      '',
      'The BATHROOM LAYOUT above still applies in full. Keeping the fixtures as before never means keeping the WC in front of the vanity or crowded beside it.',
    )
  }
  return lines.join('\n')
}

/**
 * Whether this request is for a bathroom, read from the chosen chain: the root
 * space's own id, or any level named like one (washroom, powder room, toilet).
 */
function isBathroom(brief: GenerationBrief): boolean {
  if (brief.placement.space.spaceId === 'bathroom') return true
  return brief.placement.path.some((name) => /bath|wash\s?room|powder|toilet|\bwc\b/i.test(name))
}

/**
 * A concrete fixture plan for every bathroom request.
 *
 * The rule against a WC in front of the basin also lives in the system
 * instruction, but a rule buried in a long instruction, and phrased as what not
 * to do, was not enough: the model still put the WC in the open floor in front
 * of the vanity by default, while the same advice given in the request (as a
 * correction) was followed. So every bathroom request now carries the layout
 * itself, stated positively — where each fixture goes — beside the other facts.
 *
 * The WC goes on a different wall from the vanity (or a corner, the far end, or
 * behind a partition). An earlier version also allowed it "on the same wall as
 * the vanity, beside it with a clear gap", and the model took that option: the
 * WC moved from in front of the basin to crowded right next to it.
 * It arranges the room only; it never moves a tile or the highlighter location.
 */
function describeBathroomLayout(): string {
  return [
    'BATHROOM LAYOUT — arrange the fixtures exactly like this. This is a bathroom, and the layout is part of the request. Three separate zones: shower, vanity, WC.',
    '- VANITY ZONE: the vanity with the basin stands against one wall. The floor directly in front of it is kept clear for a person to stand, wash, open the vanity and step away.',
    '- WC ZONE: the WC stands on a DIFFERENT wall from the vanity — a side wall, a corner, or the far end of the room — or in a section set apart by a low partition. It faces into open floor, with clear space in front of it and at its sides.',
    '- The WC is never next to the vanity, touching it or squeezed into the space beside it, and never in the clear floor in front of the vanity or directly opposite the basin facing it.',
    '- SHOWER ZONE: if the room has a shower or a bath, it takes the far end or a corner, behind glass, with a clear way in, away from the WC and the vanity.',
    '- From the door there is a clear walking path to the vanity, the WC and the shower. Every fixture is wall-hung or floor-standing as a real installation would be.',
    'This arranges the fixtures only. The tiles, the surfaces they cover and the highlighter location stay exactly as the structured selections specify.',
  ].join('\n')
}

/**
 * Turns a brief into the model's ordered input.
 *
 * The brief is rendered, not flattened: the selections go in as one JSON object
 * with their structure intact, and each tile photograph is its own part,
 * directly after a label that names which tile it is — never merged, never left
 * to be guessed from order. When there is no plain tile the request says so
 * explicitly and sends no image, so a missing second image is a stated choice
 * and not something the model has to interpret as a fault.
 *
 * Pure: no lookups, no I/O, no photo data. The same brief always yields the
 * same plan, so a stored brief can be replayed exactly.
 */
export function buildModelRequest(brief: GenerationBrief): ModelRequestPlan {
  const conceptFocus = pickConceptFocus(brief)
  const parts: RequestPart[] = []

  parts.push({
    kind: 'text',
    text: [
      'GENERATION REQUEST',
      '',
      'STRUCTURED SELECTIONS — the authoritative record of what the customer chose, as JSON. Every explicit value here is a hard constraint. additionalInstructions is free text and is subordinate to every other field.',
      '',
      JSON.stringify(toModelView(brief), null, 2),
    ].join('\n'),
  })

  parts.push({ kind: 'text', text: describeDerivedFacts(brief) })
  if (isBathroom(brief)) parts.push({ kind: 'text', text: describeBathroomLayout() })

  parts.push({
    kind: 'text',
    text: [
      'REFERENCE IMAGE 1 — HIGHLIGHTER TILE.',
      'This is the highlighter tile (tiles.highlighter): the decorative / highlight product, used at placement.highlighterLocation only.',
      'Use only the tile in this photograph, not its background.',
      'Reproduce this tile exactly, down to its fine detail: minor pattern, small veins, texture, speckles, tonal variation and finish. Do not simplify it or invent a similar design.',
    ].join('\n'),
  })
  parts.push({ kind: 'image', tile: 'highlighter' })

  if (brief.tiles.plain.provided) {
    parts.push({
      kind: 'text',
      text: [
        'REFERENCE IMAGE 2 — PLAIN / BASE TILE.',
        'This is the plain tile (tiles.plain): the separate plain / base product. It is not the highlighter and the highlighter is not it.',
        'Use only the tile in this photograph, not its background.',
        'Reproduce this tile exactly, down to its fine detail: subtle texture, speckles, tonal variation and finish. A plain tile still has surface character; do not flatten it or invent one.',
      ].join('\n'),
    })
    parts.push({ kind: 'image', tile: 'plain' })
  } else {
    parts.push({
      kind: 'text',
      text: [
        'NO PLAIN TILE — tiles.plain.provided is false.',
        'The customer explicitly chose No Plain Tile, so there is no second reference image. This is intended, not an error. Do not invent a plain tile product and do not use the highlighter as one.',
      ].join('\n'),
    })
  }

  if (brief.regeneration.isRegeneration) {
    parts.push({ kind: 'text', text: describeRegeneration(brief) })
  }

  parts.push({
    kind: 'text',
    text: `CONCEPT FOCUS — concept ${brief.concept.index + 1}: ${conceptFocus}\n(This chooses the camera only. It never changes which surfaces are tiled.)`,
  })

  return { conceptFocus, parts }
}

/**
 * A readable listing of exactly what the model would receive, with each image
 * shown as a marker. For logs, the print-prompts script and tests — it is the
 * request itself, not a summary of it.
 */
export function describeModelRequest(plan: ModelRequestPlan): string {
  return plan.parts
    .map((part) =>
      part.kind === 'text' ? part.text : `[IMAGE PART — ${part.tile.toUpperCase()} TILE PHOTOGRAPH]`,
    )
    .join('\n\n')
}
