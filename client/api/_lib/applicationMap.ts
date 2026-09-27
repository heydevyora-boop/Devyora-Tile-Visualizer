// Deployed copy of the application-map classifier used by the Vercel
// serverless function in client/api/generate.ts. Vercel only uploads files
// under the project Root Directory (client/), so this cannot import from
// ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/services/.
/**
 * The explicit tile-surface / application map.
 *
 * A chosen application is a chain of catalogue nodes — Bathroom -> Powder
 * Washroom -> Half Height — and until now the model was handed that chain as
 * a paragraph and left to work out from it whether the tile belongs on a
 * wall or a floor, and whether "Half Height" means anything for a floor
 * application at all. It usually got this right, which is exactly the
 * problem: "usually" is not a guarantee, and a wrong guess here means a
 * generated room with the tile somewhere the customer never chose.
 *
 * This turns the same chain into eight explicit, named facts instead —
 * SPACE, SUBCATEGORY, TILE APPLICATION, DESIGNATED TILED SURFACES, TILE
 * HEIGHT, HEIGHT BEHAVIOUR, NON-TILED SURFACES, NON-TILED MATERIAL RULE —
 * computed once, deterministically, by this code rather than left for the
 * model to infer from prose. It reads no new data: every catalogue node
 * already carries the name and description this classifies, so an existing
 * showroom's catalogue produces a correct map with nothing to migrate.
 *
 * This is the authoritative copy: the one the actual generation call uses.
 * client/src/utils/applicationMap.ts is the frontend's own copy of the same
 * algorithm, used to build the map the browser sends as part of the request
 * — the server never trusts that copy for the prompt, the same way it never
 * trusts the raw spacePath ids without re-resolving them itself.
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
  nonTiledSurfaces: string
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

  const heightBehaviour =
    tileHeight === 'Half Height'
      ? 'Consistent half-height/dado level across every designated tiled wall, holding that same height around every corner.'
      : tileHeight === 'Full Height'
        ? 'Tile continues to the ceiling on every designated tiled wall — no painted band above it anywhere.'
        : 'Full coverage of the designated surface. No partial-height boundary applies.'

  const nonTiledSurfaces =
    classification.kind === 'floor'
      ? 'Walls, ceiling, and all other surfaces.'
      : classification.kind === 'tread-and-riser'
        ? 'Walls, any floor area not part of the stair run, ceiling, and all other surfaces.'
        : 'Floor, ceiling, vanity/countertop where present, and all surfaces not named above.'

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
    map.nonTiledSurfaces,
    '',
    'NON-TILED MATERIAL RULE:',
    map.nonTiledMaterialRule,
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}
