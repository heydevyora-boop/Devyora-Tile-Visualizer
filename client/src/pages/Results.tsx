import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, type DesignOption } from '../utils/api'
import HeaderUserMenu from '../components/HeaderUserMenu'
import './Results.css'

// Same-origin by default, matching the rest of the app.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

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
  const {
    customer,
    croppedImage,
    tileSize,
    space,
    spacePath,
    style,
    styleOption,
    jointWidthMm,
    jointOption,
    patternOption,
    additionalRequirement,
    generatedResult,
    setGeneratedResult,
  } = useFlow()
  const { token, userName } = useAuth()
  const [addingConcept, setAddingConcept] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  // Another concept is never a blind retry: the salesperson says what was
  // wrong first, and that is what steers the new one.
  const [askingWhy, setAskingWhy] = useState(false)
  const [reasons, setReasons] = useState<DesignOption[] | null>(null)
  const [chosenReasons, setChosenReasons] = useState<string[]>([])
  const [reasonNote, setReasonNote] = useState('')
  const [lastRevisionId, setLastRevisionId] = useState<string | null>(null)

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
  /**
   * Asks for one more concept of the same room.
   *
   * One request, one image, appended to what is already here. The concept
   * index continues from the images already shown, so the model is given the
   * next viewpoint rather than repeating the first — and nothing is generated
   * that the salesperson did not ask to see.
   */
  const handleAnotherConcept = async () => {
    if (addingConcept || !croppedImage) return
    setAddingConcept(true)
    setAddError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tileImage: croppedImage,
          space,
          spacePath: spacePath.map((node) => node.id),
          style,
          styleOptionId: styleOption?.id,
          jointOptionId: jointOption?.id,
          jointWidthMm: jointOption ? undefined : jointWidthMm ?? undefined,
          patternOptionId: patternOption?.id,
          tileSize,
          customerId: customer?.id,
          additionalRequirement: additionalRequirement.trim() || undefined,
          conceptIndex: conceptImages.length,
          // What was wrong with the last concept, and which concept that was.
          reasonIds: chosenReasons,
          revisionNote: reasonNote.trim() || undefined,
          parentRevisionId: lastRevisionId ?? undefined,
        }),
      })
      if (!response.ok) {
        let detail = ''
        try {
          const body = (await response.json()) as { error?: unknown }
          detail = typeof body?.error === 'string' ? body.error : ''
        } catch {
          detail = ''
        }
        throw new Error(detail || 'That concept could not be created.')
      }
      const result = (await response.json()) as {
        image?: string
        tileImageUrl?: string
        revision?: { id?: string } | null
      }
      if (!result.image) throw new Error('No image came back. Please try again.')

      if (result.revision?.id) setLastRevisionId(result.revision.id)
      // Reset the sheet: the next correction is about the new concept.
      setAskingWhy(false)
      setChosenReasons([])
      setReasonNote('')

      const images = [...conceptImages, result.image]
      setGeneratedResult({ ...(generatedResult as NonNullable<typeof generatedResult>), images })

      // Re-save the whole set under the same id: the store replaces by
      // generationId, so the consultation stays one record rather than
      // becoming one per concept.
      void fetch(`${API_BASE_URL}/api/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          generationId: generatedResult?.generationId,
          userName: userName ?? 'Unknown',
          customerId: customer?.id ?? null,
          space: generatedResult?.space ?? space,
          style: generatedResult?.style ?? style,
          tileSize,
          croppedImage: generatedResult?.tileImageUrl ?? croppedImage,
          generatedImages: images,
          timestamp: new Date().toISOString(),
        }),
      }).catch((error: unknown) => {
        console.error('Could not save the added concept to history:', error)
      })
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'That concept could not be created.')
    } finally {
      setAddingConcept(false)
    }
  }

  useEffect(() => {
    if (!askingWhy || reasons !== null) return
    const controller = new AbortController()
    void (async () => {
      try {
        const list = await apiGet<DesignOption[]>(
          '/api/design-options?kind=reason',
          token,
          controller.signal,
        )
        if (!controller.signal.aborted) setReasons(list)
      } catch (caught) {
        if (controller.signal.aborted) return
        setAddError(caught instanceof ApiError ? caught.message : 'Could not load the reasons.')
      }
    })()
    return () => controller.abort()
  }, [askingWhy, reasons, token])

  const toggleReason = (id: string) =>
    setChosenReasons((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )

  const handleStartNew = () => {
    // Drop the finished run, so returning here before generating again shows
    // the empty state rather than the previous consultation's concepts.
    setGeneratedResult(null)
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
            <div className="flex flex-col gap-space-sm">
              {addError && (
                <p className="font-body-sm text-body-sm text-error text-center" role="alert">
                  {addError}
                </p>
              )}

              {!askingWhy ? (
                <button
                  className="w-full h-[52px] rounded-lg border border-outline-variant text-on-surface hover:border-primary hover:text-primary active:scale-[0.99] transition-all flex items-center justify-center gap-space-xs font-title-md text-title-md disabled:opacity-60"
                  id="anotherConceptBtn"
                  type="button"
                  disabled={addingConcept}
                  onClick={() => setAskingWhy(true)}
                >
                  <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                  <span>Want another concept?</span>
                </button>
              ) : (
                <div className="bg-surface-container rounded-xl p-space-md flex flex-col gap-space-sm">
                  <h2 className="font-title-md text-title-md text-on-surface">
                    What would you like to change?
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Everything you don&rsquo;t pick stays exactly as it is.
                  </p>

                  {reasons === null && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>
                  )}

                  <div className="flex flex-wrap gap-space-xs">
                    {(reasons ?? []).map((reason) => {
                      const selected = chosenReasons.includes(reason.id)
                      return (
                        <button
                          key={reason.id}
                          type="button"
                          aria-pressed={selected}
                          title={reason.description || undefined}
                          className={`px-space-md h-11 rounded-full border transition-all font-body-sm text-body-sm ${
                            selected
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface-container-low text-on-surface border-outline-variant hover:border-primary'
                          }`}
                          onClick={() => toggleReason(reason.id)}
                        >
                          {reason.name}
                        </button>
                      )
                    })}
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="font-label-caps text-label-caps uppercase tracking-widest text-outline">
                      Anything else to say — optional
                    </span>
                    <textarea
                      className="w-full box-border p-space-sm rounded-lg bg-surface-container-low text-on-surface border border-outline-variant focus:border-primary focus:outline-none font-body-sm text-body-sm"
                      rows={2}
                      maxLength={300}
                      placeholder="Jaise: tile sirf vanity ke peeche feature wall par chahiye."
                      value={reasonNote}
                      onChange={(event) => setReasonNote(event.target.value)}
                    />
                  </label>

                  <div className="flex gap-space-sm">
                    <button
                      className="flex-1 h-[52px] rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim active:scale-[0.99] transition-all flex items-center justify-center gap-space-xs font-title-md text-title-md disabled:opacity-60"
                      id="createConceptBtn"
                      type="button"
                      disabled={addingConcept || (chosenReasons.length === 0 && !reasonNote.trim())}
                      onClick={() => void handleAnotherConcept()}
                    >
                      <span>{addingConcept ? 'Creating…' : 'Create concept'}</span>
                      <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    </button>
                    <button
                      className="h-[52px] px-space-md rounded-lg border border-outline-variant text-on-surface hover:border-primary transition-all font-label-caps text-label-caps uppercase tracking-widest"
                      type="button"
                      disabled={addingConcept}
                      onClick={() => {
                        setAskingWhy(false)
                        setChosenReasons([])
                        setReasonNote('')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
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
