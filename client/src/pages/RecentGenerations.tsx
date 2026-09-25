import { useEffect, useState } from 'react'
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
    <AppShell title="Recent Generations">
      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}

      {!error && records === null && <p className="ws__loading">Loading…</p>}

      {!error && records?.length === 0 && (
        <p className="ws__empty">Nothing generated yet. Start a new visualization to see it here.</p>
      )}

      {records && records.length > 0 && (
        <ul className="ws__list">
          {records.map((record) => (
            <li className="ws__row" key={record.generationId}>
              <div className="ws__thumbs">
                {record.generatedImages.slice(0, 3).map((image, index) => (
                  <img
                    className="ws__thumb"
                    key={`${record.generationId}-${index}`}
                    src={image}
                    alt={`Concept ${index + 1}`}
                    loading="lazy"
                  />
                ))}
              </div>
              <div className="ws__row-body">
                <span className="ws__row-title">
                  {[record.space, record.style].filter(Boolean).join(' · ') || 'Consultation'}
                </span>
                <span className="ws__row-meta">{formatWhen(record.timestamp)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}

export default RecentGenerations
