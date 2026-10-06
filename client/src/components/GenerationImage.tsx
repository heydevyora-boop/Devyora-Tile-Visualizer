import { useEffect, useRef, useState } from 'react'
import { apiGet } from '../utils/api'
import { getCached, loadShared } from '../utils/apiCache'

/** One generation's stored images, as GET ?view=activity&image=<id> returns them. */
type GenerationImages = { id: string; imageUrl: string; croppedTileImage: string | null }

const imageKey = (id: string) => `/api/generations?view=activity&image=${encodeURIComponent(id)}`

/**
 * A generation's stored image — the render, or the tile it was made from —
 * for a list fetched with lite=1, which leaves images out so every record
 * fits. Fetched when it comes near the screen, so a long history never
 * downloads every image at once, and kept in the shared cache so a revisit
 * shows it immediately. Until it arrives the box keeps its size, empty.
 */
function GenerationImage({
  id,
  alt,
  token,
  className,
  field = 'imageUrl',
}: {
  id: string
  alt: string
  token: string | null
  className: string
  field?: 'imageUrl' | 'croppedTileImage'
}) {
  const boxRef = useRef<HTMLSpanElement>(null)
  const [images, setImages] = useState<GenerationImages | null>(
    () => getCached<GenerationImages>(imageKey(id)) ?? null,
  )

  useEffect(() => {
    if (images) return
    const box = boxRef.current
    if (!box) return
    let cancelled = false
    const load = () =>
      loadShared(imageKey(id), () => apiGet<GenerationImages>(imageKey(id), token))
        .then((loaded) => {
          if (!cancelled) setImages(loaded)
        })
        .catch(() => {})
    if (typeof IntersectionObserver === 'undefined') {
      void load()
      return () => {
        cancelled = true
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          void load()
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(box)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [id, images, token])

  // The tile falls back to the render, as the full list always did.
  const src = images ? (field === 'croppedTileImage' ? images.croppedTileImage ?? images.imageUrl : images.imageUrl) : null

  return src ? (
    <img className={className} src={src} alt={alt} loading="lazy" decoding="async" />
  ) : (
    <span ref={boxRef} className={className} role="img" aria-label={alt} />
  )
}

export default GenerationImage
