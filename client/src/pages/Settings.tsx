import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useAuth } from '../state/AuthContext'
import './Workspace.css'

/**
 * Who is signed in on this device, and how to hand it to the next person.
 *
 * A showroom device is shared, so the useful thing here is knowing whose name
 * the next consultation will be filed under.
 */
function Settings() {
  const navigate = useNavigate()
  const { userName, role, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <AppShell title="Settings">
      <h2 className="ws__section-title">This device</h2>
      <dl className="ws__definition">
        <dt>Signed in as</dt>
        <dd>{userName ?? '—'}</dd>
        <dt>Access</dt>
        <dd>{role === 'admin' ? 'Administrator' : 'Salesperson'}</dd>
      </dl>

      {role === 'admin' && (
        <>
          <h2 className="ws__section-title">Showroom setup</h2>
          <div className="ws__actions">
            <Link className="ws__action" to="/tile-formats">
              <span className="material-symbols-outlined">grid_on</span>
              <span>Tile formats</span>
            </Link>
            <Link className="ws__action" to="/space-catalogue">
              <span className="material-symbols-outlined">category</span>
              <span>Space catalogue</span>
            </Link>
          </div>
        </>
      )}

      <h2 className="ws__section-title">Handover</h2>
      <p className="ws__lede">
        Sign out when passing this device to another salesperson, so their work is filed under
        their own name.
      </p>
      <div className="ws__actions">
        <button className="ws__action" type="button" onClick={handleLogout}>
          <span className="material-symbols-outlined">logout</span>
          <span>Sign out</span>
        </button>
      </div>
    </AppShell>
  )
}

export default Settings
