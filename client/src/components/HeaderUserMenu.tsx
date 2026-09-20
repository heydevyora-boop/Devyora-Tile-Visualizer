import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'

/**
 * The right-hand cluster in every flow page header: the profile mark plus a
 * logout control. Rendered as a single component so all eight pages stay
 * identical.
 *
 * No link to /history here on purpose — the flow pages are user-only, and
 * admins are redirected away from them, so such a link could never be seen.
 */
function HeaderUserMenu() {
  const navigate = useNavigate()
  const { userName, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex items-center gap-space-xs">
      <div
        className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(197,168,128,0.18)]"
        title={userName ?? undefined}
      >
        <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
      </div>
      <button
        aria-label="Sign out"
        className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors focus:outline-none"
        id="logoutBtn"
        onClick={handleLogout}
        title="Sign out"
        type="button"
      >
        <span className="material-symbols-outlined text-[20px]">logout</span>
      </button>
    </div>
  )
}

export default HeaderUserMenu
