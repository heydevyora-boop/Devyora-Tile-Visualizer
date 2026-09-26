import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, apiPatch, apiPost, type SpaceNode } from '../utils/api'
import './Workspace.css'

/**
 * The showroom's space catalogue: categories, the applications under them, and
 * any deeper choice such as half or full height.
 *
 * The tree has no fixed depth. An entry's parent decides where it sits, so a
 * new level is made simply by adding an entry under an existing one — nothing
 * in the consultation screens needs to know it happened.
 *
 * Disabling rather than deleting keeps applications recorded against past work
 * meaningful, and takes them out of the flow immediately.
 */
function SpaceCatalogueAdmin() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [nodes, setNodes] = useState<SpaceNode[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [parentId, setParentId] = useState('')

  // One row open at a time, with its working values.
  const [editing, setEditing] = useState<
    { id: string; name: string; description: string; imageUrl: string; parentId: string } | null
  >(null)

  const load = async (signal?: AbortSignal) => {
    try {
      const list = await apiGet<SpaceNode[]>('/api/space-nodes?all=1', token, signal)
      if (!signal?.aborted) setNodes(list)
    } catch (caught) {
      if (signal?.aborted) return
      setError(caught instanceof ApiError ? caught.message : 'Could not load the catalogue.')
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

  /** Flattens the tree for display, so depth is visible at a glance. */
  const rows = useMemo(() => {
    const byParent = new Map<string | null, SpaceNode[]>()
    for (const node of nodes ?? []) {
      const list = byParent.get(node.parentId) ?? []
      list.push(node)
      byParent.set(node.parentId, list)
    }
    for (const list of byParent.values()) list.sort((a, b) => a.order - b.order)

    const out: { node: SpaceNode; depth: number; siblings: SpaceNode[]; index: number }[] = []
    const walk = (parent: string | null, depth: number) => {
      const siblings = byParent.get(parent) ?? []
      siblings.forEach((node, index) => {
        out.push({ node, depth, siblings, index })
        walk(node.id, depth + 1)
      })
    }
    walk(null, 0)
    return out
  }, [nodes])

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await apiPost<SpaceNode>('/api/space-nodes', token, {
        name,
        description,
        imageUrl,
        parentId: parentId || null,
      })
      setName('')
      setDescription('')
      setImageUrl('')
    })
  }

  const saveEdit = () => {
    if (!editing) return
    void run(async () => {
      const saved = await apiPatch<SpaceNode>('/api/space-nodes', token, {
        id: editing.id,
        name: editing.name,
        description: editing.description,
        imageUrl: editing.imageUrl,
        parentId: editing.parentId || null,
      })
      setEditing(null)
      return saved
    })
  }

  const move = (row: { node: SpaceNode; siblings: SpaceNode[]; index: number }, delta: number) => {
    const target = row.index + delta
    if (target < 0 || target >= row.siblings.length) return
    const next = [...row.siblings]
    ;[next[row.index], next[target]] = [next[target], next[row.index]]
    void run(() =>
      apiPatch<SpaceNode[]>('/api/space-nodes', token, { order: next.map((n) => n.id) }),
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
          <h1 className="shell__title">Space Catalogue</h1>
        </header>
        <main className="shell__content">
          <p className="ws__lede">
            Categories, their applications, and any deeper choice. Add an entry under another to
            create a further level — there is no fixed depth.
          </p>

          {error && (
            <p className="ws__error" role="alert">
              {error}
            </p>
          )}

          <h2 className="ws__section-title">Add an entry</h2>
          <form onSubmit={handleAdd}>
            <label className="ws__field">
              <span className="ws__field-label">Sits under</span>
              <select
                className="ws__search"
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">Top level — a new category</option>
                {rows.map(({ node, depth }) => (
                  <option key={node.id} value={node.id}>
                    {'— '.repeat(depth)}
                    {node.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ws__field">
              <span className="ws__field-label">Name</span>
              <input
                className="ws__search"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label className="ws__field">
              <span className="ws__field-label">Description — what this application means</span>
              <input
                className="ws__search"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="ws__field">
              <span className="ws__field-label">Image URL — the reference photograph</span>
              <input
                className="ws__search"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
              />
            </label>
            <button
              className="ws__action ws__action--primary ws__action--submit"
              type="submit"
              disabled={busy}
            >
              <span className="material-symbols-outlined">add</span>
              <span>Add entry</span>
            </button>
          </form>

          <h2 className="ws__section-title">Catalogue</h2>
          {nodes === null && !error && <p className="ws__loading">Loading…</p>}
          <ul className="ws__list">
            {rows.map((row) =>
              editing?.id === row.node.id ? (
                <li
                  className="ws__row ws__row--editing"
                  key={row.node.id}
                  style={{ marginLeft: `${row.depth * 1.25}rem` }}
                >
                  <div className="ws__edit-fields">
                    <label className="ws__field">
                      <span className="ws__field-label">Name</span>
                      <input
                        className="ws__search"
                        autoFocus
                        value={editing.name}
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                      />
                    </label>
                    <label className="ws__field">
                      <span className="ws__field-label">Description — what this application means</span>
                      <input
                        className="ws__search"
                        value={editing.description}
                        onChange={(event) =>
                          setEditing({ ...editing, description: event.target.value })
                        }
                      />
                    </label>
                    <label className="ws__field">
                      <span className="ws__field-label">Image URL</span>
                      <input
                        className="ws__search"
                        value={editing.imageUrl}
                        onChange={(event) => setEditing({ ...editing, imageUrl: event.target.value })}
                      />
                    </label>
                    <label className="ws__field">
                      <span className="ws__field-label">Sits under</span>
                      <select
                        className="ws__search"
                        value={editing.parentId}
                        onChange={(event) => setEditing({ ...editing, parentId: event.target.value })}
                      >
                        <option value="">Top level — a category</option>
                        {rows
                          .filter((candidate) => candidate.node.id !== row.node.id)
                          .map((candidate) => (
                            <option key={candidate.node.id} value={candidate.node.id}>
                              {'— '.repeat(candidate.depth)}
                              {candidate.node.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="ws__edit-actions">
                    <button
                      type="button"
                      className="ws__action ws__action--primary"
                      disabled={busy || !editing.name.trim()}
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
              <li
                className="ws__row"
                key={row.node.id}
                style={{ marginLeft: `${row.depth * 1.25}rem` }}
              >
                {row.node.imageUrl && (
                  <img className="ws__thumb" src={row.node.imageUrl} alt="" loading="lazy" />
                )}
                <div className="ws__row-body">
                  <span className="ws__row-title">{row.node.name}</span>
                  <span className="ws__row-meta">
                    {row.node.active ? 'Offered' : 'Disabled'}
                    {row.node.description ? ` · ${row.node.description}` : ''}
                  </span>
                </div>
                <div className="ws__row-tools">
                  <button
                    type="button"
                    className="shell__icon-button"
                    aria-label="Move up"
                    disabled={busy || row.index === 0}
                    onClick={() => move(row, -1)}
                  >
                    <span className="material-symbols-outlined">arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    className="shell__icon-button"
                    aria-label="Move down"
                    disabled={busy || row.index === row.siblings.length - 1}
                    onClick={() => move(row, 1)}
                  >
                    <span className="material-symbols-outlined">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    className="shell__icon-button"
                    aria-label="Edit"
                    disabled={busy}
                    onClick={() =>
                      setEditing({
                        id: row.node.id,
                        name: row.node.name,
                        description: row.node.description,
                        imageUrl: row.node.imageUrl ?? '',
                        parentId: row.node.parentId ?? '',
                      })
                    }
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button
                    type="button"
                    className="shell__icon-button"
                    aria-label={row.node.active ? 'Disable' : 'Enable'}
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        apiPatch<SpaceNode>('/api/space-nodes', token, {
                          id: row.node.id,
                          active: !row.node.active,
                        }),
                      )
                    }
                  >
                    <span className="material-symbols-outlined">
                      {row.node.active ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </li>
              ),
            )}
          </ul>
        </main>
      </div>
    </div>
  )
}

export default SpaceCatalogueAdmin
