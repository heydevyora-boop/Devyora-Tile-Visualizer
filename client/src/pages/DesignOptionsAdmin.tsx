import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, apiPatch, apiPost, type DesignOption, type DesignOptionKind } from '../utils/api'
import './Workspace.css'

const TABS: { kind: DesignOptionKind; label: string; lede: string }[] = [
  {
    kind: 'style',
    label: 'Styles',
    lede: 'The look of the room around the tile. Write the description the way you would say it to a customer.',
  },
  {
    kind: 'joint',
    label: 'Joint widths',
    lede: 'The grout gap offered as presets. A salesperson can still type any width.',
  },
  {
    kind: 'pattern',
    label: 'Laying patterns',
    lede: 'How the tiles are set out. The description is what the generation is told to follow.',
  },
]

/**
 * The showroom's design options: styles, joint widths and laying patterns.
 *
 * One screen for all three because they are the same job — an ordered,
 * switchable list — and a showroom setting up its catalogue does them in one
 * sitting. Disabling rather than deleting keeps choices recorded against past
 * work meaningful.
 */
function DesignOptionsAdmin() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [options, setOptions] = useState<DesignOption[] | null>(null)
  const [kind, setKind] = useState<DesignOptionKind>('style')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const load = async (signal?: AbortSignal) => {
    try {
      const list = await apiGet<DesignOption[]>('/api/design-options?all=1', token, signal)
      if (!signal?.aborted) setOptions(list)
    } catch (caught) {
      if (signal?.aborted) return
      setError(caught instanceof ApiError ? caught.message : 'Could not load the options.')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That change could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const rows = useMemo(
    () => (options ?? []).filter((option) => option.kind === kind).sort((a, b) => a.order - b.order),
    [options, kind],
  )

  const active = TABS.find((tab) => tab.kind === kind) as (typeof TABS)[number]

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await apiPost<DesignOption>('/api/design-options', token, {
        kind,
        // A joint is identified by its width; everything else by its name.
        ...(kind === 'joint' ? { valueMm: Number(name) } : { name, description, imageUrl }),
      })
      setName('')
      setDescription('')
      setImageUrl('')
    })
  }

  const editField = (option: DesignOption, field: 'name' | 'description' | 'imageUrl', label: string) => {
    const next = window.prompt(label, option[field] ?? '')
    if (next === null) return
    void run(() =>
      apiPatch<DesignOption>('/api/design-options', token, { id: option.id, [field]: next }),
    )
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    void run(() =>
      apiPatch<DesignOption[]>('/api/design-options', token, { order: next.map((o) => o.id) }),
    )
  }

  return (
    <div className="shell">
      <div className="shell__main">
        <header className="shell__topbar">
          <button
            type="button"
            className="shell__icon-button"
            aria-label="Back to history"
            onClick={() => navigate('/history')}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="shell__title">Design Options</h1>
        </header>
        <main className="shell__content">
          <div className="ws__tabs" role="tablist" aria-label="Option kind">
            {TABS.map((tab) => (
              <button
                key={tab.kind}
                type="button"
                role="tab"
                aria-selected={kind === tab.kind}
                className={`ws__tab${kind === tab.kind ? ' ws__tab--active' : ''}`}
                onClick={() => {
                  setKind(tab.kind)
                  setName('')
                  setDescription('')
                  setImageUrl('')
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="ws__lede">{active.lede}</p>

          {error && (
            <p className="ws__error" role="alert">
              {error}
            </p>
          )}

          <h2 className="ws__section-title">Add</h2>
          <form onSubmit={handleAdd}>
            <label className="ws__field">
              <span className="ws__field-label">
                {kind === 'joint' ? 'Joint width (mm)' : 'Name'}
              </span>
              <input
                className="ws__search"
                inputMode={kind === 'joint' ? 'decimal' : 'text'}
                value={name}
                onChange={(event) =>
                  setName(kind === 'joint' ? event.target.value.replace(/[^\d.]/g, '') : event.target.value)
                }
                required
              />
            </label>
            {kind !== 'joint' && (
              <>
                <label className="ws__field">
                  <span className="ws__field-label">Description</span>
                  <input
                    className="ws__search"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                <label className="ws__field">
                  <span className="ws__field-label">Image URL</span>
                  <input
                    className="ws__search"
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                  />
                </label>
              </>
            )}
            <button
              className="ws__action ws__action--primary ws__action--submit"
              type="submit"
              disabled={busy}
            >
              <span className="material-symbols-outlined">add</span>
              <span>Add</span>
            </button>
          </form>

          <h2 className="ws__section-title">{active.label}</h2>
          {options === null && !error && <p className="ws__loading">Loading…</p>}
          {options !== null && rows.length === 0 && <p className="ws__empty">Nothing here yet.</p>}
          <ul className="ws__list">
            {rows.map((option, index) => (
              <li className="ws__row" key={option.id}>
                {option.imageUrl && (
                  <img className="ws__thumb" src={option.imageUrl} alt="" loading="lazy" />
                )}
                <div className="ws__row-body">
                  <span className="ws__row-title">{option.name}</span>
                  <span className="ws__row-meta">
                    {option.active ? 'Offered' : 'Disabled'}
                    {option.description ? ` · ${option.description}` : ''}
                  </span>
                </div>
                <div className="ws__row-tools">
                  <button
                    type="button"
                    className="shell__icon-button"
                    aria-label="Move up"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <span className="material-symbols-outlined">arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    className="shell__icon-button"
                    aria-label="Move down"
                    disabled={busy || index === rows.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <span className="material-symbols-outlined">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    className="shell__icon-button"
                    aria-label={option.kind === 'joint' ? 'Edit width' : 'Rename'}
                    disabled={busy}
                    onClick={() =>
                      option.kind === 'joint'
                        ? (() => {
                            const next = window.prompt('Joint width in millimetres', String(option.valueMm ?? ''))
                            if (next === null) return
                            void run(() =>
                              apiPatch<DesignOption>('/api/design-options', token, {
                                id: option.id,
                                valueMm: Number(next),
                              }),
                            )
                          })()
                        : editField(option, 'name', 'Name')
                    }
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  {option.kind !== 'joint' && (
                    <>
                      <button
                        type="button"
                        className="shell__icon-button"
                        aria-label="Edit description"
                        disabled={busy}
                        onClick={() => editField(option, 'description', 'Description')}
                      >
                        <span className="material-symbols-outlined">notes</span>
                      </button>
                      <button
                        type="button"
                        className="shell__icon-button"
                        aria-label="Edit image"
                        disabled={busy}
                        onClick={() => editField(option, 'imageUrl', 'Image URL')}
                      >
                        <span className="material-symbols-outlined">image</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="shell__icon-button"
                    aria-label={option.active ? 'Disable' : 'Enable'}
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        apiPatch<DesignOption>('/api/design-options', token, {
                          id: option.id,
                          active: !option.active,
                        }),
                      )
                    }
                  >
                    <span className="material-symbols-outlined">
                      {option.active ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div>
  )
}

export default DesignOptionsAdmin
