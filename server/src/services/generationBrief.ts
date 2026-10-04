// Local-development copy of the generation brief, used by the Express server in
// server/. The deployed copy in client/api/_lib/ must stay identical.
// KEEP IN SYNC with client/api/_lib/generationBrief.ts.
import { buildApplicationMap, type ApplicationMap } from './applicationMap'
import type { TileDimensions } from './generateRequest'

/** A catalogue entry the customer chose, carried with the id it has in the showroom's list. */
export interface BriefOption {
  id: string
  name: string
  description: string
}

/** The root category, which also knows which curated per-room configuration it maps to. */
export interface BriefSpace extends BriefOption {
  spaceId: string | null
}

/**
 * Everything the customer selected for ONE generation, as separate, typed
 * values — the record of what was asked, before any of it is turned into words.
 *
 * This is the application's own data model for a request. The model is given it
 * (see buildGenerationPrompt.ts), but it is not derived from the model's input:
 * the text the model reads is rendered from this object, never the other way
 * round, and this object is what is logged and stored against the concept so
 * that exactly what was selected can be inspected afterwards.
 *
 * It holds no images. The tile photos are separate inputs; the brief only says
 * whether each exists and how big it is.
 */
export interface GenerationBrief {
  schemaVersion: 1
  tiles: {
    /** The decorative / accent product. Always present. Reference image 1. */
    highlighter: { sizeMm: TileDimensions }
    /**
     * The plain / base product. `provided: false` is the explicit "No Plain
     * Tile" choice — a decision the model is told about, not an absence it has
     * to interpret. `sizeMm` is null exactly when there is no plain tile.
     */
    plain: { provided: boolean; sizeMm: TileDimensions | null }
  }
  placement: {
    /** Root category — Bathroom, Kitchen, Terrace… */
    space: BriefSpace
    /** The level below it — Powder Washroom, Kitchen Dado… Null if the chain stops at the root. */
    subcategory: BriefOption | null
    /** Every level below the subcategory, in order — Half Height, and anything deeper. */
    furtherOptions: BriefOption[]
    /** The chain as names, root first, for reading a stored brief at a glance. */
    path: string[]
    /** The application, classified once by the application, not left to be inferred. */
    application: ApplicationMap
    /** Where the highlighter tile is used. A hard architectural input. */
    highlighterLocation: BriefOption
  }
  installation: {
    /** Millimetres, exactly as chosen or typed. Null when none was specified. */
    jointWidthMm: number | null
    /** The showroom preset it came from ("2 mm"), or null for a typed-in width. */
    jointPreset: string | null
    layingPattern: BriefOption | null
  }
  /** Free text from the salesperson. Subordinate to everything structured above. */
  additionalInstructions: string | null
  regeneration: {
    isRegeneration: boolean
    reasons: BriefOption[]
    note: string | null
    /** Stored for traceability. Not shown to the model — an id means nothing to it. */
    parentRevisionId: string | null
  }
  concept: {
    /** Which concept of the consultation this is, from zero. */
    index: number
  }
}

/** What the route has resolved and verified by the time it builds a brief. */
export interface BriefSource {
  highlighterDimensions: TileDimensions
  plainTileProvided: boolean
  plainDimensions: TileDimensions | null
  /** The verified application chain, root first. */
  path: { id: string; name: string; description: string; spaceId: string | null }[]
  highlighterLocation: BriefOption
  jointWidthMm?: number | null
  jointPreset?: string | null
  layingPattern?: BriefOption | null
  additionalInstructions?: string | null
  reasons?: BriefOption[]
  note?: string | null
  parentRevisionId?: string | null
  conceptIndex?: number
}

const toOption = ({ id, name, description }: BriefOption): BriefOption => ({ id, name, description })

/**
 * Assembles the brief from already-verified selections.
 *
 * Pure: no lookups, no I/O. Everything it is given has been checked against the
 * showroom's catalogue by the route, so this only arranges it — and refuses to
 * arrange something that contradicts itself, because a contradiction here would
 * reach the model as two hard constraints that cannot both be met.
 */
export function buildGenerationBrief(source: BriefSource): GenerationBrief {
  if (source.path.length === 0) {
    throw new Error('A generation brief needs a placement: the application chain is empty.')
  }
  if (source.plainTileProvided !== (source.plainDimensions !== null)) {
    throw new Error('A plain tile size is required exactly when a plain tile is provided.')
  }

  const [root, subcategory, ...furtherOptions] = source.path
  const reasons = (source.reasons ?? []).map(toOption)
  const note = source.note?.trim() || null
  const instructions = source.additionalInstructions?.trim() || null
  const joint = source.jointWidthMm ?? null

  return {
    schemaVersion: 1,
    tiles: {
      highlighter: { sizeMm: { ...source.highlighterDimensions } },
      plain: {
        provided: source.plainTileProvided,
        sizeMm: source.plainDimensions ? { ...source.plainDimensions } : null,
      },
    },
    placement: {
      space: { ...toOption(root), spaceId: root.spaceId },
      subcategory: subcategory ? toOption(subcategory) : null,
      furtherOptions: furtherOptions.map(toOption),
      path: source.path.map((node) => node.name),
      application: buildApplicationMap(source.path),
      highlighterLocation: toOption(source.highlighterLocation),
    },
    installation: {
      jointWidthMm: joint,
      jointPreset: joint === null ? null : source.jointPreset ?? null,
      layingPattern: source.layingPattern ? toOption(source.layingPattern) : null,
    },
    additionalInstructions: instructions,
    regeneration: {
      isRegeneration: reasons.length > 0 || note !== null,
      reasons,
      note,
      parentRevisionId: source.parentRevisionId ?? null,
    },
    concept: { index: Math.max(0, Math.trunc(source.conceptIndex ?? 0)) },
  }
}

/**
 * The brief as the model reads it: everything the customer selected, minus what
 * means nothing to a model (the revision id it descends from).
 */
export function toModelView(brief: GenerationBrief): Omit<GenerationBrief, 'regeneration'> & {
  regeneration: Omit<GenerationBrief['regeneration'], 'parentRevisionId'>
} {
  const { parentRevisionId: _omitted, ...regeneration } = brief.regeneration
  return { ...brief, regeneration }
}
