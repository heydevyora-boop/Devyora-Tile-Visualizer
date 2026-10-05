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
      lede="Optional. How the tiles are set out — skip it and the result uses a conventional layout."
      continueTo="/instructions"
      // Optional: a pattern is never required, and none is chosen for the user.
      canContinue
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
            // Tapping the chosen pattern again clears it, so an optional choice can be undone.
            onSelect={(picked) => setPatternOption(selected?.id === picked.id ? null : picked)}
          />
        ))}
      </div>
    </FlowStep>
  )
}

export default Pattern
