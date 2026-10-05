// Local-development copy of the correction checks, used by the Express server in
// server/. The deployed copy in client/api/_lib/ must stay identical.
// KEEP IN SYNC with client/api/_lib/correctionRequest.ts.

import { GenerateRequestError } from './generateRequest'
import { findActiveOption } from './designOptionsStore'
import { differingSelections, type GenerationBrief } from './generationBrief'
import { SOMETHING_ELSE_REASON_ID, regenerationScope } from './regenerationRules'
import { getRevision, type ConceptRevision } from './revisionsStore'
import type { OwnerScope } from './clientsStore'

/** A reason the showroom offers, as the correction needs it. */
export interface ResolvedReason {
  id: string
  name: string
  description: string
}

/**
 * What a request for "another concept" has turned into once it is checked.
 *
 * Null from `resolveCorrection` means the request is a first concept, which has
 * none of this.
 */
export interface ResolvedCorrection {
  parent: ConceptRevision
  /** The consultation the new concept joins: its parent's, so the chain stays one chain. */
  generationId: string
  reasons: ResolvedReason[]
  /** The salesperson's own words, trimmed and capped; null when they wrote none. */
  note: string | null
  /** The camera viewpoint: the parent's, unless the correction is about the camera. */
  viewpoint: number
}

/**
 * Checks a request for another concept and ties it to the concept it corrects.
 *
 * "Another concept" is never a vague "try again". It is the concept the
 * salesperson was looking at, plus what was wrong with it, and this is where
 * both are made real before a single billed call is made: the parent must exist
 * and be theirs, the reason must be one the showroom still offers, and "Something
 * Else" must say what is wrong.
 *
 * Returns null for a first concept — no parent, no reason, no note and concept
 * zero — so the first-generation path is untouched.
 */
export async function resolveCorrection(
  scope: OwnerScope,
  input: {
    parentRevisionId: unknown
    conceptIndex: unknown
    reasonIds: unknown
    revisionNote: unknown
  },
): Promise<ResolvedCorrection | null> {
  const parentId =
    typeof input.parentRevisionId === 'string' && input.parentRevisionId.trim()
      ? input.parentRevisionId.trim()
      : null
  const requestedReasons = Array.isArray(input.reasonIds) ? (input.reasonIds as unknown[]).slice(0, 8) : []
  const note =
    typeof input.revisionNote === 'string' && input.revisionNote.trim()
      ? input.revisionNote.trim().slice(0, 300)
      : null
  const laterConcept = typeof input.conceptIndex === 'number' && input.conceptIndex > 0

  if (!parentId && !laterConcept && requestedReasons.length === 0 && !note) return null

  if (!parentId) {
    throw new GenerateRequestError(
      'Another concept builds on the one you are looking at, and that concept could not be found. Please go back and generate again.',
    )
  }
  // Looked up through the owner scope, so a salesperson cannot build on a
  // concept that is not theirs.
  const parent = await getRevision(scope, parentId)
  if (!parent) {
    throw new GenerateRequestError('The concept to correct could not be found. Please generate it again.', 404)
  }

  const reasons: ResolvedReason[] = []
  for (const id of requestedReasons) {
    const option = await findActiveOption('reason', String(id))
    if (option && !reasons.some((existing) => existing.id === option.id)) {
      reasons.push({ id: option.id, name: option.name, description: option.description })
    }
  }
  if (reasons.length === 0 && !note) {
    throw new GenerateRequestError(
      'Say what should change: pick a reason from the list, or write the correction.',
    )
  }
  if (reasons.some((reason) => reason.id === SOMETHING_ELSE_REASON_ID) && !note) {
    throw new GenerateRequestError('Please write what you would like changed.')
  }

  const parentViewpoint = parent.context.brief?.concept.viewpoint ?? parent.context.brief?.concept.index ?? 0
  const { mayChange } = regenerationScope(reasons, note !== null)
  // Only a correction about the camera moves it. Otherwise fixing the tile
  // scale would also quietly change the angle the customer was looking from.
  const viewpoint = mayChange.includes('camera') ? parentViewpoint + 1 : parentViewpoint

  return { parent, generationId: parent.generationId, reasons, note, viewpoint }
}

/**
 * Refuses a correction whose approved selections differ from its parent's.
 *
 * What a correction may change is named by its reason; the customer's selections
 * are never among those things. A request that arrives with a different joint
 * width or a different highlighter location is a different brief, not a
 * correction, so it is refused before it is billed. Skipped when the parent has
 * no stored brief — a concept from before briefs were stored has nothing to be
 * held to.
 */
export function assertSelectionsUnchanged(parent: ConceptRevision, brief: GenerationBrief): void {
  const approved = parent.context.brief
  if (!approved) return
  const changed = differingSelections(approved, brief)
  if (changed.length > 0) {
    throw new GenerateRequestError(
      `This correction does not match the concept it corrects (${changed.join(', ')} differ). Start a new visualisation to change those.`,
      409,
    )
  }
}
