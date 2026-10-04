import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlow, type TileTarget } from '../state/FlowContext'
import { readTileFile } from '../utils/readTileFile'
import CameraCaptureModal from '../components/CameraCaptureModal'
import HeaderUserMenu from '../components/HeaderUserMenu'
import './TileInput.css'

const TILE_LABELS: Record<TileTarget, string> = {
  highlighter: 'Highlighter tile',
  plain: 'Plain tile',
}

type TileErrors = Record<TileTarget, string | null>

function TileInput() {
  const navigate = useNavigate()
  const {
    highlighterSource,
    highlighterTileImage,
    plainSource,
    plainTileImage,
    plainTileProvided,
    setTileSource,
    selectNoPlainTile,
  } = useFlow()
  const highlighterFileRef = useRef<HTMLInputElement>(null)
  const plainFileRef = useRef<HTMLInputElement>(null)
  const [cameraTarget, setCameraTarget] = useState<TileTarget | null>(null)
  const [errors, setErrors] = useState<TileErrors>({ highlighter: null, plain: null })

  const setError = (target: TileTarget, message: string | null) =>
    setErrors((current) => ({ ...current, [target]: message }))

  // A plain tile is either a photo, or the explicit choice not to have one.
  // Anything else — including an undecided plain tile — is incomplete.
  const plainDecided = plainTileProvided === false || (plainTileProvided === true && plainTileImage !== null)
  const canContinue = highlighterTileImage !== null && plainDecided

  const missingMessage =
    highlighterTileImage === null
      ? 'Add the highlighter tile to continue.'
      : !plainDecided
        ? 'Add a plain tile, or choose No Plain Tile, to continue.'
        : null

  const goToCrop = (target: TileTarget, image: string) => {
    setTileSource(target, image)
    navigate(`/crop/${target}`)
  }

  const handleCaptured = (dataUrl: string) => {
    if (!cameraTarget) return
    const target = cameraTarget
    setError(target, null)
    setCameraTarget(null)
    goToCrop(target, dataUrl)
  }

  const handleFileChange = (target: TileTarget) => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so choosing the same file again still fires a change event.
    event.target.value = ''
    if (!file) return
    try {
      const dataUrl = await readTileFile(file)
      setError(target, null)
      goToCrop(target, dataUrl)
    } catch (error) {
      setError(target, error instanceof Error ? error.message : 'We could not load that photo.')
    }
  }

  const handleNoPlainTile = () => {
    setError('plain', null)
    selectNoPlainTile()
  }

  const renderPreview = (target: TileTarget) => {
    const image = target === 'highlighter' ? highlighterTileImage : plainTileImage
    if (image) {
      return <img alt={`Cropped ${TILE_LABELS[target].toLowerCase()}`} className="tile-card__image" src={image} />
    }
    if (target === 'plain' && plainTileProvided === false) {
      return (
        <div className="tile-card__empty" data-testid="plain-none-state">
          <span className="material-symbols-outlined">block</span>
          <span>No plain tile</span>
        </div>
      )
    }
    return (
      <div className="tile-card__empty">
        <span className="material-symbols-outlined">add_photo_alternate</span>
        <span>No photo yet</span>
      </div>
    )
  }

  const renderActions = (target: TileTarget) => {
    const fileRef = target === 'highlighter' ? highlighterFileRef : plainFileRef
    const source = target === 'highlighter' ? highlighterSource : plainSource
    const cropped = target === 'highlighter' ? highlighterTileImage : plainTileImage
    return (
      <>
        <div className="tile-card__actions">
          <button
            className="tile-card__button tile-card__button--primary"
            data-testid={`${target}-camera`}
            onClick={() => setCameraTarget(target)}
            type="button"
          >
            <span className="material-symbols-outlined">photo_camera</span>
            <span>Camera</span>
          </button>
          <button
            className="tile-card__button"
            data-testid={`${target}-upload`}
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            <span className="material-symbols-outlined">photo_library</span>
            <span>Upload</span>
          </button>
          <input
            accept="image/*"
            aria-hidden="true"
            data-testid={`${target}-file`}
            hidden
            onChange={handleFileChange(target)}
            ref={fileRef}
            tabIndex={-1}
            type="file"
          />
        </div>
        {source ? (
          <button
            className="tile-card__link"
            onClick={() => navigate(`/crop/${target}`)}
            type="button"
          >
            <span className="material-symbols-outlined">crop</span>
            <span>{cropped ? 'Re-crop' : 'Crop'}</span>
          </button>
        ) : null}
      </>
    )
  }

  return (
    <div className="tile-input-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_12px_rgba(0,0,0,0.45)]">
        <div className="h-16 px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              aria-label="Return"
              className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors focus:outline-none"
              onClick={() => navigate('/home')}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
            </button>
            <span className="tile-input__logo" aria-label="DEVYORA">
              DEVYORA
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Tile Input</span>
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Visualizer</span>
          </div>
          <HeaderUserMenu />
        </div>
      </header>
      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          <div className="px-margin flex items-center justify-end py-space-sm">
            <div className="flex items-center gap-space-xs px-space-sm py-1 rounded-full bg-surface-container-low shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-widest">
                Step 01 / 08
              </span>
            </div>
          </div>
          <div className="px-margin pt-space-xs pb-space-sm flex flex-col gap-1">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-normal">
              Add your tiles
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Photograph or upload each tile. You can crop each one in the next step.
            </p>
          </div>

          <div className="tile-input__cards">
            <section className="tile-card" aria-labelledby="highlighter-heading">
              <div className="tile-card__header">
                <h2 className="tile-card__title" id="highlighter-heading">Highlighter</h2>
                <span className="tile-card__badge">Required</span>
              </div>
              <p className="tile-card__hint">The decorative tile — the feature of the design.</p>
              <div className="tile-card__preview">{renderPreview('highlighter')}</div>
              {renderActions('highlighter')}
              {errors.highlighter ? (
                <p className="tile-card__error" role="alert">{errors.highlighter}</p>
              ) : null}
            </section>

            <section className="tile-card" aria-labelledby="plain-heading">
              <div className="tile-card__header">
                <h2 className="tile-card__title" id="plain-heading">Plain</h2>
                <span className="tile-card__badge">Required</span>
              </div>
              <p className="tile-card__hint">The plain base tile — or choose No Plain Tile if there isn’t one.</p>
              <div className="tile-card__preview">{renderPreview('plain')}</div>
              {renderActions('plain')}
              <button
                aria-pressed={plainTileProvided === false}
                className={`tile-card__button tile-card__button--toggle${plainTileProvided === false ? ' is-selected' : ''}`}
                data-testid="plain-none"
                onClick={handleNoPlainTile}
                type="button"
              >
                <span className="material-symbols-outlined">
                  {plainTileProvided === false ? 'check_circle' : 'block'}
                </span>
                <span>No Plain Tile</span>
              </button>
              {errors.plain ? (
                <p className="tile-card__error" role="alert">{errors.plain}</p>
              ) : null}
            </section>
          </div>

          <div className="tile-input__footer">
            {missingMessage ? <p className="tile-input__missing">{missingMessage}</p> : null}
            <button
              className="tile-input__continue"
              data-testid="tile-input-continue"
              disabled={!canContinue}
              onClick={() => navigate('/tile-size')}
              type="button"
            >
              Continue
            </button>
          </div>
        </div>
      </main>

      {cameraTarget ? (
        <CameraCaptureModal
          title={TILE_LABELS[cameraTarget]}
          onCapture={handleCaptured}
          onClose={() => setCameraTarget(null)}
        />
      ) : null}
    </div>
  )
}

export default TileInput
