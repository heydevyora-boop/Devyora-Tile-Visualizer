import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useAuth } from '../state/AuthContext'
import { useFlow } from '../state/FlowContext'
import { ApiError, apiGet, apiPost, type Architect, type Customer } from '../utils/api'
import './Workspace.css'

type Mode = 'customer' | 'architect' | 'new'

const MODES: { id: Mode; label: string }[] = [
  { id: 'customer', label: 'Existing Customer' },
  { id: 'architect', label: 'Architect / Contractor' },
  { id: 'new', label: 'New Customer' },
]

/**
 * Every consultation starts here: whose room are we visualising?
 *
 * Without that, generated concepts have nowhere to be filed and the
 * salesperson cannot show a returning client what was done last time. Picking
 * an existing client skips straight past the form — their details are already
 * known and asking again would be the fastest way to end up with the same
 * person saved twice.
 */
function ClientSelect() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const { setCustomer } = useFlow()

  const [mode, setMode] = useState<Mode>('customer')
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [architects, setArchitects] = useState<Architect[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [selectedArchitect, setSelectedArchitect] = useState<Architect | null>(null)

  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
        setLoadError(caught instanceof ApiError ? caught.message : 'Could not load your clients.')
      }
    })()
    return () => controller.abort()
  }, [token])

  /** Locks the consultation to this client and moves on to the flow. */
  const begin = (customer: Customer) => {
    setCustomer(customer)
    navigate('/home')
  }

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase()
    const pool = selectedArchitect
      ? (customers ?? []).filter((entry) => entry.architectId === selectedArchitect.id)
      : customers ?? []
    if (!term) return pool
    return pool.filter(
      (entry) =>
        entry.name.toLowerCase().includes(term) || entry.mobile.toLowerCase().includes(term),
    )
  }, [customers, search, selectedArchitect])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)

    // Checked here so the salesperson sees it immediately; the server enforces
    // the same rule, which is what actually protects the data.
    if (!name.trim()) return setFormError('Client name is required.')
    if (!mobile.trim()) return setFormError('Mobile number is required.')

    setSaving(true)
    try {
      const created = await apiPost<Customer>('/api/customers', token, {
        name,
        mobile,
        architectId: selectedArchitect?.id ?? null,
      })
      begin(created)
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Could not save this client.')
      setSaving(false)
    }
  }

  return (
    <AppShell title="New Visualization">
      <p className="ws__lede">Who is this consultation for?</p>

      <div className="ws__tabs" role="tablist" aria-label="Client type">
        {MODES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={mode === entry.id}
            className={`ws__tab${mode === entry.id ? ' ws__tab--active' : ''}`}
            onClick={() => {
              setMode(entry.id)
              setFormError(null)
              // The search box only exists on the customer tab; carrying its
              // term across would silently hide an architect's customers.
              setSearch('')
              if (entry.id !== 'architect') setSelectedArchitect(null)
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {loadError && (
        <p className="ws__error" role="alert">
          {loadError}
        </p>
      )}

      {mode === 'customer' && (
        <>
          <input
            className="ws__search"
            type="search"
            placeholder="Search by name or mobile"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search customers"
          />
          {customers === null && !loadError && <p className="ws__loading">Loading…</p>}
          {customers !== null && matches.length === 0 && (
            <p className="ws__empty">
              {customers.length === 0
                ? 'No customers saved yet. Use New Customer to add the first one.'
                : 'No customer matches that search.'}
            </p>
          )}
          <ul className="ws__list">
            {matches.map((customer) => (
              <li key={customer.id}>
                <button className="ws__row ws__row--button" type="button" onClick={() => begin(customer)}>
                  <div className="ws__row-body">
                    <span className="ws__row-title">{customer.name}</span>
                    <span className="ws__row-meta">{customer.mobile}</span>
                  </div>
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {mode === 'architect' && (
        <>
          {!selectedArchitect && (
            <>
              {architects.length === 0 ? (
                <p className="ws__empty">
                  No architects or contractors saved yet. Add one with a customer under New
                  Customer.
                </p>
              ) : (
                <ul className="ws__list">
                  {architects.map((architect) => (
                    <li key={architect.id}>
                      <button
                        className="ws__row ws__row--button"
                        type="button"
                        onClick={() => setSelectedArchitect(architect)}
                      >
                        <div className="ws__row-body">
                          <span className="ws__row-title">{architect.name}</span>
                          <span className="ws__row-meta">{architect.mobile}</span>
                        </div>
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {selectedArchitect && (
            <>
              <button
                className="ws__back"
                type="button"
                onClick={() => setSelectedArchitect(null)}
              >
                <span className="material-symbols-outlined">chevron_left</span>
                <span>All architects</span>
              </button>
              <h2 className="ws__section-title">{selectedArchitect.name}&rsquo;s customers</h2>
              {matches.length === 0 && (
                <p className="ws__empty">
                  No customers under this architect yet. Add one below.
                </p>
              )}
              <ul className="ws__list">
                {matches.map((customer) => (
                  <li key={customer.id}>
                    <button
                      className="ws__row ws__row--button"
                      type="button"
                      onClick={() => begin(customer)}
                    >
                      <div className="ws__row-body">
                        <span className="ws__row-title">{customer.name}</span>
                        <span className="ws__row-meta">{customer.mobile}</span>
                      </div>
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </li>
                ))}
              </ul>
              <h2 className="ws__section-title">Add a customer under {selectedArchitect.name}</h2>
              <NewCustomerForm
                name={name}
                mobile={mobile}
                error={formError}
                saving={saving}
                onName={setName}
                onMobile={setMobile}
                onSubmit={handleCreate}
              />
            </>
          )}
        </>
      )}

      {mode === 'new' && (
        <>
          {architects.length > 0 && (
            <label className="ws__field">
              <span className="ws__field-label">Introduced by (optional)</span>
              <select
                className="ws__search"
                value={selectedArchitect?.id ?? ''}
                onChange={(event) =>
                  setSelectedArchitect(
                    architects.find((entry) => entry.id === event.target.value) ?? null,
                  )
                }
              >
                <option value="">Direct customer — no architect</option>
                {architects.map((architect) => (
                  <option key={architect.id} value={architect.id}>
                    {architect.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <NewCustomerForm
            name={name}
            mobile={mobile}
            error={formError}
            saving={saving}
            onName={setName}
            onMobile={setMobile}
            onSubmit={handleCreate}
          />
        </>
      )}
    </AppShell>
  )
}

/** Name and mobile, both required — the minimum to file a consultation. */
function NewCustomerForm({
  name,
  mobile,
  error,
  saving,
  onName,
  onMobile,
  onSubmit,
}: {
  name: string
  mobile: string
  error: string | null
  saving: boolean
  onName: (value: string) => void
  onMobile: (value: string) => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <label className="ws__field">
        <span className="ws__field-label">Client name</span>
        <input
          className="ws__search"
          value={name}
          onChange={(event) => onName(event.target.value)}
          required
          autoComplete="name"
        />
      </label>
      <label className="ws__field">
        <span className="ws__field-label">Mobile number</span>
        <input
          className="ws__search"
          type="tel"
          value={mobile}
          onChange={(event) => onMobile(event.target.value)}
          required
          autoComplete="tel"
        />
      </label>
      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}
      <button className="ws__action ws__action--primary ws__action--submit" type="submit" disabled={saving}>
        <span className="material-symbols-outlined">arrow_forward</span>
        <span>{saving ? 'Saving…' : 'Save and start'}</span>
      </button>
    </form>
  )
}

export default ClientSelect
