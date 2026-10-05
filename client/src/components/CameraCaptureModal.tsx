import { useEffect, useRef, useState } from 'react'
import './CameraCaptureModal.css'

const CAMERA_UNAVAILABLE_MESSAGE =
  "Camera isn't available in this browser. Try Upload instead."
const CAMERA_DENIED_MESSAGE =
  'Camera access was denied or no camera was found. Try Upload instead.'
const PREVIEW_NOT_READY_MESSAGE =
  'The camera preview is not ready yet. Please wait a moment, then try again.'

type CaptureStatus = 'starting' | 'live' | 'error'

/** The zoom steps offered. 1x is the default; the others need the camera to support them. */
const ZOOM_LEVELS = [0.5, 1, 1.5] as const

/** `zoom` is a real camera capability, but not in TypeScript's built-in track types yet. */
type ZoomCapabilities = { zoom?: { min: number; max: number; step?: number } }

type CameraCaptureModalProps = {
  /** Which tile is being photographed, e.g. "Highlighter tile". */
  title: string
  /** Receives the captured frame as a JPEG data URL. The modal does not close itself. */
  onCapture: (dataUrl: string) => void
  onClose: () => void
}

/**
 * Full-screen live viewfinder. Opens the camera as soon as it mounts and
 * releases it as soon as it unmounts, so the parent only has to render or not
 * render it.
 */
function CameraCaptureModal({ title, onCapture, onClose }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<CaptureStatus>('starting')
  const [message, setMessage] = useState<string | null>(null)
  // The camera's own zoom range, or null where the camera/browser has no zoom
  // control. There is deliberately no fallback to CSS scaling: that would crop
  // the preview and the captured frame digitally and lose resolution.
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null)
  const [zoom, setZoom] = useState<number>(1)

  useEffect(() => {
    // Scoped to this effect run, not a shared ref: StrictMode mounts, cleans
    // up and mounts again, and a shared flag would be reset by the second run
    // while the first run's permission prompt was still pending.
    let cancelled = false
    let stream: MediaStream | null = null
    // Captured once: the cleanup below must release this element, not
    // whatever the ref points at by the time it runs.
    const video = videoRef.current

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage(CAMERA_UNAVAILABLE_MESSAGE)
        setStatus('error')
        return
      }
      try {
        let acquired: MediaStream
        try {
          acquired = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          })
        } catch {
          acquired = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        }
        // The await above can outlive this modal: a permission prompt, or a
        // slow sensor on a mid-range phone, gives the user time to cancel.
        // The cleanup below will already have run and found no stream to
        // stop, so without this the camera would stay open with nothing left
        // alive to close it — until the page is reloaded.
        if (cancelled) {
          acquired.getTracks().forEach((track) => track.stop())
          return
        }
        stream = acquired
        const track = acquired.getVideoTracks()[0] ?? null
        trackRef.current = track
        const capabilities = (track?.getCapabilities?.() ?? {}) as ZoomCapabilities
        if (capabilities.zoom) {
          setZoomRange({ min: capabilities.zoom.min, max: capabilities.zoom.max })
        }
        if (video) {
          video.srcObject = acquired
          await video.play()
        }
        if (!cancelled) setStatus('live')
      } catch {
        if (cancelled) return
        stream?.getTracks().forEach((track) => track.stop())
        stream = null
        setMessage(CAMERA_DENIED_MESSAGE)
        setStatus('error')
      }
    }
    void start()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      trackRef.current = null
      if (video) video.srcObject = null
    }
  }, [])

  // Applied to the camera itself, so the preview and the captured frame are
  // both genuinely zoomed. Left at the previous level if the camera refuses.
  const handleZoom = async (level: number) => {
    const track = trackRef.current
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ zoom: level } as MediaTrackConstraintSet] })
      setZoom(level)
    } catch {
      /* the camera did not accept this level; keep the current one */
    }
  }

  const handleCapture = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setMessage(PREVIEW_NOT_READY_MESSAGE)
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setMessage(CAMERA_UNAVAILABLE_MESSAGE)
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.92))
  }

  return (
    <div className="capture-modal" role="dialog" aria-modal="true" aria-label={`Photograph the ${title}`}>
      <header className="capture-modal__header">
        <button
          aria-label="Close camera"
          className="capture-modal__close"
          onClick={onClose}
          type="button"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <span className="capture-modal__title">{title}</span>
        <span className="capture-modal__header-spacer" aria-hidden="true" />
      </header>

      <div className="capture-modal__stage">
        <div className="capture-modal__viewfinder">
          <video
            autoPlay
            className="capture-modal__video"
            muted
            playsInline
            ref={videoRef}
          />
          <span className="capture-modal__corner capture-modal__corner--tl" />
          <span className="capture-modal__corner capture-modal__corner--tr" />
          <span className="capture-modal__corner capture-modal__corner--bl" />
          <span className="capture-modal__corner capture-modal__corner--br" />
          {status === 'starting' ? (
            <p className="capture-modal__overlay-note">Starting camera…</p>
          ) : null}
          {zoomRange ? (
            <div className="capture-modal__zoom" role="group" aria-label="Camera zoom">
              {ZOOM_LEVELS.map((level) => {
                const supported = level >= zoomRange.min && level <= zoomRange.max
                return (
                  <button
                    aria-pressed={zoom === level}
                    className={`capture-modal__zoom-button${zoom === level ? ' is-active' : ''}`}
                    disabled={!supported || status !== 'live'}
                    key={level}
                    onClick={() => void handleZoom(level)}
                    type="button"
                  >
                    {level}x
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
        <p className="capture-modal__hint">
          Hold the camera straight above one clear tile surface, in even light. You can crop it next.
        </p>
        {message ? (
          <p className="capture-modal__error" role="alert">
            {message}
          </p>
        ) : null}
      </div>

      <footer className="capture-modal__actions">
        <button
          className="capture-modal__capture"
          disabled={status !== 'live'}
          onClick={handleCapture}
          type="button"
        >
          <span className="material-symbols-outlined">photo_camera</span>
          <span>Capture</span>
        </button>
        <button className="capture-modal__cancel" onClick={onClose} type="button">
          {status === 'error' ? 'Close' : 'Cancel'}
        </button>
      </footer>
    </div>
  )
}

export default CameraCaptureModal
