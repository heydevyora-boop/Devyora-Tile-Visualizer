import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, apiPatch, apiPost, type TileFormat } from '../utils/api'
import './Workspace.css'

/**
 * The showroom's standard tile formats.
 *
 * These drive the size step of every consultation, so they belong to the
 * showroom rather than to the code: a format can be added when a new line
 * arrives, corrected when it was entered wrong, retired when it stops being
 * stocked, and moved so the ones sold most sit at the top. Disabling rather
 * than deleting keeps sizes already recorded against past work meaningful.
 *
 * Millimetres only, and no thickness: thickness does not change how a tile
 * lays out, which is all this measurement is used for.
 */
function TileFormatsAdmin() {
  const { token } = useAuth()
  const [formats, setFormats] = useState<TileFormat[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [lengthMm, setLengthMm] = useState('')
  const [breadthMm, setBreadthMm] = useState('')
  const [formatLabel, setFormatLabel] = useState('')

  // The row being edited, with its working values. Held here rather than in
  // each row so only one can be open at a time — two half-finished edits in
  // an ordered list is how the wrong one gets saved.
  const [editing, setEditing] = useState<
    { id: string; lengthMm: string; breadthMm: string; label: string } | null
  >(null)

  const load = async (signal?: AbortSignal) => {
    try {
      // ?all=1 includes disabled formats — this screen manages them, the
      // consultation flow only ever sees the active ones.
      const list = await apiGet<TileFormat[]>('/api/tile-formats?all=1', token, signal)
      if (!signal?.aborted) setFormats(list)
    } catch (caught) {
      if (signal?.aborted) return
      setError(caught instanceof ApiError ? caught.message : 'Could not load the tile formats.')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const run = async (work: () => Promise<TileFormat | TileFormat[]>) => {
    setBusy(true)
    setError(null)
    try {
      const result = await work()
      setFormats(Array.isArray(result) ? result : null)
      if (!Array.isArray(result)) await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That change could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      const created = await apiPost<TileFormat>('/api/tile-formats', token, {
        lengthMm: Number(lengthMm),
        breadthMm: Number(breadthMm),
        label: formatLabel.trim() || undefined,
      })
      setLengthMm('')
      setBreadthMm('')
      setFormatLabel('')
      return created
    })
  }

  const toggleActive = (format: TileFormat) =>
    void run(() =>
      apiPatch<TileFormat>('/api/tile-formats', token, { id: format.id, active: !format.active }),
    )

  const saveEdit = () => {
    if (!editing) return
    void run(async () => {
      const saved = await apiPatch<TileFormat>('/api/tile-formats', token, {
        id: editing.id,
        lengthMm: Number(editing.lengthMm),
        breadthMm: Number(editing.breadthMm),
        // An edit always sends the label outright, including clearing it back
        // to the auto dimensions — a field left untouched in this form is
        // still a deliberate value, not "leave it as it was".
        label: editing.label.trim() || null,
      })
      setEditing(null)
      return saved
    })
  }

  /** Moves one format up or down and sends the whole order back. */
  const move = (index: number, delta: number) => {
    if (!formats) return
    const next = [...formats]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setFormats(next)
    void run(() =>
      apiPatch<TileFormat[]>('/api/tile-formats', token, { order: next.map((f) => f.id) }),
    )
  }

  return (
    <>
          <p className="ws__lede">
            The sizes offered at the start of a consultation, in the order they appear. Millimetres
            only.
          </p>

          {error && (
            <p className="ws__error" role="alert">
              {error}
            </p>
          )}

          <h2 className="ws__section-title">Add a format</h2>
          <form onSubmit={handleAdd}>
            <label className="ws__field">
              <span className="ws__field-label">Length (mm)</span>
              <input
                className="ws__search"
                inputMode="numeric"
                value={lengthMm}
                onChange={(event) => setLengthMm(event.target.value.replace(/\D/g, ''))}
                required
              />
            </label>
            <label className="ws__field">
              <span className="ws__field-label">Breadth (mm)</span>
              <input
                className="ws__search"
                inputMode="numeric"
                value={breadthMm}
                onChange={(event) => setBreadthMm(event.target.value.replace(/\D/g, ''))}
                required
              />
            </label>
            <label className="ws__field">
              <span className="ws__field-label">Name — optional, shown instead of the size</span>
              <input
                className="ws__search"
                value={formatLabel}
                onChange={(event) => setFormatLabel(event.target.value)}
                placeholder={lengthMm && breadthMm ? `${lengthMm} × ${breadthMm} mm` : undefined}
                maxLength={60}
              />
            </label>
            <button className="ws__action ws__action--primary ws__action--submit" type="submit" disabled={busy}>
              <span className="material-symbols-outlined">add</span>
              <span>Add format</span>
            </button>
          </form>

          <h2 className="ws__section-title">Current formats</h2>
          {formats === null && !error && <p className="ws__loading">Loading…</p>}
          {formats?.length === 0 && <p className="ws__empty">No formats yet.</p>}
          <ul className="ws__list">
            {(formats ?? []).map((format, index) =>
              editing?.id === format.id ? (
                <li className="ws__row ws__row--editing" key={format.id}>
                  <div className="ws__edit-fields ws__edit-fields--pair">
                    <label className="ws__field">
                      <span className="ws__field-label">Length (mm)</span>
                      <input
                        className="ws__search"
                        inputMode="numeric"
                        autoFocus
                        value={editing.lengthMm}
                        onChange={(event) =>
                          setEditing({ ...editing, lengthMm: event.target.value.replace(/\D/g, '') })
                        }
                      />
                    </label>
                    <label className="ws__field">
                      <span className="ws__field-label">Breadth (mm)</span>
                      <input
                        className="ws__search"
                        inputMode="numeric"
                        value={editing.breadthMm}
                        onChange={(event) =>
                          setEditing({ ...editing, breadthMm: event.target.value.replace(/\D/g, '') })
                        }
                      />
                    </label>
                    <label className="ws__field">
                      <span className="ws__field-label">Name — optional</span>
                      <input
                        className="ws__search"
                        value={editing.label}
                        onChange={(event) => setEditing({ ...editing, label: event.target.value })}
                        placeholder={`${editing.lengthMm} × ${editing.breadthMm} mm`}
                        maxLength={60}
                      />
                    </label>
                  </div>
                  <div className="ws__edit-actions">
                    <button
                      type="button"
                      className="ws__action ws__action--primary"
                      disabled={busy || !editing.lengthMm || !editing.breadthMm}
                      onClick={saveEdit}
                    >
                      <span className="material-symbols-outlined">check</span>
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      className="ws__action"
                      disabled={busy}
                      onClick={() => setEditing(null)}
                    >
                      <span>Cancel</span>
                    </button>
                  </div>
                </li>
              ) : (
              <li className="ws__row" key={format.id}>
                <div className="ws__row-body">
                  <span className="ws__row-title">
                    {format.label ?? `${format.lengthMm} × ${format.breadthMm} mm`}
                  </span>
                  <span className="ws__row-meta">
                    {[
                      format.label ? `${format.lengthMm} × ${format.breadthMm} mm` : null,
                      format.active ? 'Offered' : 'Disabled',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
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
                    disabled={busy || index === (formats?.length ?? 0) - 1}
                    onClick={() => move(index, 1)}
                  >
                    <span className="material-symbols-outlined">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    className="shell__icon-button"
                    aria-label="Edit size"
                    disabled={busy}
                    onClick={() =>
                      setEditing({
                        id: format.id,
                        lengthMm: String(format.lengthMm),
                        breadthMm: String(format.breadthMm),
                        label: format.label ?? '',
                      })
                    }
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button
                    type="button"
                    className="shell__icon-button"
                    aria-label={format.active ? 'Disable' : 'Enable'}
                    disabled={busy}
                    onClick={() => toggleActive(format)}
                  >
                    <span className="material-symbols-outlined">
                      {format.active ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </li>
              ),
            )}
          </ul>
    </>
  )
}

export default TileFormatsAdmin
