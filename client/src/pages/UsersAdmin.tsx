import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, apiPost, type AccountSummary } from '../utils/api'
import { signedInUsername } from '../utils/signedInUsername'
import './Workspace.css'

/**
 * Who can sign in, and as what.
 *
 * Accounts used to live in a deployment setting, which meant adding a
 * salesperson needed whoever held the hosting dashboard. They are rows now, so
 * this screen can do it.
 *
 * A password is only ever typed, never shown: nothing here can read an
 * existing one back, because nothing stores one — only a hash the server makes
 * and never returns. Forgetting a password means setting a new one.
 */
function UsersAdmin() {
  const { token } = useAuth()
  const me = signedInUsername(token)
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')

  const load = async (signal?: AbortSignal) => {
    try {
      const list = await apiGet<AccountSummary[]>('/api/accounts', token, signal)
      if (!signal?.aborted) setAccounts(list)
    } catch (caught) {
      if (signal?.aborted) return
      setError(caught instanceof ApiError ? caught.message : 'Could not load the accounts.')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    void (async () => {
      try {
        const created = await apiPost<AccountSummary>('/api/accounts', token, {
          username,
          displayName,
          password,
          role,
        })
        setNotice(`${created.displayName} can now sign in as "${created.username}".`)
        // Cleared immediately: the typed password has no reason to stay in the
        // page after it has been sent.
        setUsername('')
        setDisplayName('')
        setPassword('')
        setRole('user')
        await load()
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'That account could not be created.')
      } finally {
        setBusy(false)
      }
    })()
  }

  return (
    <AdminShell title="Users & Roles">
      <p className="ws__lede">
        Everyone who can sign in to this showroom. Passwords are never shown — they cannot be read
        back, only replaced.
      </p>

      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="ws__note" role="status">{notice}</p>}

      <h2 className="ws__section-title">Add someone</h2>
      <form onSubmit={handleCreate}>
        <label className="ws__field">
          <span className="ws__field-label">Username — what they type to sign in</span>
          <input
            className="ws__search"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label className="ws__field">
          <span className="ws__field-label">Display name — shown against their work</span>
          <input
            className="ws__search"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </label>
        <label className="ws__field">
          <span className="ws__field-label">Initial password — at least 8 characters</span>
          <input
            className="ws__search"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="ws__field">
          <span className="ws__field-label">Role</span>
          <select
            className="ws__search"
            value={role}
            onChange={(event) => setRole(event.target.value === 'admin' ? 'admin' : 'user')}
          >
            <option value="user">Salesperson</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        <button className="ws__action ws__action--primary ws__action--submit" type="submit" disabled={busy}>
          <span className="material-symbols-outlined">person_add</span>
          <span>Add account</span>
        </button>
      </form>

      <h2 className="ws__section-title">Accounts</h2>
      {accounts === null && !error && <p className="ws__loading">Loading…</p>}
      {accounts?.length === 0 && <p className="ws__empty">No accounts yet.</p>}
      <ul className="ws__list">
        {(accounts ?? []).map((account) => (
          <li className="ws__row" key={account.id}>
            <Link className="ws__row-body" to={`/admin/users/${encodeURIComponent(account.username)}`}>
              <span className="ws__row-title">{account.displayName}</span>
              <span className="ws__row-meta">
                {[
                  account.username,
                  account.role === 'admin' ? 'Administrator' : 'Salesperson',
                  account.username === me ? 'you' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  )
}

export default UsersAdmin
