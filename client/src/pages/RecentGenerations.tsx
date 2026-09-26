import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, type SavedVisualisation } from '../utils/api'
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
 * Everything this salesperson has generated, newest first. The server scopes
 * the response to them; an admin reviewing everyone uses the history screen.
 */
function RecentGenerations() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [records, setRecords] = useState<SavedVisualisation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const list = await apiGet<SavedVisualisation[]>(
          '/api/generations',
          token,
          controller.signal,
        )
        if (!controller.signal.aborted) setRecords(list)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load your generations.')
      }
    })()
    return () => controller.abort()
  }, [token])

  return (
    <AppShell title="Recently Saved">
      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}

      {!error && records === null && <p className="ws__loading">Loading…</p>}

      {!error && records?.length === 0 && (
        <p className="ws__empty">
          Nothing saved yet. Save a concept from a consultation to keep it in the client&rsquo;s
          record.
        </p>
      )}

      {records && records.length > 0 && (
        <ul className="ws__gallery">
          {records.map((record) => (
            <li key={record.id}>
              {/* Opening a saved concept reads the stored record; it is never
                  regenerated. */}
              <button
                className="ws__card"
                type="button"
                onClick={() => navigate(`/saved-concepts/${record.id}`)}
              >
                <img
                  className="ws__card-image"
                  src={record.image}
                  alt={`${record.space ?? 'Saved'} concept`}
                  loading="lazy"
                />
                <span className="ws__card-body">
                  <span className="ws__card-title">
                    {[record.customerName, record.space].filter(Boolean).join(' · ') ||
                      'Saved concept'}
                  </span>
                  <span className="ws__card-meta">{formatWhen(record.savedAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

    </AppShell>
  )
}

export default RecentGenerations
