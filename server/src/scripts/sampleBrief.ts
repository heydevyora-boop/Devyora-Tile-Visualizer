/**
 * Builds a GenerationBrief from command-line flags, for the two dev scripts.
 *
 * No database: the application chain is assembled from the names given, with
 * placeholder ids. Real requests get verified catalogue nodes from the route;
 * this exists so a brief — and the request rendered from it — can be inspected
 * without a server or a single API call.
 */
import { buildGenerationBrief, type GenerationBrief } from '../services/generationBrief'

export interface SampleFlags {
  [flag: string]: string | undefined
}

/** Reads `--name value` pairs. Anything else is ignored. */
export function readFlags(argv: string[]): SampleFlags {
  const flags: SampleFlags = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[i + 1]
  }
  return flags
}

function parseSize(value: string): { lengthMm: number; breadthMm: number } {
  const match = value.match(/^(\d+)\s*[x×]\s*(\d+)$/i)
  if (!match) throw new Error(`Size must look like 1200x600, got "${value}"`)
  return { lengthMm: Number(match[1]), breadthMm: Number(match[2]) }
}

export const USAGE = `Flags (all optional):
  --space "Bathroom"  --sub "Powder Washroom"  --further "Half Height"
  --location "Basin / Vanity"   (Basin / Vanity | Shower Area | Plain Wall)
  --size 1200x600               highlighter tile size, mm
  --plain none | 600x600        a plain tile of that size, or No Plain Tile
  --joint 2                     joint width in mm (omit for none)
  --pattern "Straight / Grid"   or "Running Bond / Brick"
  --notes "Keep the vanity floating."
  --concept 0                   which concept, from zero
  --reason tile-scale           make it a correction: tile-placement | overall-look | tile-scale |
                                tile-coverage | colour-material-combination | composition | something-else
  --correction "Make it less busy."   the salesperson's written correction`

const REASON_NAMES: Record<string, string> = {
  'tile-placement': 'Tile Placement',
  'overall-look': 'Overall Look',
  'tile-scale': 'Tile Scale',
  'tile-coverage': 'Tile Coverage',
  'colour-material-combination': 'Colour / Material Combination',
  composition: 'Composition',
  'something-else': 'Something Else',
}

export function sampleBrief(flags: SampleFlags): GenerationBrief {
  const names = [flags.space ?? 'Bathroom', flags.sub ?? 'Powder Washroom', flags.further ?? 'Half Height']
  const plainFlag = flags.plain ?? 'none'
  const highlighter = parseSize(flags.size ?? '1200x600')
  const plainProvided = plainFlag !== 'none'
  const pattern = flags.pattern ?? 'Straight / Grid'
  const joint = flags.joint !== undefined ? Number(flags.joint) : null

  return buildGenerationBrief({
    highlighterDimensions: highlighter,
    plainTileProvided: plainProvided,
    plainDimensions: plainProvided ? parseSize(plainFlag) : null,
    path: names.map((name, level) => ({
      id: `sample:${level}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      description: '',
      spaceId: level === 0 ? name.toLowerCase() : null,
    })),
    highlighterLocation: {
      id: 'sample:highlighter-location',
      name: flags.location ?? 'Basin / Vanity',
      description: 'The highlighter tile is used exactly here, and stays here.',
    },
    jointWidthMm: joint,
    jointPreset: joint === null ? null : `${joint} mm`,
    layingPattern: { id: `sample:pattern:${pattern.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: pattern, description: '' },
    additionalInstructions: flags.notes ?? null,
    conceptIndex: Number(flags.concept ?? 0),
    reasons: flags.reason
      ? [{ id: `seed:reason:${flags.reason}`, name: REASON_NAMES[flags.reason] ?? flags.reason, description: '' }]
      : [],
    additionalInstruction: flags.correction ?? null,
    parentRevisionId: flags.reason || flags.correction ? 'sample:parent' : null,
  })
}
