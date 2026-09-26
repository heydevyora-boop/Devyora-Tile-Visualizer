import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import './AppShell.css'

/**
 * The administrator's frame: a sidebar on a desk monitor, a drawer on a phone.
 *
 * Deliberately its own component rather than a mode of AppShell. The two roles
 * have nothing in common in what they navigate to — an admin never opens a
 * consultation, a salesperson never manages accounts — and a shared shell
 * would mean every change to one role's navigation risked the other's.
 *
 * It reuses AppShell's stylesheet, because the two frames should look like the
 * same product even though they lead to different places.
 */
const NAV_ITEMS = [
  { to: '/admin/users', label: 'Users & Roles', icon: 'manage_accounts' },
  { to: '/history', label: 'Generation History', icon: 'history' },
  { to: '/tile-formats', label: 'Tile Formats', icon: 'grid_on' },
  { to: '/space-catalogue', label: 'Space Catalogue', icon: 'category' },
  { to: '/design-options', label: 'Design Options', icon: 'palette' },
]

function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  const { userName, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  const nav = (
    <nav className="shell__nav" aria-label="Administration">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `shell__nav-link${isActive ? ' shell__nav-link--active' : ''}`}
          onClick={() => setDrawerOpen(false)}
        >
          <span className="material-symbols-outlined shell__nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__brand">DEVYORA</div>
        {nav}
        <div className="shell__sidebar-footer">
          <span className="shell__who" title={userName ?? undefined}>
            {userName ?? 'Administrator'}
          </span>
        </div>
      </aside>

      {drawerOpen && (
        <>
          <div className="shell__scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="shell__drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="shell__drawer-head">
              <span className="shell__brand">DEVYORA</span>
              <button
                type="button"
                className="shell__icon-button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {nav}
          </div>
        </>
      )}

      <div className="shell__main">
        <header className="shell__topbar">
          <button
            type="button"
            className="shell__icon-button shell__menu-button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="shell__title">{title}</h1>
          <button
            type="button"
            className="shell__icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={handleLogout}
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </header>
        <main className="shell__content">{children}</main>
      </div>
    </div>
  )
}

export default AdminShell
