import { useFlow } from '../state/FlowContext'
import { useDesignOptions } from '../utils/useDesignOptions'
import FlowStep from '../components/FlowStep'
import OptionCard from '../components/OptionCard'

/** How the tiles are set out — straight grid, running bond, and whatever else the showroom offers. */
function Pattern() {
  const { patternOption, setPatternOption } = useFlow()
  const { options, error } = useDesignOptions('pattern')

  const selected = options?.find((option) => option.id === patternOption?.id) ?? null

  return (
    <FlowStep
      title="Laying Pattern"
      step="Step 06 / 08"
      backTo="/joint"
      heading="Laying pattern"
      lede="How the tiles are set out. The result will follow it."
      continueTo="/instructions"
      canContinue={selected !== null}
      blockedReason="Choose a laying pattern to continue."
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
            onSelect={setPatternOption}
          />
        ))}
      </div>
    </FlowStep>
  )
}

export default Pattern
