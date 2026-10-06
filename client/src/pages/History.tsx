import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet } from '../utils/api'
import { getCached, setCached } from '../utils/apiCache'
import './History.css'

/** One generated concept, flattened to what its row needs. */
type Concept = {
  generationId: string
  croppedImage: string
  image: string
  timestamp: string
}

/** Everything one user generated: their card, holding their concepts. */
type UserGroup = {
  userId: string
  userName: string
  concepts: Concept[]
}

/** One generation as the activity log returns it. */
type ActivityRecord = {
  id: string
  salesperson?: string
  salespersonName?: string
  croppedTileImage?: string | null
  imageUrl: string
  createdAt: string
}

/**
 * The log of everything that was generated — whether or not the salesperson
 * then saved it to a client, which is a separate record — gathered into one
 * card per user.
 *
 * Grouped by the stable account id the server recorded with each generation,
 * never by the display name, so two people with the same name stay apart and
 * a renamed account stays together. The name is only the heading. The log
 * arrives newest first, so each user's concepts keep that order, and users
 * appear in order of their most recent generation.
 */
function groupByUser(items: ActivityRecord[]): UserGroup[] {
  const groups = new Map<string, UserGroup>()
  for (const item of items) {
    // A record written before user ids were stored falls back to its name.
    const userId = item.salesperson || `name:${item.salespersonName ?? 'Unknown'}`
    const group = groups.get(userId) ?? {
      userId,
      userName: item.salespersonName ?? 'Unknown',
      concepts: [],
    }
    group.concepts.push({
      generationId: item.id,
      croppedImage: item.croppedTileImage ?? item.imageUrl,
      image: item.imageUrl,
      timestamp: item.createdAt,
    })
    groups.set(userId, group)
  }
  return [...groups.values()]
}

/** "01", "02", … — a concept's number within its user's group. */
const conceptNumber = (index: number) => String(index + 1).padStart(2, '0')

/** Open lightbox target: which user's group, and which concept within it. */
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

// Not '/api/generations' on its own: this screen caches the mapped
// UserGroup[] it derives from that response, not the raw
// SavedVisualisation[] that Dashboard, RecentGenerations and SavedConcepts
// fetch from the same endpoint and cache under the plain URL. Sharing a key
// across two different shapes would hand one of them the other's data.
const CACHE_KEY = '/api/generations::activity-by-user'

function History() {
  const navigate = useNavigate()
  const { logout, token } = useAuth()
  const [records, setRecords] = useState<UserGroup[] | null>(() => getCached(CACHE_KEY) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<LightboxTarget | null>(null)
  const lightboxCloseRef = useRef<HTMLButtonElement>(null)

  const loadHistory = useCallback(
    async (signal?: AbortSignal) => {
      setError(null)
      try {
        // apiGet is what every other screen uses, and for a reason that
        // matters here specifically: it reads the response body's own
        // `error` field, which is where the database-failure work put a
        // real, specific cause ("could not be reached", "rejected the
        // sign-in", …) rather than a bare status code. A raw fetch() that
        // only checks response.ok throws that detail away.
        const data = await apiGet<unknown>('/api/generations?view=activity', token, signal)
        const groups = Array.isArray(data) ? groupByUser(data as ActivityRecord[]) : []
        setRecords(groups)
        setCached(CACHE_KEY, groups)
      } catch (loadError) {
        if (signal?.aborted) return
        if (loadError instanceof ApiError && loadError.status === 401) {
          // The session was rejected server-side (expired, or somehow not an
          // admin token) — sign out rather than show a bare error.
          logout()
          navigate('/', { replace: true })
          return
        }
        setRecords([])
        setError(
          loadError instanceof ApiError && loadError.message
            ? loadError.message
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
  const activeImages = activeRecord?.concepts.map((concept) => concept.image) ?? []
  const generationCount = (records ?? []).reduce((total, group) => total + group.concepts.length, 0)

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
    <>
        <div className="history-content">
          <section className="history-intro">
            <p className="history-eyebrow">Archive</p>
            <h1 className="history-title">All Generations</h1>
            <p className="history-subtitle">
              {records === null
                ? 'Loading generations…'
                : `${generationCount} ${generationCount === 1 ? 'generation' : 'generations'} by ${records.length} ${records.length === 1 ? 'user' : 'users'}, newest first.`}
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
              <p className="history-empty-title">Nothing generated yet</p>
              <p className="history-empty-text">
                Every concept a salesperson generates appears here.
              </p>
            </div>
          )}

          <div className="history-list" id="historyList">
            {(records ?? []).map((record, recordIndex) => {
              const latest = record.concepts[0]
              const { date, time } = formatTimestamp(latest?.timestamp ?? '')
              return (
                <article className="history-card" key={record.userId}>
                  <div className="history-card-head">
                    <div className="history-user">
                      <span className="history-user-avatar">
                        <span className="material-symbols-outlined history-user-icon">person</span>
                      </span>
                      <span className="history-user-name">{record.userName}</span>
                    </div>
                    <div className="history-stamp">
                      <span className="history-stamp-date">
                        {record.concepts.length}{' '}
                        {record.concepts.length === 1 ? 'concept' : 'concepts'}
                      </span>
                      <span className="history-stamp-time">{date}</span>
                      {time && <span className="history-stamp-time">{time}</span>}
                    </div>
                  </div>

                  <ol className="history-card-body history-concepts">
                    {record.concepts.map((concept, imageIndex) => {
                      const stamp = formatTimestamp(concept.timestamp)
                      return (
                        <li className="history-concept" key={concept.generationId}>
                          <figure className="history-source">
                            <img
                              alt={`Tile uploaded by ${record.userName}`}
                              className="history-source-image"
                              decoding="async"
                              loading="lazy"
                              src={concept.croppedImage}
                            />
                            <figcaption className="history-source-caption">Tile</figcaption>
                          </figure>

                          <button
                            aria-label={`View concept ${imageIndex + 1} by ${record.userName} full size`}
                            className="history-result"
                            onClick={() => setLightbox({ recordIndex, imageIndex })}
                            type="button"
                          >
                            <img
                              alt={`Concept ${imageIndex + 1}`}
                              className="history-result-image"
                              decoding="async"
                              loading="lazy"
                              src={concept.image}
                            />
                            <span className="history-result-badge">{conceptNumber(imageIndex)}</span>
                          </button>

                          <div className="history-stamp history-concept-stamp">
                            <span className="history-concept-title">Concept {conceptNumber(imageIndex)}</span>
                            <span className="history-stamp-date">{stamp.date}</span>
                            {stamp.time && <span className="history-stamp-time">{stamp.time}</span>}
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </article>
              )
            })}
          </div>
        </div>
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
                Concept {conceptNumber(lightbox.imageIndex)}
              </span>
              <span className="text-outline text-[10px]">•</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
                {activeRecord.userName}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default History
