import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, type SavedVisualisation } from '../utils/api'
import './Workspace.css'

function formatWhen(timestamp: string): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp
  return parsed.toLocaleDateString()
}

/** One customer within an introducer, and the areas saved for them. */
interface CustomerGroup {
  id: string | null
  name: string
  areas: Map<string, SavedVisualisation[]>
}

/**
 * Every saved concept, arranged the way the showroom talks about its work:
 *
 *   Architect/contractor → Customer → Area → Saved visualizations
 *
 * A walk-in customer has no architect, so they sit under "Direct customers" —
 * the same three levels, with the top one standing for "nobody introduced
 * them" rather than being a separate shape of record.
 *
 * None of these levels is stored as its own thing. A saved concept records who
 * introduced the client, who the client is and which area it was for, so this
 * grouping is derived from the saved work itself and can never drift out of
 * step with it.
 */
function SavedConcepts() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [records, setRecords] = useState<SavedVisualisation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const saved = await apiGet<SavedVisualisation[]>(
          '/api/generations',
          token,
          controller.signal,
        )
        if (!controller.signal.aborted) setRecords(saved)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load saved concepts.')
      }
    })()
    return () => controller.abort()
  }, [token])

  const introducers = useMemo(() => {
    const byIntroducer = new Map<string, { label: string; customers: Map<string, CustomerGroup> }>()

    for (const record of records ?? []) {
      const introducerKey = record.architectId ?? '__direct__'
      const introducerLabel = record.architectId
        ? record.architectName ?? 'Architect/contractor'
        : 'Direct customers'
      const introducer = byIntroducer.get(introducerKey) ?? {
        label: introducerLabel,
        customers: new Map<string, CustomerGroup>(),
      }

      const customerKey = record.customerId ?? '__none__'
      const customer = introducer.customers.get(customerKey) ?? {
        id: record.customerId,
        name: record.customerName ?? 'Not linked to a client',
        areas: new Map<string, SavedVisualisation[]>(),
      }

      const area = record.space ?? 'Unspecified area'
      customer.areas.set(area, [...(customer.areas.get(area) ?? []), record])
      introducer.customers.set(customerKey, customer)
      byIntroducer.set(introducerKey, introducer)
    }

    return [...byIntroducer.entries()].sort((a, b) => {
      // Direct customers last: an introducer is a relationship, "direct" is the
      // absence of one.
      if (a[0] === '__direct__') return 1
      if (b[0] === '__direct__') return -1
      return a[1].label.localeCompare(b[1].label)
    })
  }, [records])

  return (
    <AppShell title="Saved Concepts">
      <p className="ws__lede">
        The concepts you kept, by who introduced the client, the client, and the area.
      </p>

      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}

      {!error && records === null && <p className="ws__loading">Loading…</p>}

      {!error && records?.length === 0 && (
        <p className="ws__empty">
          Nothing saved yet. A generated concept stays temporary until you save it to a client.
        </p>
      )}

      {introducers.map(([introducerKey, introducer]) => (
        <section key={introducerKey}>
          <h2 className="ws__section-title">{introducer.label}</h2>

          {[...introducer.customers.values()]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((customer) => (
              <div key={`${introducerKey}-${customer.id ?? 'none'}`}>
                <ul className="ws__list">
                  <li className="ws__row">
                    <div className="ws__row-body">
                      <span className="ws__row-title">{customer.name}</span>
                      <span className="ws__row-meta">
                        {customer.areas.size} {customer.areas.size === 1 ? 'area' : 'areas'}
                      </span>
                    </div>
                    {customer.id && (
                      <button
                        className="ws__badge"
                        type="button"
                        onClick={() => navigate(`/clients/${customer.id}`)}
                      >
                        Open client
                      </button>
                    )}
                  </li>
                </ul>

                {[...customer.areas.entries()]
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([area, saved]) => (
                    <section className="ws__area" key={`${customer.id ?? 'none'}-${area}`}>
                      <h3 className="ws__area-title">{area}</h3>
                      <ul className="ws__gallery">
                        {saved.map((record) => (
                          <li key={record.id}>
                            {/* Opens the stored record. Nothing is regenerated. */}
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
                                  {record.styleName ?? `Concept ${record.revision}`}
                                </span>
                                <span className="ws__card-meta">{formatWhen(record.savedAt)}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
              </div>
            ))}
        </section>
      ))}
    </AppShell>
  )
}

export default SavedConcepts
