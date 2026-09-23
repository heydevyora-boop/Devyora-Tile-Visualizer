import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import './History.css'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const GENERATIONS_ENDPOINT = `${API_BASE_URL}/api/generations`

type GenerationRecord = {
  generationId: string
  userName: string
  croppedImage: string
  generatedImages: string[]
  timestamp: string
}

/** Open lightbox target: which record, and which image within it. */
type LightboxTarget = { recordIndex: number; imageIndex: number }

function formatTimestamp(timestamp: string): { date: string; time: string } {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return { date: timestamp, time: '' }
  return {
    date: parsed.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    time: parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  }
}

function History() {
  const navigate = useNavigate()
  const { logout, token } = useAuth()
  const [records, setRecords] = useState<GenerationRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<LightboxTarget | null>(null)
  const lightboxCloseRef = useRef<HTMLButtonElement>(null)

  const loadHistory = useCallback(
    async (signal?: AbortSignal) => {
      setError(null)
      try {
        const response = await fetch(GENERATIONS_ENDPOINT, {
          signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (response.status === 401) {
          // The session was rejected server-side (expired, or somehow not an
          // admin token) — sign out rather than show a bare error.
          logout()
          navigate('/', { replace: true })
          return
        }
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
        const data: unknown = await response.json()
        setRecords(Array.isArray(data) ? (data as GenerationRecord[]) : [])
      } catch (loadError) {
        if (signal?.aborted) return
        setRecords([])
        setError(
          loadError instanceof Error && loadError.message
            ? `Could not load history. ${loadError.message}`
            : 'Could not load history.',
        )
      }
    },
    // `logout` (useCallback, empty deps) and `navigate` (react-router) are
    // both stable across renders, so including them here never causes this
    // callback — and the fetch effect below that depends on it — to re-run.
    [token, logout, navigate],
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadHistory(controller.signal)
    return () => controller.abort()
  }, [loadHistory])

  const activeRecord = lightbox === null ? null : records?.[lightbox.recordIndex] ?? null
  const activeImages = activeRecord?.generatedImages ?? []

  // Escape / arrow keys and background scroll lock while the lightbox is open,
  // matching the behaviour already established on Results.
  useEffect(() => {
    if (lightbox === null) return
    const total = activeImages.length
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightbox(null)
      } else if (event.key === 'ArrowLeft' && total > 1) {
        setLightbox((current) =>
          current === null
            ? null
            : { ...current, imageIndex: (current.imageIndex + total - 1) % total },
        )
      } else if (event.key === 'ArrowRight' && total > 1) {
        setLightbox((current) =>
          current === null ? null : { ...current, imageIndex: (current.imageIndex + 1) % total },
        )
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
  }, [lightbox, activeImages.length])

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  const showPrev = () =>
    setLightbox((current) =>
      current === null || activeImages.length < 2
        ? current
        : {
            ...current,
            imageIndex: (current.imageIndex + activeImages.length - 1) % activeImages.length,
          },
    )
  const showNext = () =>
    setLightbox((current) =>
      current === null || activeImages.length < 2
        ? current
        : { ...current, imageIndex: (current.imageIndex + 1) % activeImages.length },
    )

  return (
    <div className="history-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
      {/* Admins are review-only, so this header carries no navigation into the
          visualiser — branding, title, and sign-out only. */}
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_12px_rgba(0,0,0,0.45)]">
        <div className="h-16 px-margin flex items-center justify-between">
          <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">
            DEVYORA
          </span>
          <div className="flex flex-col items-center">
            <span className="font-headline-sm text-headline-sm uppercase text-on-surface">
              Generation History
            </span>
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">
              Admin
            </span>
          </div>
          <button
            aria-label="Sign out"
            className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors focus:outline-none"
            id="logoutBtn"
            onClick={handleLogout}
            title="Sign out"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </header>

      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="history-content">
          <section className="history-intro">
            <p className="history-eyebrow">Archive</p>
            <h1 className="history-title">All Generations</h1>
            <p className="history-subtitle">
              {records === null
                ? 'Loading saved consultations…'
                : `${records.length} saved ${records.length === 1 ? 'consultation' : 'consultations'}, newest first.`}
            </p>
          </section>

          {error && (
            <p className="history-error" id="historyError" role="alert">
              <span className="material-symbols-outlined history-error-icon">error</span>
              <span>{error}</span>
            </p>
          )}

          {records !== null && records.length === 0 && !error && (
            <div className="history-empty" id="historyEmpty">
              <span className="material-symbols-outlined history-empty-icon">inventory_2</span>
              <p className="history-empty-title">No generations yet</p>
              <p className="history-empty-text">
                Completed consultations will appear here automatically.
              </p>
            </div>
          )}

          <div className="history-list" id="historyList">
            {(records ?? []).map((record, recordIndex) => {
              const { date, time } = formatTimestamp(record.timestamp)
              return (
                <article className="history-card" key={record.generationId}>
                  <div className="history-card-head">
                    <div className="history-user">
                      <span className="history-user-avatar">
                        <span className="material-symbols-outlined history-user-icon">person</span>
                      </span>
                      <span className="history-user-name">{record.userName}</span>
                    </div>
                    <div className="history-stamp">
                      <span className="history-stamp-date">{date}</span>
                      {time && <span className="history-stamp-time">{time}</span>}
                    </div>
                  </div>

                  <div className="history-card-body">
                    <figure className="history-source">
                      <img
                        alt={`Tile uploaded by ${record.userName}`}
                        className="history-source-image"
                        decoding="async"
                        loading="lazy"
                        src={record.croppedImage}
                      />
                      <figcaption className="history-source-caption">Tile</figcaption>
                    </figure>

                    <div className="history-results">
                      {record.generatedImages.map((image, imageIndex) => (
                        <button
                          aria-label={`View concept ${imageIndex + 1} full size`}
                          className="history-result"
                          key={`${record.generationId}-${imageIndex}`}
                          onClick={() => setLightbox({ recordIndex, imageIndex })}
                          type="button"
                        >
                          <img
                            alt={`Concept ${imageIndex + 1}`}
                            className="history-result-image"
                            decoding="async"
                            loading="lazy"
                            src={image}
                          />
                          <span className="history-result-badge">
                            {String(imageIndex + 1).padStart(2, '0')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </main>

      {lightbox !== null && activeRecord && (
        <div
          aria-label={`Concept ${lightbox.imageIndex + 1} by ${activeRecord.userName} — full size view`}
          aria-modal="true"
          className="lightbox-overlay fixed inset-0 flex items-center justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightbox(null)
          }}
          role="dialog"
        >
          <button
            aria-label="Close full-size view"
            className="lightbox-close-btn"
            onClick={() => setLightbox(null)}
            ref={lightboxCloseRef}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
          {activeImages.length > 1 && (
            <button
              aria-label="Previous concept"
              className="lightbox-nav-btn lightbox-nav-btn--prev"
              onClick={showPrev}
              type="button"
            >
              <span className="material-symbols-outlined text-[24px]">chevron_left</span>
            </button>
          )}
          <img
            alt={`Concept ${lightbox.imageIndex + 1} by ${activeRecord.userName} — full size`}
            className="lightbox-image"
            src={activeImages[lightbox.imageIndex]}
          />
          {activeImages.length > 1 && (
            <button
              aria-label="Next concept"
              className="lightbox-nav-btn lightbox-nav-btn--next"
              onClick={showNext}
              type="button"
            >
              <span className="material-symbols-outlined text-[24px]">chevron_right</span>
            </button>
          )}
          <div className="lightbox-caption">
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
                Concept {String(lightbox.imageIndex + 1).padStart(2, '0')}
              </span>
              <span className="text-outline text-[10px]">•</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
                {activeRecord.userName}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default History
