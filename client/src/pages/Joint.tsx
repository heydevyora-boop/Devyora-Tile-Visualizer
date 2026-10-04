import { useState } from 'react'
import { useFlow } from '../state/FlowContext'
import { useDesignOptions } from '../utils/useDesignOptions'
import type { DesignOption } from '../utils/api'
import FlowStep from '../components/FlowStep'

const pill = (selected: boolean) =>
  `px-space-md h-11 rounded-full border transition-all font-body-sm text-body-sm ${
    selected
      ? 'bg-primary text-on-primary border-primary'
      : 'bg-surface-container-low text-on-surface border-outline-variant hover:border-primary'
  }`

/**
 * The grout joint, in millimetres.
 *
 * Either one of the showroom's presets (1, 2, 3, 5 mm) or a width typed in. Both
 * reach the backend as a number, and the generation is held to it.
 *
 * Not required, as before: a consultation can reach a concept without one, and
 * the request then simply leaves the joint out rather than inventing a width —
 * so asking for it before the customer has an opinion about grout would only
 * stop the conversation.
 */
function Joint() {
  const { jointWidthMm, setJointWidthMm, jointOption, setJointOption } = useFlow()
  const { options, error } = useDesignOptions('joint')

  const [customJoint, setCustomJoint] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [jointError, setJointError] = useState<string | null>(null)

  const customSelected = jointOption === null && jointWidthMm !== null

  const chooseJoint = (option: DesignOption) => {
    setJointOption(option)
    setJointWidthMm(option.valueMm)
    setCustomOpen(false)
    setJointError(null)
  }

  const applyCustomJoint = () => {
    const mm = Number(customJoint.trim())
    if (!Number.isFinite(mm) || mm < 0.5 || mm > 20) {
      setJointError('Enter a joint width between 0.5 mm and 20 mm.')
      return
    }
    setJointError(null)
    setJointOption(null)
    setJointWidthMm(Math.round(mm * 2) / 2)
  }

  return (
    <FlowStep
      title="Joint"
      step="Step 05 / 08"
      backTo="/highlighter-location"
      heading="Joint width"
      lede="The grout gap between tiles, in millimetres."
      continueTo="/pattern"
      canContinue
    >
      {error && (
        <p className="px-margin font-body-sm text-body-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="px-margin flex flex-wrap gap-space-sm pb-space-lg">
        {options === null && !error && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>
        )}
        {(options ?? []).map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={jointOption?.id === option.id}
            className={pill(jointOption?.id === option.id)}
            onClick={() => chooseJoint(option)}
          >
            {option.name}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={customSelected}
          className={pill(customSelected)}
          onClick={() => setCustomOpen((open) => !open)}
        >
          {customSelected ? `Custom — ${jointWidthMm} mm` : 'Custom'}
        </button>

        {customOpen && (
          <div className="w-full bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-sm">
            <label className="flex flex-col gap-1">
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">
                Joint width (mm)
              </span>
              <input
                className="h-11 px-3 rounded-lg bg-surface-container text-on-surface border border-outline-variant focus:border-primary focus:outline-none font-spec-numeral"
                id="custom-joint-input"
                inputMode="decimal"
                value={customJoint}
                onChange={(event) => setCustomJoint(event.target.value.replace(/[^\d.]/g, ''))}
              />
            </label>
            {jointError && (
              <p className="font-body-sm text-body-sm text-error" role="alert">
                {jointError}
              </p>
            )}
            <button
              type="button"
              className="h-11 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-caps text-label-caps uppercase tracking-widest"
              onClick={applyCustomJoint}
            >
              Use this joint
            </button>
          </div>
        )}
      </div>
    </FlowStep>
  )
}

export default Joint
