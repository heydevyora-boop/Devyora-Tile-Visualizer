import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { useAuth } from '../state/AuthContext'
import {
  ApiError,
  apiGet,
  apiPatch,
  type AccountSummary,
  type SavedVisualisation,
} from '../utils/api'
import { signedInUsername } from '../utils/signedInUsername'
import './Workspace.css'

function formatWhen(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return `${parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} · ${parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * One account: what it can sign in with, and what it has produced.
 *
 * The credentials form never shows an existing password, because there is
 * nothing to show — only a hash the server keeps and never returns. A password
 * can be replaced, never read.
 */
function UserDetail() {
  const { username = '' } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const me = signedInUsername(token)
  const isSelf = me !== null && me === username.trim().toLowerCase()

  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [work, setWork] = useState<SavedVisualisation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [newUsername, setNewUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const [accounts, saved] = await Promise.all([
          apiGet<AccountSummary[]>('/api/accounts', token, controller.signal),
          apiGet<SavedVisualisation[]>(
            `/api/generations?salesperson=${encodeURIComponent(username)}`,
            token,
            controller.signal,
          ),
        ])
        if (controller.signal.aborted) return
        const found = accounts.find((a) => a.username === username.trim().toLowerCase()) ?? null
        setAccount(found)
        if (found) {
          setNewUsername(found.username)
          setDisplayName(found.displayName)
          setRole(found.role)
        }
        setWork(saved)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load this account.')
      }
    })()
    return () => controller.abort()
  }, [token, username])

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    if (!account) return
    setBusy(true)
    setError(null)
    setNotice(null)
    void (async () => {
      try {
        const saved = await apiPatch<AccountSummary>('/api/accounts', token, {
          username: account.username,
          ...(newUsername !== account.username ? { newUsername } : {}),
          ...(displayName !== account.displayName ? { displayName } : {}),
          ...(role !== account.role ? { role } : {}),
          // Sent only when something was typed, so saving the other fields
          // never quietly resets a password.
          ...(password ? { password } : {}),
        })
        setAccount(saved)
        // Cleared the moment it has been sent: the typed password has no
        // reason to stay in the page, and nothing here ever stores it.
        setPassword('')
        setNotice(
          password
            ? `Saved. ${saved.displayName} signs in with the new password from now on.`
            : 'Saved.',
        )
        if (saved.username !== account.username) {
          navigate(`/admin/users/${encodeURIComponent(saved.username)}`, { replace: true })
        }
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'That change could not be saved.')
      } finally {
        setBusy(false)
      }
    })()
  }

  return (
    <AdminShell title={account?.displayName ?? 'Account'}>
      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="ws__note" role="status">{notice}</p>}

      {account === null && !error && <p className="ws__loading">Loading…</p>}

      {account && (
        <>
          <h2 className="ws__section-title">Sign-in details</h2>
          <form onSubmit={handleSave}>
            <label className="ws__field">
              <span className="ws__field-label">Username</span>
              <input
                className="ws__search"
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <label className="ws__field">
              <span className="ws__field-label">Display name</span>
              <input
                className="ws__search"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </label>
            <label className="ws__field">
              <span className="ws__field-label">Role</span>
              <select
                className="ws__search"
                value={role}
                disabled={isSelf}
                onChange={(event) => setRole(event.target.value === 'admin' ? 'admin' : 'user')}
              >
                <option value="user">Salesperson</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            {isSelf && (
              <p className="ws__note">
                This is your own account. Another administrator has to change your role — otherwise
                the last one could lock everybody out.
              </p>
            )}
            <label className="ws__field">
              <span className="ws__field-label">
                New password — leave blank to keep the current one
              </span>
              <input
                className="ws__search"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </label>
            <button
              className="ws__action ws__action--primary ws__action--submit"
              type="submit"
              disabled={busy}
            >
              <span className="material-symbols-outlined">save</span>
              <span>Save changes</span>
            </button>
          </form>

          <h2 className="ws__section-title">Their saved work</h2>
          {work === null && <p className="ws__loading">Loading…</p>}
          {work?.length === 0 && (
            <p className="ws__empty">Nothing saved to a client by this person yet.</p>
          )}
          <div className="ws__gallery">
            {(work ?? []).map((item) => (
              <article className="ws__card" key={item.id}>
                <img className="ws__card-image" src={item.image} alt="" loading="lazy" />
                <div className="ws__card-body">
                  <span className="ws__card-title">{item.space ?? 'Space not recorded'}</span>
                  <span className="ws__card-meta">
                    {[item.styleName, item.tileSize ? `${item.tileSize.replace('x', ' × ')} mm` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="ws__card-meta">{formatWhen(item.savedAt)}</span>
                </div>
                {item.croppedTileImage && (
                  <img
                    className="ws__thumb"
                    src={item.croppedTileImage}
                    alt="The tile this was generated from"
                    loading="lazy"
                  />
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  )
}

export default UserDetail
