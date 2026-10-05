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
  /**
   * Surfaces a tile can realistically be applied to in this space.
   * Not read when a request is built: the placement the customer selected, and
   * the application map derived from it, decide which surfaces are tiled.
   */
  surfaces: Surface[]
  /**
   * What the room should realistically contain: fixtures, furniture and
   * lighting appropriate to this space, so the render reads as a real,
   * lived-in environment rather than an empty tiled box.
   */
  environment: string
}

export const SPACES: Record<string, SpaceConfig> = {
  bathroom: {
    id: 'bathroom',
    label: 'Bathroom',
    surfaces: ['wall', 'shower', 'floor'],
    environment:
      'A modern bathroom fit-out: vanity unit with basin and tap, a mirror or mirrored cabinet, wall-mounted or recessed lighting, and either a shower enclosure or bath. Fixtures should read as realistic sanitaryware, not generic stock shapes.',
  },
  bedroom: {
    id: 'bedroom',
    label: 'Bedroom',
    surfaces: ['floor'],
    environment:
      'A furnished bedroom: a made bed with headboard, bedside tables and lamps, soft window light, and a rug only if it does not obscure the tiled floor. No people.',
  },
  'living-room': {
    id: 'living-room',
    label: 'Living Room',
    surfaces: ['floor', 'wall'],
    environment:
      'A furnished living room: a sofa and coffee table, ambient floor or pendant lighting, and a window or feature wall. Keep furniture realistic in scale and placement, not staged like a showroom set.',
  },
  kitchen: {
    id: 'kitchen',
    label: 'Kitchen',
    surfaces: ['floor', 'backsplash', 'wall'],
    environment:
      'A fitted kitchen: base and wall cabinetry, a worktop, a sink and tap, and appliances such as a hob or oven where relevant to the framing. Lighting should read as realistic under-cabinet or ceiling lighting.',
  },
  balcony: {
    id: 'balcony',
    label: 'Balcony',
    surfaces: ['floor'],
    environment:
      'A residential balcony: a railing or balustrade, potted plants or simple outdoor furniture, and visible daylight or a view beyond the railing. No interior elements.',
  },
  terrace: {
    id: 'terrace',
    label: 'Terrace',
    surfaces: ['floor'],
    environment:
      'An outdoor terrace: patio furniture, planting at the edges, and open sky or a garden view beyond a low wall or balustrade. Natural daylight throughout.',
  },
  parking: {
    id: 'parking',
    label: 'Parking',
    surfaces: ['floor'],
    environment:
      'A parking area (garage or covered car park): structural columns, ceiling- or wall-mounted lighting typical of a car park, and painted line markings only if they do not compete with the tile as the hero surface. No vehicles blocking the tiled surface from view.',
  },
  staircase: {
    id: 'staircase',
    label: 'Staircase',
    surfaces: ['wall', 'floor'],
    environment:
      'An interior staircase: treads and risers forming the flight of stairs, a handrail or balustrade, and landing lighting. The tile should read correctly across both treads and risers where applicable, with realistic step proportions.',
  },
  entrance: {
    id: 'entrance',
    label: 'Entrance',
    surfaces: ['wall', 'floor'],
    environment:
      'A building or home entrance/foyer: an entry door, a console table or bench only if it does not obscure the floor, and natural or fixture lighting establishing a welcoming threshold.',
  },
  facade: {
    id: 'facade',
    label: 'Facade',
    surfaces: ['facade'],
    environment:
      'An exterior building facade in realistic outdoor conditions: natural daylight, visible sky, and context such as adjoining walls, windows or landscaping. The tile must read as a durable exterior cladding material with weather-appropriate realism — no interior lighting or indoor elements.',
  },
}

/** Looks up a space config by the label the client sends (case-insensitive). */
export function getSpaceConfig(label: string): SpaceConfig | undefined {
  return Object.values(SPACES).find(
    (space) => space.label.toLowerCase() === label.trim().toLowerCase(),
  )
}
