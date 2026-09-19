import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import { getCroppedImage } from '../utils/cropImage'
import './Crop.css'

const SAMPLE_TILE_IMAGE = '/sample-tile.jpg'
const MIN_CROP_EDGE = 96

type CropCorner = 'nw' | 'ne' | 'sw' | 'se'

function defaultCropEdge(frameSize: number) {
  return Math.round(Math.max(MIN_CROP_EDGE, frameSize * 0.76))
}

function Crop() {
  const navigate = useNavigate()
  const { tileImage, setCroppedImage } = useFlow()
  const imageSrc = tileImage ?? SAMPLE_TILE_IMAGE
  const canvasRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<{
    corner: CropCorner
    startX: number
    startY: number
    startEdge: number
  } | null>(null)
  const htmlDragRef = useRef(false)
  const applyResizeDeltaRef = useRef<(clientX: number, clientY: number) => void>(() => {})

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation90, setRotation90] = useState(0)
  const [yaw, setYaw] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [frameSize, setFrameSize] = useState(0)
  const [cropEdge, setCropEdge] = useState<number | null>(null)

  const rotation = rotation90 + yaw
  const cropInset = frameSize && cropEdge ? (frameSize - cropEdge) / 2 : 24

  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const apply = () => {
      const size = Math.round(el.getBoundingClientRect().width)
      setFrameSize(size)
      setCropEdge((current) => {
        const max = Math.max(MIN_CROP_EDGE, size - 16)
        if (current == null) return Math.min(defaultCropEdge(size), max)
        return Math.min(current, max)
      })
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      applyResizeDeltaRef.current(event.clientX, event.clientY)
    }
    const onUp = () => {
      if (htmlDragRef.current) return
      resizeRef.current = null
    }
    const onDragOver = (event: globalThis.DragEvent) => {
      if (!resizeRef.current) return
      event.preventDefault()
      applyResizeDeltaRef.current(event.clientX, event.clientY)
    }
    const onDragEnd = () => {
      htmlDragRef.current = false
      resizeRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragend', onDragEnd)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragend', onDragEnd)
    }
  }, [])

  const onCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleReturn = () => {
    navigate('/camera')
  }

  const handleZoom = () => {
    setZoom((current) => {
      const next = Number((current + 0.2).toFixed(1))
      return next > 3 ? 1 : next
    })
  }

  const handleRotate = () => {
    setRotation90((current) => (current + 90) % 360)
  }

  const handleStraighten = () => {
    setYaw(0)
  }

  const handleResetCrop = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation90(0)
    setYaw(0)
    if (frameSize) setCropEdge(defaultCropEdge(frameSize))
  }

  const applyResizeDelta = (clientX: number, clientY: number) => {
    if (!resizeRef.current) return
    if (clientX === 0 && clientY === 0) return
    const { corner, startX, startY, startEdge } = resizeRef.current
    const dx = clientX - startX
    const dy = clientY - startY
    let delta = 0
    if (corner === 'se') delta = (dx + dy) / 2
    if (corner === 'nw') delta = -(dx + dy) / 2
    if (corner === 'ne') delta = (-dx + dy) / 2
    if (corner === 'sw') delta = (dx - dy) / 2
    const max = Math.max(MIN_CROP_EDGE, frameSize - 16)
    setCropEdge(Math.min(max, Math.max(MIN_CROP_EDGE, startEdge + delta * 2)))
  }
  applyResizeDeltaRef.current = applyResizeDelta

  const onHandlePointerDown = (corner: CropCorner) => (event: PointerEvent<HTMLSpanElement>) => {
    event.stopPropagation()
    if (cropEdge == null) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic or unsupported pointer capture should not block resizing.
    }
    resizeRef.current = {
      corner,
      startX: event.clientX,
      startY: event.clientY,
      startEdge: cropEdge,
    }
  }

  const onHandleDragStart = (corner: CropCorner) => (event: DragEvent<HTMLSpanElement>) => {
    event.dataTransfer.setData('text/plain', 'crop-resize')
    event.dataTransfer.effectAllowed = 'move'
    const dragPreview = new Image()
    dragPreview.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    event.dataTransfer.setDragImage(dragPreview, 0, 0)
    htmlDragRef.current = true
    if (cropEdge == null) return
    resizeRef.current = {
      corner,
      startX: event.clientX,
      startY: event.clientY,
      startEdge: cropEdge,
    }
  }

  const onHandleDrag = (event: DragEvent<HTMLSpanElement>) => {
    applyResizeDelta(event.clientX, event.clientY)
  }

  const handleConfirmCrop = async () => {
    if (!croppedAreaPixels || confirming) return
    setConfirming(true)
    try {
      const dataUrl = await getCroppedImage(imageSrc, croppedAreaPixels, rotation)
      setCroppedImage(dataUrl)
      navigate('/tile-size')
    } catch (error) {
      console.error('Failed to crop tile image', error)
      setConfirming(false)
    }
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
            <div className="flex items-center gap-space-sm">
              <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">DEVYORA</span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Surface Selection</span>
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Visualizer</span>
          </div>
          <div className="flex items-center gap-space-xs">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(197,168,128,0.18)]">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>
      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          {/* Progress Stepper & Micro Context */}
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
          {/* Header Section */}
          <div className="px-margin pt-space-xs pb-space-sm flex flex-col gap-1">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-wide">
              Crop the tile
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Select the tile surface you want to use as the design reference.
            </p>
          </div>
          {/* Floating Fine-Tuning Micro-Toolbar */}
          <div className="px-margin pb-space-sm flex items-center justify-between">
            <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-full shadow-md">
              {/* Zoom Toggle Pill */}
              <button
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-highest text-on-surface active:scale-95 transition-all text-body-sm font-body-sm"
                id="zoomBtn"
                type="button"
                onClick={handleZoom}
              >
                <span className="material-symbols-outlined text-[16px] text-primary">zoom_in</span>
                <span className="font-body-sm text-body-sm text-on-surface" id="zoomLabel">
                  {zoom.toFixed(1)}x
                </span>
              </button>
              {/* Rotate 90 deg */}
              <button
                aria-label="Rotate 90 degrees"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary active:scale-95 transition-all"
                id="rotateBtn"
                type="button"
                onClick={handleRotate}
              >
                <span className="material-symbols-outlined text-[18px]">rotate_90_degrees_cw</span>
              </button>
              {/* Straighten Mode */}
              <button
                aria-label="Auto straighten alignment"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary active:scale-95 transition-all"
                id="straightenBtn"
                type="button"
                onClick={handleStraighten}
              >
                <span className="material-symbols-outlined text-[18px]">crop_rotate</span>
              </button>
            </div>
            {/* Live Dimension Pill Badge */}
            <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-full shadow-sm">
              <span className="material-symbols-outlined text-[15px] text-primary">square_foot</span>
              <span className="font-spec-numeral text-body-sm text-on-surface font-light" id="dimensionTag">
                600 × 600 mm
              </span>
            </div>
          </div>
          {/* Central Interactive Cropping Viewport */}
          <div className="px-margin flex flex-col items-center">
            <div
              ref={canvasRef}
              className="relative w-full aspect-square max-w-[420px] bg-surface-container-lowest rounded-xl overflow-hidden shadow-2xl touch-none select-none"
              id="cropCanvas"
            >
              {cropEdge != null && (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="rect"
                  showGrid={false}
                  minZoom={1}
                  maxZoom={3}
                  cropSize={{ width: cropEdge, height: cropEdge }}
                  objectFit="cover"
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  classes={{
                    containerClassName: 'dt-cropper',
                    mediaClassName: 'dt-crop-media',
                    cropAreaClassName: 'dt-crop-area',
                  }}
                />
              )}
              <span
                aria-label="Resize crop from top left"
                className="dt-crop-handle dt-crop-handle--nw"
                role="slider"
                style={{ top: cropInset - 10, left: cropInset - 10 }}
                draggable
                onDragStart={onHandleDragStart('nw')}
                onDrag={onHandleDrag}
                onPointerDown={onHandlePointerDown('nw')}
              />
              <span
                aria-label="Resize crop from top right"
                className="dt-crop-handle dt-crop-handle--ne"
                role="slider"
                style={{ top: cropInset - 10, right: cropInset - 10 }}
                draggable
                onDragStart={onHandleDragStart('ne')}
                onDrag={onHandleDrag}
                onPointerDown={onHandlePointerDown('ne')}
              />
              <span
                aria-label="Resize crop from bottom left"
                className="dt-crop-handle dt-crop-handle--sw"
                role="slider"
                style={{ bottom: cropInset - 10, left: cropInset - 10 }}
                draggable
                onDragStart={onHandleDragStart('sw')}
                onDrag={onHandleDrag}
                onPointerDown={onHandlePointerDown('sw')}
              />
              <span
                aria-label="Resize crop from bottom right"
                className="dt-crop-handle dt-crop-handle--se"
                role="slider"
                style={{ bottom: cropInset - 10, right: cropInset - 10 }}
                draggable
                onDragStart={onHandleDragStart('se')}
                onDrag={onHandleDrag}
                onPointerDown={onHandlePointerDown('se')}
              />
              {/* Tactile Drag Gesture Feedback Hint */}
              <div
                className="absolute bottom-3 inset-x-0 mx-auto w-fit flex items-center gap-1.5 bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-full shadow-lg pointer-events-none transition-opacity duration-300"
                id="gestureHint"
              >
                <span className="material-symbols-outlined text-[14px] text-primary">drag_pan</span>
                <span className="font-body-sm text-body-sm text-on-surface font-light">Drag corners to frame natural vein</span>
              </div>
            </div>
          </div>
          {/* Spec Readout Bar for Showroom Client Presentation */}
          <div className="px-margin pt-space-md pb-space-xs">
            <div className="bg-surface-container p-space-sm rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex flex-col min-w-0 pr-2">
                <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Detected Finish</span>
                <span className="font-body-md text-body-md text-on-surface font-medium truncate">Navona Travertine • Matte Honed</span>
              </div>
              <div className="flex items-center gap-2 bg-surface-container-high px-space-sm py-1 rounded-lg">
                <span className="material-symbols-outlined text-[18px] text-primary">grain</span>
                <span className="font-label-caps text-label-caps uppercase text-primary tracking-wider">R10 Rating</span>
              </div>
            </div>
          </div>
          {/* Perspective Precision Slider Control (Straightening Arc) */}
          <div className="px-margin pt-space-xs pb-space-sm flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Alignment Yaw</span>
              <span className="font-spec-numeral text-body-sm text-primary" id="yawReadout">
                {yaw.toFixed(1)}°
              </span>
            </div>
            <div className="relative w-full h-8 flex items-center bg-surface-container-low rounded-lg px-3">
              {/* Tick Marks */}
              <div className="absolute inset-x-4 flex justify-between items-center pointer-events-none opacity-20">
                <span className="w-0.5 h-2 bg-on-surface"></span>
                <span className="w-0.5 h-1.5 bg-on-surface"></span>
                <span className="w-0.5 h-1.5 bg-on-surface"></span>
                <span className="w-0.5 h-3 bg-primary opacity-100"></span>
                <span className="w-0.5 h-1.5 bg-on-surface"></span>
                <span className="w-0.5 h-1.5 bg-on-surface"></span>
                <span className="w-0.5 h-2 bg-on-surface"></span>
              </div>
              <input
                className="w-full appearance-none bg-transparent h-6 cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab"
                id="yawSlider"
                max="15"
                min="-15"
                step="0.5"
                type="range"
                value={yaw}
                onChange={(event) => setYaw(Number(event.target.value))}
              />
            </div>
          </div>
          {/* Bottom Persistent Ergonomic Action Bar */}
          <div className="mt-auto px-margin pt-space-xs pb-space-md">
            <div className="flex items-center gap-space-sm w-full">
              {/* Secondary Reset Button */}
              <button
                className="h-[52px] px-space-md rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 font-label-caps text-label-caps tracking-widest uppercase font-semibold"
                id="resetCropBtn"
                type="button"
                onClick={handleResetCrop}
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                <span className="">Reset</span>
              </button>
              {/* Primary CTA: Use This Tile */}
              <button
                className="flex-1 h-[52px] rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim active:scale-[0.98] shadow-[0_4px_20px_rgba(197,168,128,0.25)] transition-all flex items-center justify-center gap-2 font-title-md text-title-md font-semibold tracking-wide"
                id="confirmCropBtn"
                type="button"
                disabled={confirming}
                onClick={handleConfirmCrop}
              >
                <span className="">{confirming ? 'Cropping…' : 'Use This Tile'}</span>
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
