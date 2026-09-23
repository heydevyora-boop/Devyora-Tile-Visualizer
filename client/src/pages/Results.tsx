import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import HeaderUserMenu from '../components/HeaderUserMenu'
import './Results.css'

const TILE_SIZE_LABELS: Record<string, string> = {
  '600x600': '600 × 600 mm',
  '800x800': '800 × 800 mm',
  '1200x600': '1200 × 600 mm',
  '1200x1200': '1200 × 1200 mm',
}

const STYLE_LABELS: Record<string, string> = {
  minimal: 'Minimal',
  modern: 'Modern',
  luxury: 'Luxury',
  warm: 'Warm',
  contemporary: 'Contemporary',
  earthy: 'Earthy',
  indian: 'Indian',
  elegant: 'Elegant',
  surprise: 'Surprise Me',
}

/** "Concept 01", "Concept 02", … for a zero-based index. */
function conceptLabel(index: number): string {
  return `Concept ${String(index + 1).padStart(2, '0')}`
}

function Results() {
  const navigate = useNavigate()
  const { tileSize, space, style, generatedResult } = useFlow()

  // Only ever the images the backend actually returned. There is deliberately
  // no placeholder set: showing stand-in images would present them as the
  // user's own concepts.
  const conceptImages = generatedResult?.images ?? []
  const hasConcepts = conceptImages.length > 0

  const tileSizeLabel = tileSize ? TILE_SIZE_LABELS[tileSize] ?? tileSize : null
  const spaceLabel = space ?? null
  const styleLabel = style ? STYLE_LABELS[style] ?? style : null
  // The one place the real space/style selection is shown. The per-concept
  // surface strategy stays backend-only and is never surfaced here.
  const selectionSubtitle = [spaceLabel, styleLabel].filter(Boolean).join(' · ')

  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({})
  const handleImageError = (index: number) => {
    setFailedImages((prev) => ({ ...prev, [index]: true }))
  }

  // Lightbox: null = closed, otherwise the index of the concept being viewed.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lightboxCloseRef = useRef<HTMLButtonElement>(null)
  const showPrevConcept = () =>
    setLightboxIndex((current) =>
      current === null ? null : (current + conceptImages.length - 1) % conceptImages.length,
    )
  const showNextConcept = () =>
    setLightboxIndex((current) => (current === null ? null : (current + 1) % conceptImages.length))

  // Escape/Arrow-key navigation and locking background scroll while the
  // lightbox is open.
  useEffect(() => {
    if (lightboxIndex === null) return
    const total = conceptImages.length
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxIndex(null)
      } else if (event.key === 'ArrowLeft') {
        setLightboxIndex((current) => (current === null ? null : (current + total - 1) % total))
      } else if (event.key === 'ArrowRight') {
        setLightboxIndex((current) => (current === null ? null : (current + 1) % total))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    lightboxCloseRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [lightboxIndex, conceptImages.length])

  const handleReturn = () => {
    navigate('/summary')
  }
  const handleRegenerate = () => {
    navigate('/loading')
  }
  const handleStartNew = () => {
    navigate('/')
  }

  const header = (
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
          <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Specification Sheet</span>
          <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Visualizer</span>
        </div>
        <HeaderUserMenu />
      </div>
    </header>
  )

  // Reached by navigating straight to /results, or after a refresh drops the
  // in-memory flow state. Say so plainly rather than showing stand-in images.
  if (!hasConcepts) {
    return (
      <div className="results-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
        {header}
        <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
          <div className="flex flex-col items-center justify-center text-center px-margin py-space-xl gap-space-md min-h-[calc(100vh-4rem)]">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant">
              image_not_supported
            </span>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-wide">
              We couldn’t find your concepts
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xs leading-relaxed">
              Please start a new generation.
            </p>
            <button
              className="w-full max-w-[240px] h-[52px] bg-primary text-on-primary font-title-md text-title-md rounded-lg flex items-center justify-center gap-space-xs active:scale-[0.99] transition-transform"
              id="startNewBtn"
              onClick={handleStartNew}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Start New</span>
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="results-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
      {header}
      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          {/* Sub-Header Context Bar */}
          <div className="w-full bg-surface-container-low px-margin py-space-sm flex items-center gap-space-xs">
            <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">DEVYORA</span>
            {tileSizeLabel && (
              <>
                <span className="text-outline text-[10px]">•</span>
                <span className="font-spec-numeral text-body-sm text-primary">{tileSizeLabel}</span>
              </>
            )}
          </div>
          {/* Editorial Section Intro */}
          <section className="px-margin pt-space-lg pb-space-md flex flex-col gap-space-xs">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-wide">
              Architectural Concepts
            </h1>
            {selectionSubtitle && (
              <p className="font-body-md text-body-md text-on-surface-variant">{selectionSubtitle}</p>
            )}
          </section>
          {/* Vertical Stacked Feed of Concepts */}
          <main className="px-margin pb-32 flex flex-col gap-space-lg">
            {conceptImages.map((image, index) => (
              <article
                className="bg-surface-container rounded-xl overflow-hidden shadow-lg flex flex-col transition-all"
                key={index}
              >
                <div className="relative w-full aspect-[4/3] bg-surface-container-highest overflow-hidden">
                  {failedImages[index] ? (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-highest">
                      <span className="material-symbols-outlined text-[40px] text-on-surface-variant">
                        broken_image
                      </span>
                    </div>
                  ) : (
                    <img
                      alt={conceptLabel(index)}
                      className="w-full h-full object-cover cursor-pointer"
                      src={image}
                      onClick={() => setLightboxIndex(index)}
                      onError={() => handleImageError(index)}
                    />
                  )}
                </div>
                <div className="p-space-md bg-surface-container">
                  <h2 className="font-title-md text-title-md text-on-surface">{conceptLabel(index)}</h2>
                </div>
              </article>
            ))}
          </main>
          {/* Fixed Sticky Showroom Consultation Dock */}
          <aside className="fixed bottom-3 inset-x-0 z-40 px-margin pointer-events-none">
            <div className="max-w-md mx-auto pointer-events-auto bg-surface-container/95 backdrop-blur-2xl rounded-full shadow-[0_16px_40px_-8px_rgba(0,0,0,0.75)] p-2 flex items-center gap-2">
              {/* Regenerate Action */}
              <button
                className="flex-1 h-[52px] bg-surface-container-high active:bg-surface-bright text-on-surface font-title-md text-title-md rounded-full flex items-center justify-center gap-1.5 transition-colors"
                id="regenerateBtn"
                type="button"
                onClick={handleRegenerate}
              >
                <span className="material-symbols-outlined text-[18px] text-primary">autorenew</span>
                <span>Regenerate</span>
              </button>
              {/* Primary Start New CTA */}
              <button
                className="flex-1 h-[52px] bg-primary active:bg-primary-container text-on-primary font-title-md text-title-md rounded-full flex items-center justify-center gap-1.5 transition-colors shadow-[0_0_16px_rgba(197,168,128,0.22)]"
                id="startNewBtn"
                type="button"
                onClick={handleStartNew}
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Start New</span>
              </button>
            </div>
          </aside>
        </div>
      </main>
      {lightboxIndex !== null && (
        <div
          aria-label={`${conceptLabel(lightboxIndex)} — full size view`}
          aria-modal="true"
          className="lightbox-overlay fixed inset-0 flex items-center justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightboxIndex(null)
          }}
          role="dialog"
        >
          <button
            aria-label="Close full-size view"
            className="lightbox-close-btn"
            onClick={() => setLightboxIndex(null)}
            ref={lightboxCloseRef}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
          {conceptImages.length > 1 && (
            <button
              aria-label="Previous concept"
              className="lightbox-nav-btn lightbox-nav-btn--prev"
              onClick={showPrevConcept}
              type="button"
            >
              <span className="material-symbols-outlined text-[24px]">chevron_left</span>
            </button>
          )}
          <img
            alt={`${conceptLabel(lightboxIndex)} — full size`}
            className="lightbox-image"
            src={conceptImages[lightboxIndex]}
          />
          {conceptImages.length > 1 && (
            <button
              aria-label="Next concept"
              className="lightbox-nav-btn lightbox-nav-btn--next"
              onClick={showNextConcept}
              type="button"
            >
              <span className="material-symbols-outlined text-[24px]">chevron_right</span>
            </button>
          )}
          <div className="lightbox-caption">
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
              {conceptLabel(lightboxIndex)}
            </span>
            {conceptImages.length > 1 && (
              <div className="lightbox-dots">
                {conceptImages.map((_, index) => (
                  <span
                    className={`lightbox-dot${index === lightboxIndex ? ' lightbox-dot--active' : ''}`}
                    key={index}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Results
