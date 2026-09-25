import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, type Architect, type Customer } from '../utils/api'
import './Workspace.css'

/**
 * This salesperson's client book. The server returns only their own records,
 * so there is nothing to filter for ownership here.
 *
 * Adding a client happens at the start of a consultation; opening one here
 * shows their history and the way back into a new visualisation for them.
 */
function Clients() {
  const { token } = useAuth()
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [architects, setArchitects] = useState<Architect[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const [customerList, architectList] = await Promise.all([
          apiGet<Customer[]>('/api/customers', token, controller.signal),
          apiGet<Architect[]>('/api/architects', token, controller.signal),
        ])
        if (controller.signal.aborted) return
        setCustomers(customerList)
        setArchitects(architectList)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load your clients.')
      }
    })()
    return () => controller.abort()
  }, [token])

  const architectName = useMemo(() => {
    const byId = new Map(architects.map((entry) => [entry.id, entry.name]))
    return (id: string | null) => (id ? byId.get(id) ?? 'Architect/Contractor' : 'Direct customer')
  }, [architects])

  // Filtering in the browser: a showroom book is tens of names, not thousands,
  // and this keeps typing instant rather than one request per keystroke.
  const visible = (customers ?? []).filter((customer) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return (
      customer.name.toLowerCase().includes(term) || customer.mobile.toLowerCase().includes(term)
    )
  })

  return (
    <AppShell title="Clients">
      <input
        className="ws__search"
        type="search"
        placeholder="Search by name or mobile"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Search clients"
      />

      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}

      {!error && customers === null && <p className="ws__loading">Loading your clients…</p>}

      {!error && customers !== null && visible.length === 0 && (
        <p className="ws__empty">
          {customers.length === 0
            ? 'No clients yet. They are added at the start of a consultation.'
            : 'No client matches that search.'}
        </p>
      )}

      {visible.length > 0 && (
        <ul className="ws__list">
          {visible.map((customer) => (
            <li key={customer.id}>
              <Link className="ws__row ws__row--button" to={`/clients/${customer.id}`}>
                <div className="ws__row-body">
                  <span className="ws__row-title">{customer.name}</span>
                  <span className="ws__row-meta">{customer.mobile}</span>
                </div>
                <span className="ws__badge">{architectName(customer.architectId)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}

export default Clients
