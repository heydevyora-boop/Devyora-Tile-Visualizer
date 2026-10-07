import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import GenerationImage from '../components/GenerationImage'
import { useAuth } from '../state/AuthContext'
import {
  ApiError,
  apiGet,
  apiPost,
  type GenerationActivity,
  type SavedVisualisation,
} from '../utils/api'
import { getCached, setCached } from '../utils/apiCache'
import './Workspace.css'

/** Date and time as a showroom would read them, not an ISO string. */
function formatWhen(timestamp: string): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp
  return `${parsed.toLocaleDateString()} · ${parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/**
 * One visualization: a consultation's request and every image made for it.
 * The first image is Version 01; each "Want another concept?" correction of it
 * is the next version of the same visualization, not a new one.
 */
type Visualization = {
  generationId: string
  /** 1 for the user's first visualization, in the order they were started. */
  number: number
  customerName: string | null
  space: string | null
  /** Oldest first: Version 01 is the original. */
  versions: GenerationActivity[]
}

/**
 * The records grouped by their stored lineage. The server gives every new
 * visualization its own generationId, and a correction the generationId of the
 * visualization it corrects with the next revision number, so this is the
 * recorded relationship, not a guess. Numbered in the order started (so a
 * visualization keeps its number), listed most recent activity first.
 */
function groupVisualizations(records: GenerationActivity[]): Visualization[] {
  const byGeneration = new Map<string, GenerationActivity[]>()
  for (const record of records) {
    const key = record.generationId || record.id
    byGeneration.set(key, [...(byGeneration.get(key) ?? []), record])
  }
  const visualizations: Visualization[] = [...byGeneration.entries()].map(([generationId, list]) => {
    const versions = [...list].sort(
      (a, b) => (a.revision ?? 0) - (b.revision ?? 0) || a.createdAt.localeCompare(b.createdAt),
    )
    return {
      generationId,
      number: 0,
      customerName: versions[0].customerName,
      space: versions[0].space,
      versions,
    }
  })
  const started = (viz: Visualization) => viz.versions[0]?.createdAt ?? ''
  const latest = (viz: Visualization) => viz.versions[viz.versions.length - 1]?.createdAt ?? ''
  ;[...visualizations]
    .sort((a, b) => started(a).localeCompare(started(b)))
    .forEach((viz, index) => {
      viz.number = index + 1
    })
  return visualizations.sort((a, b) => latest(b).localeCompare(latest(a)))
}

/** "01", "02", … */
const twoDigits = (value: number) => String(value).padStart(2, '0')

/**
 * Everything this salesperson has generated, saved or not, as visualizations
 * and their versions.
 *
 * Every successful generation is already recorded with the salesperson who made
 * it; this reads those records (the server scopes them to the signed-in user).
 * Saving is a separate, deliberate step: a concept saved here, or on the result
 * screen, also appears in Saved Concepts. Nothing here saves anything by itself.
 */
// lite=1: every one of this user's generations, without the images. With
// images inline the full list only fits the newest two or three records in a
// response; each card loads its own image instead (GenerationImage below).
const ACTIVITY_KEY = '/api/generations?view=activity&lite=1'
/** The saved list, which Saved Concepts and the dashboard share. */
const SAVED_KEY = '/api/generations'

function RecentGenerations() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [records, setRecords] = useState<GenerationActivity[] | null>(
    () => getCached(ACTIVITY_KEY) ?? null,
  )
  // Which generated concept has been saved, and as which saved record — so a
  // saved one opens its saved page and an unsaved one offers Save.
  const [savedByRevision, setSavedByRevision] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Every visualization starts collapsed; its heading opens and closes it.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const toggle = (generationId: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(generationId)) next.delete(generationId)
      else next.add(generationId)
      return next
    })

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const [activity, saved] = await Promise.all([
          apiGet<GenerationActivity[]>(ACTIVITY_KEY, token, controller.signal),
          apiGet<SavedVisualisation[]>(SAVED_KEY, token, controller.signal),
        ])
        if (controller.signal.aborted) return
        setRecords(activity)
        setCached(ACTIVITY_KEY, activity)
        setSavedByRevision(Object.fromEntries(saved.map((item) => [item.revisionId, item.id])))
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load your generations.')
      }
    })()
    return () => controller.abort()
  }, [token])

  const handleSave = async (record: GenerationActivity) => {
    if (saving) return
    setSaving(record.id)
    setSaveError(null)
    try {
      const saved = await apiPost<SavedVisualisation>(SAVED_KEY, token, { revisionId: record.id })
      setSavedByRevision((current) => ({ ...current, [record.id]: saved.id }))
      // Keep the shared saved list current, so Saved Concepts and the dashboard
      // show it straight away rather than after their own refresh.
      const cachedSaved = getCached<SavedVisualisation[]>(SAVED_KEY)
      if (cachedSaved && !cachedSaved.some((item) => item.id === saved.id)) {
        setCached(SAVED_KEY, [saved, ...cachedSaved])
      }
    } catch (caught) {
      setSaveError(caught instanceof ApiError ? caught.message : 'That concept could not be saved.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <AppShell title="Recent Generations">
      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}
      {saveError && (
        <p className="ws__error" role="alert">
          {saveError}
        </p>
      )}

      {!error && records === null && <p className="ws__loading">Loading…</p>}

      {!error && records?.length === 0 && (
        <p className="ws__empty">
          Nothing generated yet. Every concept you generate appears here automatically.
        </p>
      )}

      {records && records.length > 0 && (
        <ul className="ws__list ws__visualizations">
          {groupVisualizations(records).map((viz) => {
            const open = expanded.has(viz.generationId)
            const panelId = `visualization-${viz.generationId}`
            const title = `Visualization ${twoDigits(viz.number)}`
            const lastAt = viz.versions[viz.versions.length - 1]?.createdAt ?? ''
            return (
              <li key={viz.generationId}>
                {/* The heading is the control: it opens and closes this visualization. */}
                <button
                  aria-controls={panelId}
                  aria-expanded={open}
                  className="ws__row ws__row--button ws__viz-toggle"
                  onClick={() => toggle(viz.generationId)}
                  type="button"
                >
                  <span className="ws__row-body">
                    <span className="ws__row-title">{title}</span>
                    <span className="ws__row-meta">
                      {[viz.customerName, viz.space].filter(Boolean).join(' · ') || 'No client'}
                    </span>
                    <span className="ws__row-meta">
                      {viz.versions.length} {viz.versions.length === 1 ? 'version' : 'versions'} ·{' '}
                      {formatWhen(lastAt)}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`material-symbols-outlined ws__viz-chevron${open ? ' is-open' : ''}`}
                  >
                    chevron_right
                  </span>
                </button>

                {open && (
                  <ul className="ws__gallery ws__viz-versions" id={panelId}>
                    {viz.versions.map((record, versionIndex) => {
                      const savedId = savedByRevision[record.id]
                      const isSaved = Boolean(savedId) || record.savedToClient
                      const label = `Version ${twoDigits(versionIndex + 1)}`
                      const why = [...(record.reasons ?? []), record.note ?? '']
                        .filter(Boolean)
                        .join(' · ')
                      return (
                        <li key={record.id}>
                          <div className="ws__card ws__card--static">
                            {/* The stored image of this version; nothing is regenerated. */}
                            {record.imageUrl ? (
                              <img
                                className="ws__card-image"
                                src={record.imageUrl}
                                alt={`${title}, ${label}`}
                                loading="lazy"
                              />
                            ) : (
                              <GenerationImage
                                className="ws__card-image"
                                id={record.id}
                                alt={`${title}, ${label}`}
                                token={token}
                              />
                            )}
                            <span className="ws__card-body">
                              <span className="ws__card-title">{label}</span>
                              <span className="ws__card-meta">{formatWhen(record.createdAt)}</span>
                              {versionIndex > 0 && why && (
                                <span className="ws__card-meta">{why}</span>
                              )}
                            </span>
                            <span className="ws__card-actions">
                              {isSaved ? (
                                <button
                                  className="ws__badge"
                                  type="button"
                                  disabled={!savedId}
                                  onClick={() => savedId && navigate(`/saved-concepts/${savedId}`)}
                                >
                                  Saved
                                </button>
                              ) : (
                                <button
                                  className="ws__badge ws__badge--action"
                                  type="button"
                                  disabled={saving === record.id}
                                  onClick={() => void handleSave(record)}
                                >
                                  <span className="material-symbols-outlined" aria-hidden="true">
                                    bookmark_add
                                  </span>
                                  {saving === record.id ? 'Saving…' : 'Save'}
                                </button>
                              )}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </AppShell>
  )
}

export default RecentGenerations
