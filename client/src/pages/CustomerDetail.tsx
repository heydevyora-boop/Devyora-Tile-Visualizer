import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useAuth } from '../state/AuthContext'
import { useFlow } from '../state/FlowContext'
import { ApiError, apiGet, type Customer, type SavedVisualisation } from '../utils/api'
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
  const [records, setRecords] = useState<SavedVisualisation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        // The customer list is already scoped to this salesperson, so a client
        // that is not theirs simply is not in it.
        const [customerList, saved] = await Promise.all([
          apiGet<Customer[]>('/api/customers', token, controller.signal),
          apiGet<SavedVisualisation[]>(
            `/api/generations?customerId=${encodeURIComponent(customerId)}`,
            token,
            controller.signal,
          ),
        ])
        if (controller.signal.aborted) return
        setCustomerRecord(customerList.find((entry) => entry.id === customerId) ?? null)
        setRecords(saved)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load this client.')
      }
    })()
    return () => controller.abort()
  }, [customerId, token])

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
            <dd>{customer.architectId ? 'Via architect/contractor' : 'Direct customer'}</dd>
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

          <h2 className="ws__section-title">Areas visualised</h2>
          {records?.length === 0 && <p className="ws__empty">Nothing saved for this client yet.</p>}
          <ul className="ws__list">
            {(records ?? []).map((record) => (
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
                  <span className="ws__row-title">{record.space ?? 'Unspecified area'}</span>
                  <span className="ws__row-meta">
                    {[record.style, formatWhen(record.timestamp)].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  )
}

export default CustomerDetail
