import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, type Customer, type SavedVisualisation } from '../utils/api'
import './Workspace.css'

/**
 * The salesperson's starting point: what they have on the go, and the one
 * button they press most. Everything here is scoped to them by the server.
 */
function Dashboard() {
  const { token, userName } = useAuth()
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [saved, setSaved] = useState<SavedVisualisation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const [customerList, savedList] = await Promise.all([
          apiGet<Customer[]>('/api/customers', token, controller.signal),
          apiGet<SavedVisualisation[]>('/api/generations', token, controller.signal),
        ])
        if (controller.signal.aborted) return
        setCustomers(customerList)
        setSaved(savedList)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load your workspace.')
      }
    })()
    return () => controller.abort()
  }, [token])

  // The rooms this salesperson has already visualised, which is what "areas"
  // means in practice — no separate list to keep in step.
  const areaCount = new Set((saved ?? []).map((item) => item.space).filter(Boolean)).size

  return (
    <AppShell title="Dashboard">
      <p className="ws__lede">
        {userName ? `Welcome back, ${userName}.` : 'Welcome back.'} Start a consultation, or pick up
        where you left off.
      </p>

      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}

      <div className="ws__stats">
        <div className="ws__stat">
          <span className="ws__stat-value">{customers?.length ?? '—'}</span>
          <span className="ws__stat-label">Clients</span>
        </div>
        <div className="ws__stat">
          <span className="ws__stat-value">{saved?.length ?? '—'}</span>
          <span className="ws__stat-label">Visualizations</span>
        </div>
        <div className="ws__stat">
          <span className="ws__stat-value">{saved ? areaCount : '—'}</span>
          <span className="ws__stat-label">Areas covered</span>
        </div>
      </div>

      <h2 className="ws__section-title">Quick actions</h2>
      <div className="ws__actions">
        <Link className="ws__action ws__action--primary" to="/start">
          <span className="material-symbols-outlined">add_a_photo</span>
          <span>New Visualization</span>
        </Link>
        <Link className="ws__action" to="/clients">
          <span className="material-symbols-outlined">group</span>
          <span>Clients</span>
        </Link>
        <Link className="ws__action" to="/recent-generations">
          <span className="material-symbols-outlined">history</span>
          <span>Recent Generations</span>
        </Link>
      </div>
    </AppShell>
  )
}

export default Dashboard
