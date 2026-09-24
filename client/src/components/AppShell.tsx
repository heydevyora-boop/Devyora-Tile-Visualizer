import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import './AppShell.css'

/**
 * The salesperson's workspace frame: a sidebar on a desk monitor, a drawer on
 * a phone.
 *
 * Deliberately six destinations and nothing more. The spaces and styles a
 * consultation chooses from belong inside the visualiser flow, not in the
 * navigation — a showroom tablet is held in one hand, and a menu that lists
 * every room type is a menu nobody reads.
 */
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/start', label: 'New Visualization', icon: 'add_a_photo' },
  { to: '/clients', label: 'Clients', icon: 'group' },
  { to: '/recent-generations', label: 'Recent Generations', icon: 'history' },
  { to: '/saved-concepts', label: 'Saved Concepts', icon: 'bookmark' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  const { userName, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Escape closes the drawer, matching every other overlay in the app.
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
    <nav className="shell__nav" aria-label="Main">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `shell__nav-link${isActive ? ' shell__nav-link--active' : ''}`}
          // Closed from the tap itself rather than by watching the location:
          // otherwise the next screen opens underneath a menu still on top.
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
            {userName ?? 'Showroom'}
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

export default AppShell
