import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import { getCroppedImage } from '../utils/cropImage'
import FreeCrop, { type CropRect, type FreeCropHandle } from '../components/FreeCrop'
import HeaderUserMenu from '../components/HeaderUserMenu'
import './Crop.css'

/**
 * Choosing which tile, and only which tile, becomes the design reference.
 *
 * The selection is free-form: every corner and every edge moves on its own,
 * with no ratio locked in, so a square tile, a long plank and a tall riser are
 * all framed the same way. That matters beyond convenience — a forced shape
 * would drag in whatever sits beside the tile (the next tile in the display,
 * a hand, packaging, the floor), and the generation would then be working from
 * two materials instead of one.
 */
function Crop() {
  const navigate = useNavigate()
  const { tileImage, setTileImage, setCroppedImage } = useFlow()
  const cropRef = useRef<FreeCropHandle>(null)

  const [rect, setRect] = useState<CropRect | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [cropError, setCropError] = useState<string | null>(null)

  const handleReturn = () => navigate('/camera')

  /** Throws the photo away and goes back for another one. */
  const handleClearPreview = () => {
    setTileImage(null)
    setCroppedImage(null)
    navigate('/camera')
  }

  const handleReset = () => {
    setCropError(null)
    cropRef.current?.reset()
  }

  // Identity is stable so FreeCrop's effect does not re-run on every render.
  const handleChange = useCallback((next: CropRect | null) => setRect(next), [])

  const handleConfirmCrop = async () => {
    if (!tileImage || !rect || confirming) return
    setConfirming(true)
    setCropError(null)
    try {
      // The rectangle is already in source-photo pixels, which is exactly what
      // the exporter expects — no conversion, so nothing can drift.
      const dataUrl = await getCroppedImage(tileImage, {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })
      setCroppedImage(dataUrl)
      navigate('/tile-size')
    } catch (error) {
      console.error('Failed to crop tile image', error)
      // Both buttons stay enabled so the crop can be adjusted and retried.
      setCropError('That crop could not be processed. Please adjust it and try again.')
      setConfirming(false)
    }
  }

  if (!tileImage) {
    return (
      <div className="crop-page bg-surface text-on-surface flex flex-col items-center justify-center min-h-screen px-margin gap-space-md">
        <p className="font-body-md text-body-md text-on-surface-variant text-center">
          No tile photo was found. Please take or choose one first.
        </p>
        <button
          className="h-[52px] px-space-lg rounded-lg bg-primary text-on-primary font-title-md text-title-md"
          type="button"
          onClick={() => navigate('/camera')}
        >
          Back to capture
        </button>
      </div>
    )
  }

  return (
    <div className="crop-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_12px_rgba(0,0,0,0.45)]">
        <div className="h-16 px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              aria-label="Return"
              className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors focus:outline-none"
              onClick={handleReturn}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
            </button>
            <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">DEVYORA</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Surface Selection</span>
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Visualizer</span>
          </div>
          <HeaderUserMenu />
        </div>
      </header>

      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full pb-32">
          <div className="px-margin pt-space-sm pb-space-xs flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">Calibration Mode</span>
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-0.5 rounded-full shadow-sm">
              <span className="font-body-sm text-body-sm text-primary font-semibold">02</span>
              <span className="font-body-sm text-body-sm text-outline">/</span>
              <span className="font-body-sm text-body-sm text-outline">06</span>
            </div>
          </div>

          <div className="px-margin pt-space-xs pb-space-sm flex flex-col gap-1">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-wide">
              Crop the tile
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Drag the corners and edges so only the tile is selected — no background, packaging or
              neighbouring tiles.
            </p>
          </div>

          <div className="px-margin pb-space-sm flex items-center justify-between gap-space-sm">
            <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-full shadow-md">
              <button
                aria-label="Zoom out"
                className="w-11 h-11 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary active:scale-95 transition-all"
                id="zoomOutBtn"
                type="button"
                onClick={() => cropRef.current?.zoomBy(1 / 1.25)}
              >
                <span className="material-symbols-outlined text-[18px]">zoom_out</span>
              </button>
              <button
                aria-label="Zoom in"
                className="w-11 h-11 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary active:scale-95 transition-all"
                id="zoomInBtn"
                type="button"
                onClick={() => cropRef.current?.zoomBy(1.25)}
              >
                <span className="material-symbols-outlined text-[18px]">zoom_in</span>
              </button>
              <button
                className="flex items-center gap-1 px-3 h-11 rounded-full text-on-surface-variant hover:text-primary active:scale-95 transition-all text-body-sm font-body-sm"
                id="clearPreviewBtn"
                type="button"
                onClick={handleClearPreview}
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                <span>Clear</span>
              </button>
            </div>
            {/* The selection's real size, rather than a fixed figure: it is the
                one number that tells the salesperson how much detail the
                reference will carry. */}
            <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-full shadow-sm">
              <span className="material-symbols-outlined text-[15px] text-primary">crop_free</span>
              <span className="font-spec-numeral text-body-sm text-on-surface font-light" id="dimensionTag">
                {rect ? `${Math.round(rect.width)} × ${Math.round(rect.height)} px` : '—'}
              </span>
            </div>
          </div>

          <div className="px-margin flex flex-col items-center">
            <div
              className="relative w-full aspect-square max-w-[420px] bg-surface-container-lowest rounded-xl overflow-hidden shadow-2xl"
              id="cropCanvas"
            >
              <FreeCrop ref={cropRef} imageSrc={tileImage} onChange={handleChange} />
              <div
                className="absolute bottom-3 inset-x-0 mx-auto w-fit flex items-center gap-1.5 bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-full shadow-lg pointer-events-none"
                id="gestureHint"
              >
                <span className="material-symbols-outlined text-[14px] text-primary">drag_pan</span>
                <span className="font-body-sm text-body-sm text-on-surface font-light">
                  Drag corners or edges · pinch to zoom
                </span>
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-lg pb-safe">
            {cropError && (
              <div className="max-w-md mx-auto px-margin pt-space-xs w-full">
                <p
                  className="font-body-sm text-body-sm text-on-surface-variant text-center"
                  id="cropErrorMessage"
                  role="alert"
                >
                  {cropError}
                </p>
              </div>
            )}
            <div className="max-w-md mx-auto px-margin pt-space-xs pb-space-md flex items-center gap-space-sm w-full">
              <button
                className="h-[52px] px-space-md rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 font-label-caps text-label-caps tracking-widest uppercase font-semibold"
                id="resetCropBtn"
                type="button"
                onClick={handleReset}
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                <span>Reset</span>
              </button>
              <button
                className="flex-1 h-[52px] rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim active:scale-[0.98] shadow-[0_4px_20px_rgba(197,168,128,0.25)] transition-all flex items-center justify-center gap-2 font-title-md text-title-md font-semibold tracking-wide disabled:opacity-60"
                id="confirmCropBtn"
                type="button"
                disabled={confirming || !rect}
                onClick={handleConfirmCrop}
              >
                <span>{confirming ? 'Cropping…' : 'Use This Tile'}</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Crop
