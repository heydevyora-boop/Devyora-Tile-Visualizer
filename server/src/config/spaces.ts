/**
 * Per-space application rules.
 *
 * Describes which surfaces a tile can realistically be applied to in each
 * space, what the surrounding environment should realistically contain, and
 * the three-concept variation strategy used to build genuinely different
 * renders for that space. Consumed by buildGenerationPrompt.ts.
 */

export type Surface = 'floor' | 'wall' | 'shower' | 'backsplash' | 'ceiling' | 'facade'

export interface SpaceConfig {
  /** Stable identifier used internally. */
  id: string
  /** Human-readable label, matching the values the client sends. */
  label: string
  /** Surfaces a tile can be applied to in this space. */
  surfaces: Surface[]
  /**
   * What the room should realistically contain: fixtures, furniture and
   * lighting appropriate to this space, so the render reads as a real,
   * lived-in environment rather than an empty tiled box.
   */
  environment: string
  /**
   * The three concepts generated for this space. Each entry focuses the
   * render on a different surface/viewpoint so the three results are
   * genuinely different concepts rather than three near-identical images.
   */
  variationStrategy: [string, string, string]
}

export const SPACES: Record<string, SpaceConfig> = {
  bathroom: {
    id: 'bathroom',
    label: 'Bathroom',
    surfaces: ['wall', 'shower', 'floor'],
    environment:
      'A modern bathroom fit-out: vanity unit with basin and tap, a mirror or mirrored cabinet, wall-mounted or recessed lighting, and either a shower enclosure or bath. Fixtures should read as realistic sanitaryware, not generic stock shapes.',
    variationStrategy: [
      'Full-height feature wall behind the vanity, seen straight on at standing eye level, with the tile running floor to ceiling as the hero surface.',
      'Walk-in shower enclosure, seen from the bathroom doorway, with the tile lining the shower walls and wet-room threshold.',
      'Bathroom floor as the hero surface, seen from a slightly elevated angle looking down across the room.',
    ],
  },
  bedroom: {
    id: 'bedroom',
    label: 'Bedroom',
    surfaces: ['floor'],
    environment:
      'A furnished bedroom: a made bed with headboard, bedside tables and lamps, soft window light, and a rug only if it does not obscure the tiled floor. No people.',
    variationStrategy: [
      'Bedroom floor seen from the doorway at standing eye level, tile running wall to wall beneath the bed.',
      'Bedroom floor seen at low camera height near the bed, emphasising the tile grain and joint lines in the foreground.',
      'Bedroom floor seen from a corner of the room in soft window light, showing the tile layout across the full span.',
    ],
  },
  'living-room': {
    id: 'living-room',
    label: 'Living Room',
    surfaces: ['floor', 'wall'],
    environment:
      'A furnished living room: a sofa and coffee table, ambient floor or pendant lighting, and a window or feature wall. Keep furniture realistic in scale and placement, not staged like a showroom set.',
    variationStrategy: [
      'Living room floor seen from the room entrance at standing eye level, tile spanning the full floor plane.',
      'Feature wall behind the main seating, seen straight on, with the tile running full height.',
      'Floor seen at a low, close camera angle across the seating area, emphasising tile scale and joint lines.',
    ],
  },
  kitchen: {
    id: 'kitchen',
    label: 'Kitchen',
    surfaces: ['floor', 'backsplash', 'wall'],
    environment:
      'A fitted kitchen: base and wall cabinetry, a worktop, a sink and tap, and appliances such as a hob or oven where relevant to the framing. Lighting should read as realistic under-cabinet or ceiling lighting.',
    variationStrategy: [
      'Kitchen floor as the hero surface, seen from the kitchen entrance at standing eye level.',
      'Backsplash run between the counter and the wall units, seen straight on and close, with the tile as the focal surface.',
      'Wider kitchen view combining floor and backsplash, seen from a corner at standing eye level.',
    ],
  },
  balcony: {
    id: 'balcony',
    label: 'Balcony',
    surfaces: ['floor'],
    environment:
      'A residential balcony: a railing or balustrade, potted plants or simple outdoor furniture, and visible daylight or a view beyond the railing. No interior elements.',
    variationStrategy: [
      'Balcony floor seen from the interior doorway looking outward, tile running to the railing in daylight.',
      'Balcony floor seen at a low, close camera angle, emphasising tile texture and joint lines against the railing base.',
      'Wider balcony view from an outside corner, showing the full tile layout with the railing and view beyond.',
    ],
  },
  terrace: {
    id: 'terrace',
    label: 'Terrace',
    surfaces: ['floor'],
    environment:
      'An outdoor terrace: patio furniture, planting at the edges, and open sky or a garden view beyond a low wall or balustrade. Natural daylight throughout.',
    variationStrategy: [
      'Terrace floor seen from the interior doorway looking out, tile running to the balustrade in daylight.',
      'Terrace floor seen at a low camera angle, emphasising the tile surface texture and slip-resistant finish.',
      'Wider terrace view from the far corner, showing the full tile layout under open sky.',
    ],
  },
  parking: {
    id: 'parking',
    label: 'Parking',
    surfaces: ['floor'],
    environment:
      'A parking area (garage or covered car park): structural columns, ceiling- or wall-mounted lighting typical of a car park, and painted line markings only if they do not compete with the tile as the hero surface. No vehicles blocking the tiled surface from view.',
    variationStrategy: [
      'Parking floor as the hero surface, seen from the entrance ramp at standing eye level with structural columns framing the view.',
      'Parking floor seen at a low camera angle between two columns, emphasising tile scale and joint lines under overhead lighting.',
      'Wider parking bay view seen from a corner, showing the full tile layout across multiple bays.',
    ],
  },
  staircase: {
    id: 'staircase',
    label: 'Staircase',
    surfaces: ['wall', 'floor'],
    environment:
      'An interior staircase: treads and risers forming the flight of stairs, a handrail or balustrade, and landing lighting. The tile should read correctly across both treads and risers where applicable, with realistic step proportions.',
    variationStrategy: [
      'Staircase seen from the base looking up the flight, tile visible across both treads and risers.',
      'Close view of three or four steps at a slight downward angle, emphasising tile joint lines on tread and riser edges.',
      'Staircase seen from the landing looking down the flight, showing the full run of tiled steps.',
    ],
  },
  entrance: {
    id: 'entrance',
    label: 'Entrance',
    surfaces: ['wall', 'floor'],
    environment:
      'A building or home entrance/foyer: an entry door, a console table or bench only if it does not obscure the floor, and natural or fixture lighting establishing a welcoming threshold.',
    variationStrategy: [
      'Entrance floor seen from just inside the doorway looking in, tile spanning the full threshold width.',
      'Entrance floor seen at a low camera angle close to the door, emphasising tile joint lines and texture at the threshold.',
      'Wider entrance/foyer view from a few steps inside, showing the tiled floor with the door and surrounding wall in frame.',
    ],
  },
  facade: {
    id: 'facade',
    label: 'Facade',
    surfaces: ['facade'],
    environment:
      'An exterior building facade in realistic outdoor conditions: natural daylight, visible sky, and context such as adjoining walls, windows or landscaping. The tile must read as a durable exterior cladding material with weather-appropriate realism — no interior lighting or indoor elements.',
    variationStrategy: [
      'Building facade seen straight on in flat daylight, tile cladding the primary elevation.',
      'Facade seen at an oblique three-quarter angle, showing how the tile wraps the corner and reveals depth.',
      'Close elevation detail at eye level, emphasising tile module, joint rhythm and surface texture.',
    ],
  },
}

/** Looks up a space config by the label the client sends (case-insensitive). */
export function getSpaceConfig(label: string): SpaceConfig | undefined {
  return Object.values(SPACES).find(
    (space) => space.label.toLowerCase() === label.trim().toLowerCase(),
  )
}
