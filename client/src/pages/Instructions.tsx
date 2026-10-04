import { useFlow } from '../state/FlowContext'
import FlowStep from '../components/FlowStep'

/** The longest a free-text instruction may be, matching the server's limit. */
const MAX_REQUIREMENT = 300

/**
 * Anything the customer asked for that the fixed choices do not cover.
 *
 * Optional, free text, and kept as its own field all the way to the backend —
 * never merged into another choice or into a prompt on this side.
 */
function Instructions() {
  const { additionalRequirement, setAdditionalRequirement } = useFlow()

  return (
    <FlowStep
      title="Instructions"
      step="Step 07 / 08"
      backTo="/pattern"
      heading="Additional instructions"
      lede="Optional. Anything the customer asked for that the earlier steps did not cover."
      continueTo="/summary"
      canContinue
    >
      <div className="px-margin flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5">
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-outline">
            Additional instructions — optional
          </span>
          <textarea
            className="step-textarea"
            id="additional-instructions"
            rows={5}
            maxLength={MAX_REQUIREMENT}
            placeholder="Jaise: warm lighting rakhna hai. Vanity floating honi chahiye. Upper wall plain rakhni hai."
            value={additionalRequirement}
            onChange={(event) => setAdditionalRequirement(event.target.value)}
          />
        </label>
        <span className="font-body-sm text-body-sm text-outline self-end">
          {additionalRequirement.length}/{MAX_REQUIREMENT}
        </span>
      </div>
    </FlowStep>
  )
}

export default Instructions
