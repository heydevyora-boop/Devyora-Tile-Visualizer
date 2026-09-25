import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, type TileFormat } from '../utils/api'
import HeaderUserMenu from '../components/HeaderUserMenu'
import './TileSize.css'

/** "600x1200" — the shape the flow and the prompt both already understand. */
function toSizeId(lengthMm: number, breadthMm: number): string {
  return `${lengthMm}x${breadthMm}`
}

function label(lengthMm: number, breadthMm: number): string {
  return `${lengthMm} × ${breadthMm} mm`
}

/**
 * The real-world size of the tile, which decides how it lays out rather than
 * merely labelling it.
 *
 * The standard formats are not listed here. They come from the server so the
 * showroom can add, correct, retire or reorder a format without a redeploy;
 * this screen renders whatever is active. Anything not in that list is entered
 * as a custom size, in millimetres, which is the only unit used anywhere.
 */
function TileSize() {
  const navigate = useNavigate()
  const { tileSize, setTileSize } = useFlow()
  const { token } = useAuth()

  const [formats, setFormats] = useState<TileFormat[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // null means "the salesperson has not touched this yet", so the panel and
  // the fields can follow the already-chosen size until they do. Derived at
  // render rather than pushed in by an effect: the formats arrive
  // asynchronously, and an effect racing that load is how a field ends up
  // blank after a back-navigation.
  const [customOpenOverride, setCustomOpenOverride] = useState<boolean | null>(null)
  const [lengthInput, setLengthInput] = useState<string | null>(null)
  const [breadthInput, setBreadthInput] = useState<string | null>(null)
  const [customError, setCustomError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const list = await apiGet<TileFormat[]>('/api/tile-formats', token, controller.signal)
        if (!controller.signal.aborted) setFormats(list)
      } catch (caught) {
        if (controller.signal.aborted) return
        setLoadError(
          caught instanceof ApiError ? caught.message : 'Could not load the tile formats.',
        )
      }
    })()
    return () => controller.abort()
  }, [token])

  // A size already chosen that is not one of the standard formats can only
  // have come from the custom fields, so the panel opens showing it rather
  // than looking like nothing was selected.
  const standardIds = useMemo(
    () => new Set((formats ?? []).map((format) => toSizeId(format.lengthMm, format.breadthMm))),
    [formats],
  )
  const customSelected = Boolean(tileSize) && formats !== null && !standardIds.has(tileSize ?? '')

  const chosenCustom = customSelected ? (tileSize ?? '').match(/^(\d+)x(\d+)$/) : null
  const customOpen = customOpenOverride ?? customSelected
  const customLength = lengthInput ?? chosenCustom?.[1] ?? ''
  const customBreadth = breadthInput ?? chosenCustom?.[2] ?? ''

  const applyCustom = () => {
    setCustomError(null)
    const lengthMm = Number(customLength.trim())
    const breadthMm = Number(customBreadth.trim())
    for (const [value, name] of [[lengthMm, 'Length'], [breadthMm, 'Breadth']] as const) {
      if (!Number.isFinite(value) || !Number.isInteger(value) || value < 10 || value > 4000) {
        setCustomError(`${name} must be a whole number between 10 mm and 4000 mm.`)
        return
      }
    }
    setTileSize(toSizeId(lengthMm, breadthMm))
  }

  const handleContinue = () => {
    if (!tileSize) return
    navigate('/space')
  }

  return (
    <div className="tile-size-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_12px_rgba(0,0,0,0.45)]">
        <div className="h-16 px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              aria-label="Return"
              className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors focus:outline-none"
              onClick={() => navigate('/crop')}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
            </button>
            <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">DEVYORA</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Layout Configuration</span>
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Visualizer</span>
          </div>
          <HeaderUserMenu />
        </div>
      </header>

      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full pb-32">
          <div className="px-margin pt-space-md pb-space-sm flex items-center justify-between">
            <button
              aria-label="Previous step"
              className="flex items-center gap-space-xs text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
              onClick={() => navigate('/crop')}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">west</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider">Back</span>
            </button>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-medium">
                Step 03 / 06
              </span>
            </div>
          </div>

          <div className="px-margin pt-space-xs pb-space-lg flex flex-col gap-1.5">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">
              What is the size of this tile?
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              The real size decides how the tile lays out — how many fit, where the joints fall and
              how it is cut at the edges.
            </p>
          </div>

          <div className="px-margin flex flex-col gap-space-sm" id="size-selector-group">
            {loadError && (
              <p className="font-body-sm text-body-sm text-error" role="alert">
                {loadError}
              </p>
            )}
            {!loadError && formats === null && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">Loading formats…</p>
            )}
            {formats?.length === 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                No standard formats are set up. Enter the size below.
              </p>
            )}

            {(formats ?? []).map((format) => {
              const id = toSizeId(format.lengthMm, format.breadthMm)
              const selected = tileSize === id
              return (
                <button
                  key={format.id}
                  type="button"
                  aria-pressed={selected}
                  data-size={id}
                  className={`tile-card w-full text-left bg-surface-container-low hover:bg-surface-container transition-all duration-200 p-space-md rounded-xl flex items-center justify-between shadow-sm${selected ? ' selected' : ''}`}
                  onClick={() => setTileSize(id)}
                >
                  <span className="font-spec-numeral text-spec-numeral text-on-surface tracking-wide">
                    {label(format.lengthMm, format.breadthMm)}
                  </span>
                  <span
                    className={`material-symbols-outlined text-[20px] ${selected ? 'text-primary' : 'text-outline'}`}
                  >
                    {selected ? 'radio_button_checked' : 'radio_button_unchecked'}
                  </span>
                </button>
              )
            })}

            <button
              type="button"
              aria-expanded={customOpen}
              className={`tile-card w-full text-left bg-surface-container-low hover:bg-surface-container transition-all duration-200 p-space-md rounded-xl flex items-center justify-between shadow-sm${customSelected ? ' selected' : ''}`}
              onClick={() => setCustomOpenOverride(!customOpen)}
            >
              <span className="font-spec-numeral text-spec-numeral text-on-surface tracking-wide">
                {customSelected && tileSize
                  ? `Custom — ${tileSize.replace('x', ' × ')} mm`
                  : 'Custom size'}
              </span>
              <span className="material-symbols-outlined text-[20px] text-outline">
                {customOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {customOpen && (
              <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-sm">
                <label className="flex flex-col gap-1">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">
                    Length (mm)
                  </span>
                  <input
                    className="h-11 px-3 rounded-lg bg-surface-container text-on-surface border border-outline-variant focus:border-primary focus:outline-none font-spec-numeral"
                    inputMode="numeric"
                    value={customLength}
                    onChange={(event) => setLengthInput(event.target.value.replace(/\D/g, ''))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">
                    Breadth (mm)
                  </span>
                  <input
                    className="h-11 px-3 rounded-lg bg-surface-container text-on-surface border border-outline-variant focus:border-primary focus:outline-none font-spec-numeral"
                    inputMode="numeric"
                    value={customBreadth}
                    onChange={(event) => setBreadthInput(event.target.value.replace(/\D/g, ''))}
                  />
                </label>
                {customError && (
                  <p className="font-body-sm text-body-sm text-error" role="alert">
                    {customError}
                  </p>
                )}
                <button
                  type="button"
                  className="h-11 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-caps text-label-caps uppercase tracking-widest"
                  onClick={applyCustom}
                >
                  Use this size
                </button>
              </div>
            )}
          </div>

          <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-lg pb-safe">
            <div className="max-w-md mx-auto px-margin pt-space-sm pb-space-md">
              <button
                className="w-full h-[52px] bg-primary text-on-primary hover:bg-primary-fixed-dim active:scale-[0.99] rounded-lg font-title-md text-title-md tracking-wider uppercase flex items-center justify-center gap-space-xs transition-all shadow-[0_8px_24px_rgba(197,168,128,0.22)] disabled:opacity-60"
                id="continue-btn"
                type="button"
                disabled={!tileSize}
                onClick={handleContinue}
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

export default TileSize
