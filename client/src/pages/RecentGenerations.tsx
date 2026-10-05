import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
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
 * Everything this salesperson has generated, newest first — saved or not.
 *
 * Every successful generation is already recorded with the salesperson who made
 * it; this reads those records (the server scopes them to the signed-in user).
 * Saving is a separate, deliberate step: a concept saved here, or on the result
 * screen, also appears in Saved Concepts. Nothing here saves anything by itself.
 */
const ACTIVITY_KEY = '/api/generations?view=activity'
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
        <ul className="ws__gallery">
          {records.map((record) => {
            const savedId = savedByRevision[record.id]
            const isSaved = Boolean(savedId) || record.savedToClient
            return (
              <li key={record.id}>
                <div className="ws__card ws__card--static">
                  {/* The stored image of the concept; nothing is regenerated. */}
                  <img
                    className="ws__card-image"
                    src={record.imageUrl}
                    alt={`${record.space ?? 'Generated'} concept`}
                    loading="lazy"
                  />
                  <span className="ws__card-body">
                    <span className="ws__card-title">
                      {[record.customerName, record.space].filter(Boolean).join(' · ') ||
                        'Generated concept'}
                    </span>
                    <span className="ws__card-meta">{formatWhen(record.createdAt)}</span>
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
    </AppShell>
  )
}

export default RecentGenerations
