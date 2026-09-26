import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useAuth } from '../state/AuthContext'
import { useFlow } from '../state/FlowContext'
import { ApiError, apiGet, type Architect, type Customer, type SavedVisualisation } from '../utils/api'
import './Workspace.css'

function formatWhen(timestamp: string): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp
  return `${parsed.toLocaleDateString()} · ${parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/**
 * One client: their details, every area visualised for them, and the way back
 * into a new consultation without re-entering anything.
 */
function CustomerDetail() {
  const { customerId = '' } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { setCustomer } = useFlow()

  const [customer, setCustomerRecord] = useState<Customer | null>(null)
  const [architect, setArchitect] = useState<Architect | null>(null)
  const [records, setRecords] = useState<SavedVisualisation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        // The customer list is already scoped to this salesperson, so a client
        // that is not theirs simply is not in it.
        const [customerList, architectList, saved] = await Promise.all([
          apiGet<Customer[]>('/api/customers', token, controller.signal),
          apiGet<Architect[]>('/api/architects', token, controller.signal),
          apiGet<SavedVisualisation[]>(
            `/api/generations?customerId=${encodeURIComponent(customerId)}`,
            token,
            controller.signal,
          ),
        ])
        if (controller.signal.aborted) return
        const found = customerList.find((entry) => entry.id === customerId) ?? null
        setCustomerRecord(found)
        setArchitect(
          found?.architectId
            ? architectList.find((entry) => entry.id === found.architectId) ?? null
            : null,
        )
        setRecords(saved)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load this client.')
      }
    })()
    return () => controller.abort()
  }, [customerId, token])

  /**
   * The client's record, area by area.
   *
   * Areas are not a separate thing the showroom maintains: a saved concept
   * records the space it was for, so grouping by that IS the area list and it
   * can never drift out of step with what was actually saved.
   */
  const areas = useMemo(() => {
    const byArea = new Map<string, SavedVisualisation[]>()
    for (const record of records ?? []) {
      const area = record.space ?? 'Unspecified area'
      byArea.set(area, [...(byArea.get(area) ?? []), record])
    }
    return [...byArea.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [records])

  const startForThisClient = () => {
    if (!customer) return
    setCustomer(customer)
    navigate('/home')
  }

  return (
    <AppShell title={customer?.name ?? 'Client'}>
      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}

      {!error && customer === null && records === null && <p className="ws__loading">Loading…</p>}

      {!error && customer === null && records !== null && (
        <p className="ws__empty">That client was not found in your book.</p>
      )}

      {customer && (
        <>
          <dl className="ws__definition">
            <dt>Mobile</dt>
            <dd>{customer.mobile}</dd>
            <dt>Type</dt>
            <dd>
              {customer.architectId
                ? `Via ${architect?.name ?? 'architect/contractor'}`
                : 'Direct customer'}
            </dd>
          </dl>

          <div className="ws__actions">
            <button
              className="ws__action ws__action--primary"
              type="button"
              onClick={startForThisClient}
            >
              <span className="material-symbols-outlined">add_a_photo</span>
              <span>New visualization for this client</span>
            </button>
          </div>

          <h2 className="ws__section-title">Saved visualizations</h2>
          {records?.length === 0 && (
            <p className="ws__empty">
              Nothing saved for this client yet. Concepts appear here once you save them from a
              consultation.
            </p>
          )}

          {areas.map(([area, saved]) => (
            <section className="ws__area" key={area}>
              <h3 className="ws__area-title">{area}</h3>
              <ul className="ws__gallery">
                {saved.map((record) => (
                  <li key={record.id}>
                    {/* Opening a saved concept reads the stored record. It is
                        never regenerated: what the customer agreed to is what
                        they have to see. */}
                    <button
                      className="ws__card"
                      type="button"
                      onClick={() => navigate(`/saved-concepts/${record.id}`)}
                    >
                      <img
                        className="ws__card-image"
                        src={record.image}
                        alt={`${area} concept ${record.revision}`}
                        loading="lazy"
                      />
                      <span className="ws__card-body">
                        <span className="ws__card-title">
                          {[record.styleName, record.tileSize].filter(Boolean).join(' · ') ||
                            `Concept ${record.revision}`}
                        </span>
                        <span className="ws__card-meta">{formatWhen(record.savedAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </AppShell>
  )
}

export default CustomerDetail
