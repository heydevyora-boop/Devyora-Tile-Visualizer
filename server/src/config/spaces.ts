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
}

export const SPACES: Record<string, SpaceConfig> = {
  bathroom: {
    id: 'bathroom',
    label: 'Bathroom',
    surfaces: ['wall', 'shower', 'floor'],
  },
  bedroom: {
    id: 'bedroom',
    label: 'Bedroom',
    surfaces: ['floor'],
  },
  kitchen: {
    id: 'kitchen',
    label: 'Kitchen',
    surfaces: ['floor', 'backsplash', 'wall'],
  },
  'living-room': {
    id: 'living-room',
    label: 'Living Room',
    surfaces: ['floor', 'wall'],
  },
  terrace: {
    id: 'terrace',
    label: 'Terrace',
    surfaces: ['floor'],
  },
  facade: {
    id: 'facade',
    label: 'Facade',
    surfaces: ['facade', 'wall'],
  },
}

/** Looks up a space config by the label the client sends (case-insensitive). */
export function getSpaceConfig(label: string): SpaceConfig | undefined {
  return Object.values(SPACES).find(
    (space) => space.label.toLowerCase() === label.trim().toLowerCase(),
  )
}
