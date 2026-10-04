import { useFlow } from '../state/FlowContext'
import { useDesignOptions } from '../utils/useDesignOptions'
import FlowStep from '../components/FlowStep'
import OptionCard from '../components/OptionCard'

/**
 * Where the highlighter tile is to be used.
 *
 * A hard architectural input, not a description of the room: whatever is chosen
 * here is where the highlighter goes, and it is not moved because another spot
 * would look better. The list comes from the showroom, so its wording — which is
 * what the generation is told to follow — can be sharpened without a redeploy.
 */
function HighlighterLocation() {
  const { highlighterLocationOption, setHighlighterLocationOption } = useFlow()
  const { options, error } = useDesignOptions('highlighterLocation')

  // Selected only if it is still on the live list: an option the showroom has
  // disabled since it was chosen must read as unselected, not as a choice the
  // server is about to refuse.
  const selected = options?.find((option) => option.id === highlighterLocationOption?.id) ?? null

  return (
    <FlowStep
      title="Highlighter"
      step="Step 04 / 08"
      backTo="/space"
      heading="Highlighter kahan use karna hai?"
      lede="The highlighter tile is used exactly here, and stays here."
      continueTo="/joint"
      canContinue={selected !== null}
      blockedReason="Choose where the highlighter is used to continue."
    >
      {error && (
        <p className="px-margin font-body-sm text-body-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="px-margin flex flex-col gap-space-sm">
        {options === null && !error && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>
        )}
        {(options ?? []).map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            selected={selected?.id === option.id}
            onSelect={setHighlighterLocationOption}
          />
        ))}
      </div>
    </FlowStep>
  )
}

export default HighlighterLocation
