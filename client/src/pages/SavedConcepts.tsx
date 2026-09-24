import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, type Customer, type SavedVisualisation } from '../utils/api'
import './Workspace.css'

/**
 * The same work as Recent Generations, but arranged the way a salesperson
 * looks it up: by client, and within a client by the room it was for.
 *
 * "Areas" are not stored separately — a saved visualisation records its space,
 * so grouping by that is the area list, and it can never drift out of step.
 */
function SavedConcepts() {
  const { token } = useAuth()
  const [records, setRecords] = useState<SavedVisualisation[] | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const [savedList, customerList] = await Promise.all([
          apiGet<SavedVisualisation[]>('/api/generations', token, controller.signal),
          apiGet<Customer[]>('/api/customers', token, controller.signal),
        ])
        if (controller.signal.aborted) return
        setRecords(savedList)
        setCustomers(customerList)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load saved concepts.')
      }
    })()
    return () => controller.abort()
  }, [token])

  const groups = useMemo(() => {
    const names = new Map(customers.map((customer) => [customer.id, customer.name]))
    const byClient = new Map<string, { label: string; areas: Map<string, number> }>()

    for (const record of records ?? []) {
      // Work generated before a client was attached still has to be findable.
      const key = record.customerId ?? '__none__'
      const label = record.customerId
        ? names.get(record.customerId) ?? 'Client'
        : 'Not linked to a client'
      const group = byClient.get(key) ?? { label, areas: new Map<string, number>() }
      const area = record.space ?? 'Unspecified area'
      group.areas.set(area, (group.areas.get(area) ?? 0) + 1)
      byClient.set(key, group)
    }

    return [...byClient.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label))
  }, [records, customers])

  return (
    <AppShell title="Saved Concepts">
      <p className="ws__lede">Your saved work, grouped by client and the area it was for.</p>

      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}

      {!error && records === null && <p className="ws__loading">Loading…</p>}

      {!error && records?.length === 0 && (
        <p className="ws__empty">Nothing saved yet.</p>
      )}

      {groups.map(([key, group]) => (
        <section key={key}>
          <h2 className="ws__section-title">{group.label}</h2>
          <ul className="ws__list">
            {[...group.areas.entries()].map(([area, count]) => (
              <li className="ws__row" key={`${key}-${area}`}>
                <div className="ws__row-body">
                  <span className="ws__row-title">{area}</span>
                </div>
                <span className="ws__badge">
                  {count} {count === 1 ? 'concept set' : 'concept sets'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </AppShell>
  )
}

export default SavedConcepts
