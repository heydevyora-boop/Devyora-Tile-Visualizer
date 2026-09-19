/**
 * Per-space application rules.
 *
 * Describes which surfaces a tile can realistically be applied to in each
 * space. Not wired into the generate flow yet — scaffolding for when the
 * real AI generation needs to build space-aware prompts.
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
    variationStrategy: [
      'Bedroom floor seen from the doorway at standing eye level, tile running wall to wall beneath the bed.',
      'Bedroom floor seen at low camera height near the bed, emphasising the tile grain and joint lines in the foreground.',
      'Bedroom floor seen from a corner of the room in soft window light, showing the tile layout across the full span.',
    ],
  },
  kitchen: {
    id: 'kitchen',
    label: 'Kitchen',
    surfaces: ['floor', 'backsplash', 'wall'],
    variationStrategy: [
      'Kitchen floor as the hero surface, seen from the kitchen entrance at standing eye level.',
      'Backsplash run between the counter and the wall units, seen straight on and close, with the tile as the focal surface.',
      'Wider kitchen view combining floor and backsplash, seen from a corner at standing eye level.',
    ],
  },
  'living-room': {
    id: 'living-room',
    label: 'Living Room',
    surfaces: ['floor', 'wall'],
    variationStrategy: [
      'Living room floor seen from the room entrance at standing eye level, tile spanning the full floor plane.',
      'Feature wall behind the main seating, seen straight on, with the tile running full height.',
      'Floor seen at a low, close camera angle across the seating area, emphasising tile scale and joint lines.',
    ],
  },
  terrace: {
    id: 'terrace',
    label: 'Terrace',
    surfaces: ['floor'],
    variationStrategy: [
      'Terrace floor seen from the interior doorway looking out, tile running to the balustrade in daylight.',
      'Terrace floor seen at a low camera angle, emphasising the tile surface texture and slip-resistant finish.',
      'Wider terrace view from the far corner, showing the full tile layout under open sky.',
    ],
  },
  facade: {
    id: 'facade',
    label: 'Facade',
    surfaces: ['facade', 'wall'],
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
