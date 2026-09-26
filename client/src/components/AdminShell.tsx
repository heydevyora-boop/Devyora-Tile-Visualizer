import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { AdminTitleContext } from './adminTitle'
import './AppShell.css'
import './AdminShell.css'

/**
 * The administrator's frame: a sidebar on a desk monitor, a drawer on a phone.
 *
 * Deliberately its own component rather than a mode of AppShell. The two roles
 * have nothing in common in what they navigate to — an admin never opens a
 * consultation, a salesperson never manages accounts — and a shared shell
 * would mean every change to one role's navigation risked the other's.
 *
 * It reuses AppShell's stylesheet, because the two frames should look like the
 * same product even though they lead to different places. Anything specific to
 * this frame lives in AdminShell.css instead, so no rule here can reach the
 * salesperson's shell.
 *
 * Mounted as a LAYOUT ROUTE, not wrapped around each page. That is what keeps
 * the sidebar from re-mounting on every navigation: React Router swaps only
 * what <Outlet /> renders, so the frame — and the open/collapsed state it
 * holds — survives moving between admin pages.
 */
const NAV_ITEMS = [
  { to: '/admin/users', label: 'Users & Roles', icon: 'manage_accounts' },
  { to: '/history', label: 'Generation History', icon: 'history' },
  { to: '/tile-formats', label: 'Tile Formats', icon: 'grid_on' },
  { to: '/space-catalogue', label: 'Space Catalogue', icon: 'category' },
  { to: '/design-options', label: 'Design Options', icon: 'palette' },
]

const COLLAPSED_KEY = 'devyora.admin.sidebarCollapsed'
const DESK_WIDTH = '(min-width: 1024px)'

/** The collapsed preference, or false for anything unreadable. */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    // Private mode or blocked storage — the toggle still works for this visit.
    return false
  }
}

function AdminShell({ children }: { children?: ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { userName, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)
  const [pageTitle, setPageTitle] = useState<string | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(collapsed))
    } catch {
      // Not remembered across refreshes, which is the whole cost.
    }
  }, [collapsed])

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
   * One handler for both copies of the button — the one in the sidebar header
   * and the one in the top bar. Where the sidebar is on screen it collapses
   * it; where it is not, the same gesture opens the drawer that stands in for
   * it.
   *
   * Two copies rather than one because the sidebar's own button disappears
   * with the sidebar. Something outside it has to be able to bring it back,
   * and at phone width there is no sidebar to put a button in at all.
   */
  const handleMenu = () => {
    if (window.matchMedia(DESK_WIDTH).matches) {
      setCollapsed((previous) => !previous)
    } else {
      setDrawerOpen(true)
    }
  }

  // The longest matching nav path wins, so /admin/users/priya is still titled
  // by the Users & Roles item rather than falling through to nothing.
  const matched = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  const title = pageTitle ?? matched?.label ?? 'Administration'

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
    <div className={`shell${collapsed ? ' shell--sidebar-collapsed' : ''}`}>
      <aside className="shell__sidebar">
        <div className="shell__sidebar-head">
          <div className="shell__brand">DEVYORA</div>
          <button
            type="button"
            className="shell__icon-button"
            aria-label="Hide the menu"
            aria-expanded={true}
            onClick={handleMenu}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
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
            className="shell__icon-button shell__menu-button shell__menu-button--admin"
            aria-label={collapsed ? 'Show the menu' : 'Hide the menu'}
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
        <main className="shell__content">
          <AdminTitleContext.Provider value={setPageTitle}>
            {children ?? <Outlet />}
          </AdminTitleContext.Provider>
        </main>
      </div>
    </div>
  )
}

export default AdminShell
