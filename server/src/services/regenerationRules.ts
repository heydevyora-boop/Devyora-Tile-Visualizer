// Local-development copy of the regeneration rules, used by the Express server
// in server/. The deployed copy in client/api/_lib/ must stay identical.
// KEEP IN SYNC with client/api/_lib/regenerationRules.ts.
/**
 * The things a concept is made of, named once so a correction can say exactly
 * which of them it may touch and which it must leave alone.
 *
 * The first eight are approved selections: the customer chose them, and no
 * correction may change them. The rest are not selections — they are how the
 * room happened to be drawn — and a correction may change the ones it targets.
 */
export type Aspect =
  | 'tileIdentity'
  | 'tileDimensions'
  | 'plainTileState'
  | 'spaceAndApplication'
  | 'highlighterLocation'
  | 'joint'
  | 'layingPattern'
  | 'additionalInstructions'
  | 'tilePlacement'
  | 'tileCoverage'
  | 'visualScale'
  | 'surroundingMaterials'
  | 'architecturalDesign'
  | 'camera'

/** What a correction is allowed to change: named aspects, or "whatever the written correction targets". */
export type ChangeScope = Aspect | 'asWritten'

/** Approved selections. These never change, whatever a correction is about. */
export const APPROVED_ASPECTS: Aspect[] = [
  'tileIdentity',
  'tileDimensions',
  'plainTileState',
  'spaceAndApplication',
  'highlighterLocation',
  'joint',
  'layingPattern',
  'additionalInstructions',
]

export const ALL_ASPECTS: Aspect[] = [
  ...APPROVED_ASPECTS,
  'tilePlacement',
  'tileCoverage',
  'visualScale',
  'surroundingMaterials',
  'architecturalDesign',
  'camera',
]

/** Plain-language meaning of each aspect, as the model is told it. */
export const ASPECT_TEXT: Record<Aspect, string> = {
  tileIdentity: 'the supplied tiles themselves — colour, pattern, texture, finish, veins and grain; neither tile is replaced or altered',
  tileDimensions: 'the exact tile dimensions',
  plainTileState: 'whether a plain tile is supplied, or No Plain Tile was chosen',
  spaceAndApplication: 'the space, subcategory, further options, application, tiled surfaces and height',
  highlighterLocation: 'where the highlighter tile is used',
  joint: 'the joint width',
  layingPattern: 'the laying pattern',
  additionalInstructions: 'the additional instructions',
  tilePlacement: 'which surface carries which tile, and where the tile sits on it',
  tileCoverage: 'how much of each designated surface the tile covers',
  visualScale: 'the apparent scale of the tiles in the view (always within the exact dimensions)',
  surroundingMaterials: 'the surrounding non-tile materials, colours and finishes',
  architecturalDesign: 'the furniture, fixtures, lighting and accessories',
  camera: 'the camera viewpoint and framing',
}

interface ReasonRule {
  /** What this correction may touch. Everything else is held exactly as it was. */
  mayChange: ChangeScope[]
  /** The instruction for this reason, stated as an action and its limit. */
  how: string
}

/** Id of the seeded "Something Else" reason, whose written correction is the whole instruction. */
export const SOMETHING_ELSE_REASON_ID = 'seed:reason:something-else'

/**
 * Reasons that have been removed from the product. "Style" went when Design Style
 * did: there is no style to correct, and offering the reason would invite one back.
 */
export const RETIRED_REASON_IDS = ['seed:reason:style']

/**
 * The rule for each seeded reason, keyed by its seed id.
 *
 * Keyed by id and not by name because the showroom can rename a reason; the
 * behaviour belongs to what the reason is, not to what it is currently called.
 */
const RULES: Record<string, ReasonRule> = {
  'seed:reason:tile-placement': {
    mayChange: ['tilePlacement'],
    how: 'TILE PLACEMENT — correct only where and how the tile is applied, so that it matches placement.application and placement.highlighterLocation exactly. Do not change the tile size, the joint, the pattern or the room around it.',
  },
  'seed:reason:overall-look': {
    mayChange: ['architecturalDesign', 'surroundingMaterials'],
    how: 'OVERALL LOOK — improve the overall architectural design of the room: its furniture, fixtures, lighting and secondary materials. Keep every approved structured tile requirement exactly as it is. Do not introduce a design style: there is none, and none is to be inferred or invented.',
  },
  'seed:reason:tile-scale': {
    mayChange: ['visualScale'],
    how: 'TILE SCALE — correct the visual scale of the tiles so it matches the exact dimensions in tiles.*.sizeMm. Do not change the tile placement, the surfaces that are tiled, or the room.',
  },
  'seed:reason:tile-coverage': {
    mayChange: ['tileCoverage'],
    how: 'TILE COVERAGE — correct how much of each designated surface receives the tile, within the surfaces and height the application authorises. Do not change the tile size, the joint, the pattern or the room.',
  },
  'seed:reason:colour-material-combination': {
    mayChange: ['surroundingMaterials'],
    how: 'COLOUR / MATERIAL COMBINATION — change only the surrounding materials and colours. The supplied tiles stay exactly as they are, and so does where they are placed.',
  },
  'seed:reason:composition': {
    mayChange: ['camera'],
    how: 'COMPOSITION — improve the view and framing only: viewpoint, camera angle and arrangement in frame. Every approved requirement, and what is tiled where, stays as it was.',
  },
  [SOMETHING_ELSE_REASON_ID]: {
    mayChange: ['asWritten'],
    how: 'SOMETHING ELSE — follow the written correction in regeneration.additionalInstruction, exactly as written, and change only what it targets.',
  },
}

/** What a reason the showroom added itself is held to: its own words, and nothing wider. */
function customRule(reason: { name: string; description: string }): ReasonRule {
  return {
    mayChange: ['asWritten'],
    how: `${reason.name.toUpperCase()} — ${reason.description || 'follow the written correction'}. Change only what this correction targets and hold everything else exactly as it was.`,
  }
}

export function ruleFor(reason: { id: string; name: string; description: string }): ReasonRule {
  return RULES[reason.id] ?? customRule(reason)
}

export interface RegenerationScope {
  mayChange: ChangeScope[]
  mustKeep: Aspect[]
  /** One instruction per reason, plus the written correction if there is one. */
  how: string[]
}

/**
 * What a correction may change, and what it must hold still.
 *
 * Several reasons can be chosen at once, so the allowance is their union: a
 * correction about both scale and colour may touch both, and nothing else. The
 * approved selections are never in the allowance, whatever the reason.
 *
 * A written correction on its own — no reason chosen — is held to the same rule
 * as "Something Else": it may change whatever it names, and the approved
 * selections still stand.
 */
export function regenerationScope(
  reasons: { id: string; name: string; description: string }[],
  hasWrittenCorrection: boolean,
): RegenerationScope {
  const rules = reasons.map(ruleFor)
  if (rules.length === 0 && hasWrittenCorrection) rules.push(RULES[SOMETHING_ELSE_REASON_ID])

  const mayChange = [...new Set(rules.flatMap((rule) => rule.mayChange))]
  const open = (aspect: Aspect) => mayChange.includes(aspect)
  const asWritten = mayChange.includes('asWritten')

  // Named aspects are held unless a reason names them. A written correction
  // opens the room-level aspects it might name, but never an approved selection.
  const mustKeep = ALL_ASPECTS.filter((aspect) => {
    if (open(aspect)) return false
    if (asWritten && !APPROVED_ASPECTS.includes(aspect)) return false
    return true
  })

  const how = rules.map((rule) => rule.how)
  return { mayChange, mustKeep, how }
}
