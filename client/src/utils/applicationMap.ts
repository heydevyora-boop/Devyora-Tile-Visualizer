/**
 * The explicit tile-surface / application map — frontend copy.
 *
 * The identical algorithm as server/src/services/applicationMap.ts and
 * client/api/_lib/applicationMap.ts. This copy exists so the browser can put
 * the same structured, eight-field map into the generation request it sends
 * — not so the server ever trusts it: the server independently re-derives
 * its own copy from the space path it re-resolves from the database, the
 * same way it already never trusts the raw spacePath ids without checking
 * them. This copy is for the request payload and for anything the frontend
 * itself wants to show or log, never for the prompt.
 *
 * KEEP IN SYNC with server/src/services/applicationMap.ts and
 * client/api/_lib/applicationMap.ts.
 */

/** The minimum a catalogue node needs to be classified. */
export interface ApplicationPathNode {
  name: string
  description: string
}

export type SurfaceKind = 'wall' | 'floor' | 'wall-cladding' | 'tread-and-riser' | 'unclassified'

interface SurfaceClassification {
  kind: SurfaceKind
  label: string
}

/**
 * The showroom's own application names that mean a specific surface but
 * don't literally contain the word "Wall" or "Floor" — a shower enclosure,
 * a dado, a stair tread, cladding. Keyed on the exact name because that is
 * the only stable text a catalogue node carries; renaming one of these in
 * the admin panel means adding the new name here too, which is a visible,
 * deliberate edit rather than a silent drift.
 */
const NAMED_EXCEPTIONS: Record<string, SurfaceClassification> = {
  'Powder Washroom': { kind: 'wall', label: 'Wall' },
  'Bathroom with Shower Area': { kind: 'wall', label: 'Wall (shower enclosure)' },
  'Full Bathroom': { kind: 'wall', label: 'Wall' },
  'Kitchen Dado': { kind: 'wall', label: 'Wall (dado / backsplash band)' },
  'Stair Tread': { kind: 'tread-and-riser', label: 'Tread and Riser' },
  'Staircase Landing': { kind: 'floor', label: 'Floor' },
  'Facade Cladding': { kind: 'wall-cladding', label: 'Wall Cladding' },
}

/**
 * What surface an application node names — the one fact the rest of the map
 * is built from. Falls through, in order: a known exception by name, then
 * whichever of "floor" or "wall" the name itself contains (which is how the
 * showroom already names most of its own catalogue — "Living Floor", "TV
 * Wall"), and only when neither applies does this admit it does not know,
 * rather than guessing.
 */
function classifySurface(name: string): SurfaceClassification {
  const exception = NAMED_EXCEPTIONS[name]
  if (exception) return exception
  if (/floor/i.test(name)) return { kind: 'floor', label: 'Floor' }
  if (/wall/i.test(name)) return { kind: 'wall', label: 'Wall' }
  return {
    kind: 'unclassified',
    label: 'Not explicitly classified in the catalogue — treat as a general tiled surface and verify manually',
  }
}

const HEIGHT_NODE_NAMES = new Set(['Half Height', 'Full Height'])

export interface ApplicationMap {
  space: string
  subcategory: string | null
  tileApplication: string
  designatedTiledSurfaces: string
  tileHeight: string
  heightBehaviour: string
  /**
   * A structured list, not a sentence — each entry is one excluded surface,
   * rendered as its own bullet in the prompt. A prose sentence here is
   * exactly the kind of thing this whole map exists to replace: something
   * the model has to parse and hope it read correctly, rather than a plain
   * enumerated fact.
   */
  nonTiledSurfaces: string[]
  nonTiledMaterialRule: string
}

/**
 * Builds the explicit map from a resolved application chain, root first.
 *
 * A height node ("Half Height" / "Full Height") never names a surface of
 * its own — it modifies whichever node came before it, so classification
 * reads that parent, not the height node's own name.
 */
export function buildApplicationMap(path: ApplicationPathNode[]): ApplicationMap {
  const space = path[0]?.name ?? ''
  const subcategory = path[1]?.name ?? null

  const heightIndex = path.findIndex((node) => HEIGHT_NODE_NAMES.has(node.name))
  const heightNode = heightIndex >= 0 ? path[heightIndex] : null
  const surfaceNode = heightNode ? path[heightIndex - 1] : path[path.length - 1]
  const classification = classifySurface(surfaceNode?.name ?? '')
  const surfaceLabel = surfaceNode?.name ?? subcategory ?? space

  const tileHeight = heightNode?.name ?? 'Full Coverage'

  // Named again only when it says something the SUBCATEGORY line above
  // didn't already — for the common two- or three-level path the surface
  // node IS the subcategory, and repeating it would be noise.
  const surfaceAside = surfaceLabel !== subcategory ? ` (${surfaceLabel})` : ''
  const designatedTiledSurfaces =
    classification.kind === 'floor'
      ? `The ${space.toLowerCase()} floor as selected${surfaceAside}.`
      : classification.kind === 'tread-and-riser'
        ? 'The staircase treads and risers as selected.'
        : `${space} wall surfaces included in the selected wall treatment${surfaceAside}.`

  // Wall-like applications with no chosen height still cover their whole
  // designated surface, but that is a distinct fact from Half/Full Height
  // and is worded to say so explicitly — a floor, tread or cladding
  // application is a different distinction again, and gets told outright
  // that a wall's height rule does not apply to it, rather than leaving
  // that absence to be inferred from the field simply not appearing.
  const isWallLike = classification.kind === 'wall' || classification.kind === 'wall-cladding'
  const heightBehaviour =
    tileHeight === 'Half Height'
      ? [
          'Consistent half-height/dado level across every designated tiled wall,',
          'holding that exact same height around every corner — never a taller or',
          'shorter stopping point on a different wall. The supplied tile appears',
          'only below this line; do not extend it above the line under any',
          'circumstance, and do not treat this as a full-height instruction. Above',
          'the line, every designated wall uses a different, complementary finish',
          '— paint or plaster, never the supplied tile.',
        ].join(' ')
      : tileHeight === 'Full Height'
        ? [
            'Tile continues, uninterrupted, from floor to ceiling on every',
            'designated tiled wall — no painted band, no stopping point, and no',
            'partial coverage on any designated wall. Do not treat this as a',
            'half-height or partial-coverage instruction.',
          ].join(' ')
        : isWallLike
          ? [
              'Tile covers the entire designated wall surface, with no',
              'partial-height boundary. Do not invent a stopping point that was',
              'not selected.',
            ].join(' ')
          : [
              'Full coverage of the designated surface. Height/coverage boundaries',
              '(half-height, full-height) are a wall concept and do not apply here.',
            ].join(' ')

  // Fixtures a room actually has. A Living Room's TV Wall has no vanity to
  // list, and listing one would be a stray, meaningless instruction rather
  // than a safeguard — so this is asked per space, not assumed for every
  // wall application.
  const spaceLower = space.toLowerCase()
  const fixtures = [
    ...(spaceLower === 'bathroom' ? ['Vanity'] : []),
    ...(spaceLower === 'bathroom' || spaceLower === 'kitchen' ? ['Countertop'] : []),
  ]

  const nonTiledSurfaces: string[] =
    classification.kind === 'floor'
      ? ['Walls', 'Ceiling', ...fixtures, 'Other non-designated surfaces']
      : classification.kind === 'tread-and-riser'
        ? ['Walls', 'Any floor area not part of the stair run', 'Ceiling', 'Other non-designated surfaces']
        : ['Floor', 'Ceiling', ...fixtures, 'Other non-designated surfaces']

  const nonTiledMaterialRule =
    'Use a different, complementary material on every non-tiled surface. Never reuse the supplied tile there.'

  return {
    space,
    subcategory,
    tileApplication: classification.label,
    designatedTiledSurfaces,
    tileHeight,
    heightBehaviour,
    nonTiledSurfaces,
    nonTiledMaterialRule,
  }
}

/** The map, as the eight-field block the generation prompt actually reads. */
export function renderApplicationMap(map: ApplicationMap): string {
  return [
    'EXPLICIT APPLICATION MAP — these eight facts are not for you to',
    'interpret or re-derive from the chain below; they are the answer.',
    '',
    `SPACE: ${map.space}`,
    map.subcategory ? `SUBCATEGORY: ${map.subcategory}` : null,
    `TILE APPLICATION: ${map.tileApplication}`,
    '',
    'DESIGNATED TILED SURFACES:',
    map.designatedTiledSurfaces,
    '',
    `TILE HEIGHT: ${map.tileHeight}`,
    '',
    'HEIGHT BEHAVIOUR:',
    map.heightBehaviour,
    '',
    'NON-TILED SURFACES:',
    ...map.nonTiledSurfaces.map((surface) => `- ${surface}`),
    '',
    'NON-TILED MATERIAL RULE:',
    map.nonTiledMaterialRule,
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}
