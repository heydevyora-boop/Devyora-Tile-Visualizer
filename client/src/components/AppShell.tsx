import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { haptic } from '../utils/haptic'
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

const DESK_WIDTH = '(min-width: 1024px)'

/**
 * Whether the salesperson has hidden the sidebar. Held for the life of the
 * page rather than in storage: every page renders its own AppShell, so this
 * carries the choice from one screen to the next, while a fresh load always
 * opens with the sidebar showing.
 */
let sidebarCollapsed = false

function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  const { userName, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => sidebarCollapsed)

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

  /**
   * The same pattern as the admin frame: one handler for the sidebar's own
   * button and the top bar's. Where the sidebar is on screen it hides and
   * shows it; on a phone, where there is no sidebar, it opens the drawer.
   */
  const handleMenu = () => {
    if (window.matchMedia(DESK_WIDTH).matches) {
      setCollapsed((previous) => {
        sidebarCollapsed = !previous
        return !previous
      })
    } else {
      setDrawerOpen(true)
    }
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
          onClick={() => {
            // New Visualization is one of the few taps that gets a haptic tick.
            if (item.to === '/start') haptic()
            setDrawerOpen(false)
          }}
        >
          <span className="material-symbols-outlined shell__nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className={`shell${collapsed ? ' shell--sidebar-collapsed' : ''}`}>
      <aside className="shell__sidebar">
        <div className="shell__sidebar-head">
          <button
            type="button"
            className="shell__icon-button"
            aria-label="Hide the menu"
            aria-expanded={true}
            onClick={handleMenu}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="shell__brand">DEVYORA</div>
        </div>
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
            className="shell__icon-button shell__menu-button shell__menu-button--user"
            aria-label={collapsed ? 'Show the menu' : 'Open menu'}
            aria-expanded={!collapsed || drawerOpen}
            onClick={handleMenu}
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
