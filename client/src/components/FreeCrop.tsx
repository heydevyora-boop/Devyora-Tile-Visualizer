import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import './FreeCrop.css'

/** A crop rectangle, in the source photo's own pixels. */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface FreeCropHandle {
  /** Back to the whole photo, unzoomed and centred. */
  reset: () => void
  zoomBy: (factor: number) => void
}

/** Corner and edge grips. Each moves only the edges it names. */
const GRIPS = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'] as const
type Grip = (typeof GRIPS)[number]

const MIN_ZOOM = 1
const MAX_ZOOM = 6
/** Smallest selection, in source pixels — below this a crop carries no detail. */
const MIN_CROP_PX = 32

type Drag =
  | { kind: 'move'; pointerId: number; startX: number; startY: number; startRect: CropRect }
  | { kind: 'resize'; pointerId: number; grip: Grip; startX: number; startY: number; startRect: CropRect }
  | { kind: 'pan'; pointerId: number; startX: number; startY: number; startPan: { x: number; y: number } }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * A free-form crop: the selection is a rectangle the user shapes themselves.
 *
 * Every corner and every edge moves on its own, with no ratio locked in, so a
 * square tile, a plank and a tall riser are all selected the same way — by
 * dragging the box onto the tile. A fixed square would force the salesperson
 * to include whatever sits beside a non-square tile, which is exactly the
 * unrelated material the generation must not pick up.
 *
 * The rectangle is held in source-photo pixels, not screen pixels. Zooming or
 * panning re-projects it, so the selection stays welded to the tile instead of
 * sliding off it, and the exported crop needs no conversion.
 */
const FreeCrop = forwardRef<FreeCropHandle, {
  imageSrc: string
  onChange: (rect: CropRect | null) => void
}>(function FreeCrop({ imageSrc, onChange }, ref) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [rect, setRect] = useState<CropRect | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const pinchRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchDistanceRef = useRef<number | null>(null)

  // Measure the frame, and keep measuring: a phone rotating from portrait to
  // landscape changes it, and a projection built on a stale size puts the
  // handles somewhere the tile is not.
  useEffect(() => {
    const element = frameRef.current
    if (!element) return
    const measure = () =>
      setFrame({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // A new photo starts with everything selected, which is both a sensible
  // default and a visible invitation to drag the corners inward.
  useEffect(() => {
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      setNatural({ width: image.naturalWidth, height: image.naturalHeight })
      setRect({ x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight })
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
    image.src = imageSrc
    return () => {
      cancelled = true
    }
  }, [imageSrc])

  useEffect(() => {
    onChange(rect)
  }, [rect, onChange])

  // Source pixels -> screen pixels. One scale for both axes, so nothing is
  // ever stretched: a distorted preview would misrepresent the tile.
  const scale = natural && frame
    ? Math.min(frame.width / natural.width, frame.height / natural.height) * zoom
    : 1

  const toScreen = (x: number, y: number) => {
    if (!natural || !frame) return { x: 0, y: 0 }
    return {
      x: frame.width / 2 + pan.x + (x - natural.width / 2) * scale,
      y: frame.height / 2 + pan.y + (y - natural.height / 2) * scale,
    }
  }

  const resetAll = useCallback(() => {
    if (!natural) return
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setRect({ x: 0, y: 0, width: natural.width, height: natural.height })
  }, [natural])

  useImperativeHandle(ref, () => ({
    reset: resetAll,
    zoomBy: (factor: number) => setZoom((current) => clamp(current * factor, MIN_ZOOM, MAX_ZOOM)),
  }), [resetAll])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pinchRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pinchRef.current.size === 1) {
      // Dragging the photo itself pans it, so the tile can be brought under
      // the selection rather than the selection dragged across the photo.
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        kind: 'pan',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPan: pan,
      }
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pinchRef.current.has(event.pointerId)) {
      pinchRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }

    // Two fingers pinch to zoom, which is how anyone expects to zoom a photo
    // on a showroom tablet.
    if (pinchRef.current.size === 2) {
      const [a, b] = [...pinchRef.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const previous = pinchDistanceRef.current
      pinchDistanceRef.current = distance
      if (previous) setZoom((current) => clamp(current * (distance / previous), MIN_ZOOM, MAX_ZOOM))
      dragRef.current = null
      return
    }

    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !natural) return

    if (drag.kind === 'pan') {
      setPan({ x: drag.startPan.x + (event.clientX - drag.startX), y: drag.startPan.y + (event.clientY - drag.startY) })
      return
    }

    // Screen movement becomes source-pixel movement, so a drag tracks the
    // finger identically at every zoom level.
    const dx = (event.clientX - drag.startX) / scale
    const dy = (event.clientY - drag.startY) / scale
    const start = drag.startRect

    if (drag.kind === 'move') {
      setRect({
        ...start,
        x: clamp(start.x + dx, 0, natural.width - start.width),
        y: clamp(start.y + dy, 0, natural.height - start.height),
      })
      return
    }

    // Each grip moves only its own edges: no ratio is preserved, so the
    // rectangle becomes whatever shape the tile actually is.
    let left = start.x
    let top = start.y
    let right = start.x + start.width
    let bottom = start.y + start.height

    if (drag.grip.includes('w')) left = clamp(left + dx, 0, right - MIN_CROP_PX)
    if (drag.grip.includes('e')) right = clamp(right + dx, left + MIN_CROP_PX, natural.width)
    if (drag.grip.includes('n')) top = clamp(top + dy, 0, bottom - MIN_CROP_PX)
    if (drag.grip.includes('s')) bottom = clamp(bottom + dy, top + MIN_CROP_PX, natural.height)

    setRect({ x: left, y: top, width: right - left, height: bottom - top })
  }

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pinchRef.current.delete(event.pointerId)
    if (pinchRef.current.size < 2) pinchDistanceRef.current = null
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  const topLeft = rect ? toScreen(rect.x, rect.y) : null
  const bottomRight = rect ? toScreen(rect.x + rect.width, rect.y + rect.height) : null
  const imageOrigin = natural ? toScreen(0, 0) : null

  return (
    <div
      ref={frameRef}
      className="freecrop"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {natural && imageOrigin && (
        <img
          className="freecrop__image"
          src={imageSrc}
          alt="Tile photo being cropped"
          draggable={false}
          style={{
            left: `${imageOrigin.x}px`,
            top: `${imageOrigin.y}px`,
            width: `${natural.width * scale}px`,
            height: `${natural.height * scale}px`,
          }}
        />
      )}

      {rect && topLeft && bottomRight && (
        <>
          {/* Everything outside the selection is dimmed, so the salesperson can
              see at a glance what will and will not become the reference. */}
          <div
            className="freecrop__shade"
            style={{
              clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${topLeft.x}px ${topLeft.y}px, ${topLeft.x}px ${bottomRight.y}px, ${bottomRight.x}px ${bottomRight.y}px, ${bottomRight.x}px ${topLeft.y}px, ${topLeft.x}px ${topLeft.y}px)`,
            }}
          />
          <div
            className="freecrop__rect"
            style={{
              left: `${topLeft.x}px`,
              top: `${topLeft.y}px`,
              width: `${bottomRight.x - topLeft.x}px`,
              height: `${bottomRight.y - topLeft.y}px`,
            }}
            onPointerDown={(event) => {
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              dragRef.current = {
                kind: 'move',
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startRect: rect,
              }
            }}
          >
            {GRIPS.map((grip) => (
              <span
                key={grip}
                className={`freecrop__grip freecrop__grip--${grip}`}
                aria-label={`Adjust ${grip} edge`}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  event.currentTarget.setPointerCapture(event.pointerId)
                  dragRef.current = {
                    kind: 'resize',
                    pointerId: event.pointerId,
                    grip,
                    startX: event.clientX,
                    startY: event.clientY,
                    startRect: rect,
                  }
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
})

export default FreeCrop
