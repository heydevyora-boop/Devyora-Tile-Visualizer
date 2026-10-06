import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GenerationImage from '../components/GenerationImage'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet } from '../utils/api'
import { getCached, setCached } from '../utils/apiCache'
import './History.css'

/** One generation as the lite activity log returns it (images are fetched per record). */
type ActivityRecord = {
  id: string
  generationId?: string
  revision?: number
  salesperson?: string
  salespersonName?: string
  customerName?: string | null
  space?: string | null
  createdAt: string
  reasons?: string[]
  note?: string
}

/** One image in a visualization's lineage: the first render, or a correction of it. */
type Version = {
  id: string
  revision: number
  timestamp: string
  reasons: string[]
  note: string
}

/**
 * One visualization: a consultation's request and every image made for it.
 * The first image is Version 01; each "Want another concept?" correction of
 * it is the next version of the same visualization, not a new one.
 */
type Visualization = {
  generationId: string
  /** 1 for the user's first visualization, in the order they were started. */
  number: number
  customerName: string | null
  space: string | null
  /** Oldest first: Version 01 is the original. */
  versions: Version[]
}

/** Everything one user generated. */
type UserGroup = {
  userId: string
  userName: string
  /** Newest visualization first. */
  visualizations: Visualization[]
  latest: string
}

/**
 * The activity log, arranged as user → visualization → versions.
 *
 * - Users are grouped by the stable account id stored with each generation,
 *   never by display name; the name is only the heading.
 * - A visualization is one generationId. The server gives every new
 *   visualization its own generationId and gives a correction the
 *   generationId of the visualization it corrects (along with its parent
 *   revision and a revision number), so this is the stored lineage, not a
 *   guess from timing or images.
 * - Versions are ordered by that revision number.
 */
function groupHistory(items: ActivityRecord[]): UserGroup[] {
  const users = new Map<string, { userName: string; byGeneration: Map<string, ActivityRecord[]> }>()
  for (const item of items) {
    // A record written before user ids were stored falls back to its name.
    const userId = item.salesperson || `name:${item.salespersonName ?? 'Unknown'}`
    const user = users.get(userId) ?? {
      userName: item.salespersonName ?? 'Unknown',
      byGeneration: new Map<string, ActivityRecord[]>(),
    }
    const generationId = item.generationId || item.id
    user.byGeneration.set(generationId, [...(user.byGeneration.get(generationId) ?? []), item])
    users.set(userId, user)
  }

  const started = (viz: Visualization) => viz.versions[0]?.timestamp ?? ''
  const latestOf = (viz: Visualization) => viz.versions[viz.versions.length - 1]?.timestamp ?? ''

  const groups: UserGroup[] = []
  for (const [userId, user] of users) {
    const visualizations: Visualization[] = [...user.byGeneration.entries()].map(
      ([generationId, records]) => {
        const ordered = [...records].sort(
          (a, b) => (a.revision ?? 0) - (b.revision ?? 0) || a.createdAt.localeCompare(b.createdAt),
        )
        const first = ordered[0]
        return {
          generationId,
          number: 0,
          customerName: first.customerName ?? null,
          space: first.space ?? null,
          versions: ordered.map((record) => ({
            id: record.id,
            revision: record.revision ?? 1,
            timestamp: record.createdAt,
            reasons: record.reasons ?? [],
            note: record.note ?? '',
          })),
        }
      },
    )
    // Numbered in the order they were started, so a visualization keeps its
    // number as more are added; shown with the most recent activity first.
    ;[...visualizations]
      .sort((a, b) => started(a).localeCompare(started(b)))
      .forEach((viz, index) => {
        viz.number = index + 1
      })
    visualizations.sort((a, b) => latestOf(b).localeCompare(latestOf(a)))
    groups.push({
      userId,
      userName: user.userName,
      visualizations,
      latest: visualizations[0] ? latestOf(visualizations[0]) : '',
    })
  }
  // Users in order of their most recent generation.
  return groups.sort((a, b) => b.latest.localeCompare(a.latest))
}

/** "01", "02", … */
const twoDigits = (value: number) => String(value).padStart(2, '0')

/** Open lightbox target: one user's visualization, and which version of it. */
type LightboxTarget = { userId: string; generationId: string; versionIndex: number }

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

// lite=1: every record without its images, so the whole history fits in one
// response (with images inline it was cut to the newest few). Images are
// fetched per record, and only once a user's group is opened.
const ACTIVITY_URL = '/api/generations?view=activity&lite=1'
// This screen caches the UserGroup[] it derives, not the raw response, so it
// uses its own key rather than the request URL another screen caches under.
const CACHE_KEY = '/api/generations::activity-lineage'

function History() {
  const navigate = useNavigate()
  const { logout, token } = useAuth()
  const [records, setRecords] = useState<UserGroup[] | null>(() => getCached(CACHE_KEY) ?? null)
  const [error, setError] = useState<string | null>(null)
  // Every user starts collapsed; the admin opens the ones they want.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
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
        const data = await apiGet<unknown>(ACTIVITY_URL, token, signal)
        const groups = Array.isArray(data) ? groupHistory(data as ActivityRecord[]) : []
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

  const toggleUser = (userId: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })

  const activeUser = lightbox
    ? (records?.find((group) => group.userId === lightbox.userId) ?? null)
    : null
  const activeViz =
    lightbox && activeUser
      ? (activeUser.visualizations.find((viz) => viz.generationId === lightbox.generationId) ?? null)
      : null
  const activeVersions = activeViz?.versions ?? []
  const activeVersion = lightbox ? (activeVersions[lightbox.versionIndex] ?? null) : null

  // Escape / arrow keys and background scroll lock while the lightbox is open,
  // matching the behaviour already established on Results. The arrows move
  // between the versions of the one visualization being viewed.
  useEffect(() => {
    if (lightbox === null) return
    const total = activeVersions.length
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightbox(null)
      } else if (event.key === 'ArrowLeft' && total > 1) {
        setLightbox((current) =>
          current === null
            ? null
            : { ...current, versionIndex: (current.versionIndex + total - 1) % total },
        )
      } else if (event.key === 'ArrowRight' && total > 1) {
        setLightbox((current) =>
          current === null ? null : { ...current, versionIndex: (current.versionIndex + 1) % total },
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
  }, [lightbox, activeVersions.length])

  const showPrev = () =>
    setLightbox((current) =>
      current === null || activeVersions.length < 2
        ? current
        : {
            ...current,
            versionIndex: (current.versionIndex + activeVersions.length - 1) % activeVersions.length,
          },
    )
  const showNext = () =>
    setLightbox((current) =>
      current === null || activeVersions.length < 2
        ? current
        : { ...current, versionIndex: (current.versionIndex + 1) % activeVersions.length },
    )

  const visualizationCount = (records ?? []).reduce(
    (total, group) => total + group.visualizations.length,
    0,
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
                : `${visualizationCount} ${visualizationCount === 1 ? 'visualization' : 'visualizations'} by ${records.length} ${records.length === 1 ? 'user' : 'users'}. Open a user to see their work.`}
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
            {(records ?? []).map((group) => {
              const open = expanded.has(group.userId)
              const panelId = `history-user-${group.userId}`
              const { date } = formatTimestamp(group.latest)
              return (
                <article className="history-card" key={group.userId}>
                  {/* The user is the control: it opens and closes their work. */}
                  <button
                    aria-controls={panelId}
                    aria-expanded={open}
                    className="history-card-head history-user-toggle"
                    onClick={() => toggleUser(group.userId)}
                    type="button"
                  >
                    <span className="history-user">
                      <span className="history-user-avatar">
                        <span className="material-symbols-outlined history-user-icon">person</span>
                      </span>
                      <span className="history-user-name">{group.userName}</span>
                    </span>
                    <span className="history-stamp">
                      <span className="history-stamp-date">
                        {group.visualizations.length}{' '}
                        {group.visualizations.length === 1 ? 'visualization' : 'visualizations'}
                      </span>
                      <span className="history-stamp-time">{date}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`material-symbols-outlined history-user-chevron${open ? ' is-open' : ''}`}
                    >
                      chevron_right
                    </span>
                  </button>

                  {open && (
                    <div className="history-card-body history-visualizations" id={panelId}>
                      {group.visualizations.map((viz) => {
                        const started = formatTimestamp(viz.versions[0]?.timestamp ?? '')
                        const title = `Visualization ${twoDigits(viz.number)}`
                        return (
                          <section className="history-viz" key={viz.generationId}>
                            <header className="history-viz-head">
                              <figure className="history-source">
                                <GenerationImage
                                  alt={`Tile for ${title}`}
                                  className="history-source-image"
                                  field="croppedTileImage"
                                  id={viz.versions[0].id}
                                  token={token}
                                />
                                <figcaption className="history-source-caption">Tile</figcaption>
                              </figure>
                              <div className="history-viz-title-block">
                                <h2 className="history-viz-title">{title}</h2>
                                <p className="history-viz-meta">
                                  {[viz.customerName, viz.space].filter(Boolean).join(' · ') ||
                                    'No client'}
                                </p>
                                <p className="history-viz-meta">
                                  {viz.versions.length}{' '}
                                  {viz.versions.length === 1 ? 'version' : 'versions'} · {started.date}
                                </p>
                              </div>
                            </header>

                            <ol className="history-concepts">
                              {viz.versions.map((version, versionIndex) => {
                                const stamp = formatTimestamp(version.timestamp)
                                const label = `Version ${twoDigits(versionIndex + 1)}`
                                const why = [...version.reasons, version.note]
                                  .filter(Boolean)
                                  .join(' · ')
                                return (
                                  <li className="history-concept" key={version.id}>
                                    <button
                                      aria-label={`View ${title}, ${label} full size`}
                                      className="history-result"
                                      onClick={() =>
                                        setLightbox({
                                          userId: group.userId,
                                          generationId: viz.generationId,
                                          versionIndex,
                                        })
                                      }
                                      type="button"
                                    >
                                      <GenerationImage
                                        alt={`${title}, ${label}`}
                                        className="history-result-image"
                                        id={version.id}
                                        token={token}
                                      />
                                      <span className="history-result-badge">
                                        V{twoDigits(versionIndex + 1)}
                                      </span>
                                    </button>

                                    <div className="history-stamp history-concept-stamp">
                                      <span className="history-concept-title">{label}</span>
                                      <span className="history-stamp-date">{stamp.date}</span>
                                      {stamp.time && (
                                        <span className="history-stamp-time">{stamp.time}</span>
                                      )}
                                      {versionIndex > 0 && why && (
                                        <span className="history-version-why">{why}</span>
                                      )}
                                    </div>
                                  </li>
                                )
                              })}
                            </ol>
                          </section>
                        )
                      })}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      {lightbox !== null && activeUser && activeViz && activeVersion && (
        <div
          aria-label={`Visualization ${twoDigits(activeViz.number)}, Version ${twoDigits(lightbox.versionIndex + 1)} by ${activeUser.userName} — full size view`}
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
          {activeVersions.length > 1 && (
            <button
              aria-label="Previous version"
              className="lightbox-nav-btn lightbox-nav-btn--prev"
              onClick={showPrev}
              type="button"
            >
              <span className="material-symbols-outlined text-[24px]">chevron_left</span>
            </button>
          )}
          <GenerationImage
            alt={`Visualization ${twoDigits(activeViz.number)}, Version ${twoDigits(lightbox.versionIndex + 1)} by ${activeUser.userName} — full size`}
            className="lightbox-image"
            id={activeVersion.id}
            key={activeVersion.id}
            token={token}
          />
          {activeVersions.length > 1 && (
            <button
              aria-label="Next version"
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
                Visualization {twoDigits(activeViz.number)} · Version{' '}
                {twoDigits(lightbox.versionIndex + 1)}
              </span>
              <span className="text-outline text-[10px]">•</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
                {activeUser.userName}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default History
