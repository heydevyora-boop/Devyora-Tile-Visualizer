import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, type DesignOption } from '../utils/api'
import HeaderUserMenu from '../components/HeaderUserMenu'
import './Style.css'

/**
 * How the room should look, and how the tile is actually laid.
 *
 * Three separate decisions, deliberately not folded into one: a style is about
 * the room around the tile, the joint width and the laying pattern are about
 * the tile itself, and a customer can want a Luxury room laid in a plain grid
 * with a hairline joint. All three come from the showroom's own lists rather
 * than from this file, and all three reach the generation as instructions.
 */
function Style() {
  const navigate = useNavigate()
  const {
    style,
    setStyle,
    styleOption,
    setStyleOption,
    jointWidthMm,
    setJointWidthMm,
    jointOption,
    setJointOption,
    patternOption,
    setPatternOption,
  } = useFlow()
  const { token } = useAuth()

  const [styles, setStyles] = useState<DesignOption[] | null>(null)
  const [joints, setJoints] = useState<DesignOption[] | null>(null)
  const [patterns, setPatterns] = useState<DesignOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [customJoint, setCustomJoint] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [jointError, setJointError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const [s, j, p] = await Promise.all([
          apiGet<DesignOption[]>('/api/design-options?kind=style', token, controller.signal),
          apiGet<DesignOption[]>('/api/design-options?kind=joint', token, controller.signal),
          apiGet<DesignOption[]>('/api/design-options?kind=pattern', token, controller.signal),
        ])
        if (controller.signal.aborted) return
        setStyles(s)
        setJoints(j)
        setPatterns(p)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load the design options.')
      }
    })()
    return () => controller.abort()
  }, [token])

  const chooseStyle = (option: DesignOption) => {
    setStyleOption(option)
    // The curated per-style prompt config is keyed by styleId; a style the
    // showroom added later falls back to its own name.
    setStyle(option.styleId ?? option.name)
  }

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

  const ready = Boolean(style) && jointWidthMm !== null && patternOption !== null

  const pill = (selected: boolean) =>
    `px-space-md h-11 rounded-full border transition-all font-body-sm text-body-sm ${
      selected
        ? 'bg-primary text-on-primary border-primary'
        : 'bg-surface-container-low text-on-surface border-outline-variant hover:border-primary'
    }`

  return (
    <div className="style-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_12px_rgba(0,0,0,0.45)]">
        <div className="h-16 px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              aria-label="Return"
              className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors focus:outline-none"
              onClick={() => navigate('/space')}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
            </button>
            <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">DEVYORA</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Design Direction</span>
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Visualizer</span>
          </div>
          <HeaderUserMenu />
        </div>
      </header>

      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full pb-32">
          <div className="px-margin pt-space-md pb-space-sm flex items-center justify-between">
            <button
              className="flex items-center gap-space-xs text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
              onClick={() => navigate('/space')}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">west</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider">Back</span>
            </button>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-medium">
                Step 05 / 06
              </span>
            </div>
          </div>

          <div className="px-margin pt-space-xs pb-space-md flex flex-col gap-1.5">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">
              Design direction
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              The look of the room, and how the tile is laid within it.
            </p>
          </div>

          {error && (
            <p className="px-margin font-body-sm text-body-sm text-error" role="alert">
              {error}
            </p>
          )}

          {/* --- Style --- */}
          <h2 className="px-margin font-label-caps text-label-caps uppercase tracking-widest text-outline pb-space-xs">
            Design style
          </h2>
          <div className="px-margin flex flex-col gap-space-sm pb-space-lg">
            {styles === null && !error && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>
            )}
            {(styles ?? []).map((option) => {
              const selected = styleOption?.id === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  className={`w-full text-left rounded-xl overflow-hidden shadow-sm flex items-stretch transition-all ${
                    selected
                      ? 'bg-surface-container ring-1 ring-primary'
                      : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                  onClick={() => chooseStyle(option)}
                >
                  {option.imageUrl && (
                    <img
                      className="w-24 h-24 object-cover flex-shrink-0"
                      src={option.imageUrl}
                      alt={option.name}
                      loading="lazy"
                    />
                  )}
                  <span className="flex-1 min-w-0 p-space-md flex flex-col justify-center gap-1">
                    <span className="font-title-md text-title-md text-on-surface">{option.name}</span>
                    {option.description && (
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {option.description}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {/* --- Joint width --- */}
          <h2 className="px-margin font-label-caps text-label-caps uppercase tracking-widest text-outline pb-space-xs">
            Joint width
          </h2>
          <div className="px-margin flex flex-wrap gap-space-sm pb-space-lg">
            {(joints ?? []).map((option) => (
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
              aria-pressed={jointOption === null && jointWidthMm !== null}
              className={pill(jointOption === null && jointWidthMm !== null)}
              onClick={() => setCustomOpen((open) => !open)}
            >
              {jointOption === null && jointWidthMm !== null ? `Custom — ${jointWidthMm} mm` : 'Custom'}
            </button>

            {customOpen && (
              <div className="w-full bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-sm">
                <label className="flex flex-col gap-1">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">
                    Joint width (mm)
                  </span>
                  <input
                    className="h-11 px-3 rounded-lg bg-surface-container text-on-surface border border-outline-variant focus:border-primary focus:outline-none font-spec-numeral"
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

          {/* --- Laying pattern --- */}
          <h2 className="px-margin font-label-caps text-label-caps uppercase tracking-widest text-outline pb-space-xs">
            Laying pattern
          </h2>
          <div className="px-margin flex flex-col gap-space-sm">
            {(patterns ?? []).map((option) => {
              const selected = patternOption?.id === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  className={`w-full text-left rounded-xl overflow-hidden shadow-sm flex items-stretch transition-all ${
                    selected
                      ? 'bg-surface-container ring-1 ring-primary'
                      : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                  onClick={() => setPatternOption(option)}
                >
                  {option.imageUrl && (
                    <img
                      className="w-24 h-24 object-cover flex-shrink-0"
                      src={option.imageUrl}
                      alt={option.name}
                      loading="lazy"
                    />
                  )}
                  <span className="flex-1 min-w-0 p-space-md flex flex-col justify-center gap-1">
                    <span className="font-title-md text-title-md text-on-surface">{option.name}</span>
                    {option.description && (
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {option.description}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-lg pb-safe">
            <div className="max-w-md mx-auto px-margin pt-space-sm pb-space-md">
              <button
                className="w-full h-[52px] bg-primary text-on-primary hover:bg-primary-fixed-dim active:scale-[0.99] rounded-lg font-title-md text-title-md tracking-wider uppercase flex items-center justify-center gap-space-xs transition-all shadow-[0_8px_24px_rgba(197,168,128,0.22)] disabled:opacity-60"
                id="continue-btn"
                type="button"
                disabled={!ready}
                onClick={() => navigate('/summary')}
              >
                <span>Continue</span>
                <span className="material-symbols-outlined text-[20px]">east</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Style
