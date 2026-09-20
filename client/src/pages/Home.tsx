import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import './Home.css'

const TILE_SRC =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDO9Sw_P-OLg87i2fEL8bhqb8bY9LFOd8fpZLTLgsoNtXVRfm4NFxWPp5kgtuBAq_3oWjY-p9xi5--YUo1YRWwX8h9JbDuKMofZI84duIuJfsosmMt4mZEjXhis9pAeFbvoarHs3sctbv9E-YilGGMdjHJVn47bq9zisvF5og0lnYdS3vFJ9cVcicux8PaxpbdreYFD8zBNR3uQ_My1Ke46aBZ9BTwLWTm5VzOau3JhRtLoE-M0gHoRsQ'

function Home() {
  const navigate = useNavigate()
  const { role, userName, logout } = useAuth()
  const handleThemeToggle = () => {}
  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }
  const handleStart = () => {
    navigate('/camera')
  }

  return (
    <main className="home">
      <div className="home__frame">
        <header className="home__header">
          <div className="home__brand">
            <span className="home__logo" aria-label="DEVYORA">
              DEVYORA
            </span>
          </div>
          <div className="home__header-actions">
            <button
              id="theme-toggle-btn"
              type="button"
              aria-label="Toggle theme"
              className="home__theme-toggle"
              onClick={handleThemeToggle}
            >
              <span className="material-symbols-outlined home__theme-icon">
                light_mode
              </span>
            </button>
            {role === 'admin' && (
              <button
                id="home-history-btn"
                type="button"
                aria-label="Generation history"
                title="Generation history"
                className="home__theme-toggle"
                onClick={() => navigate('/history')}
              >
                <span className="material-symbols-outlined home__theme-icon">
                  history
                </span>
              </button>
            )}
            <div className="home__atelier-badge" title={userName ?? undefined}>
              <span className="home__atelier-dot"></span>
              <span className="home__atelier-label">
                {userName ?? 'Milan Atelier'}
              </span>
            </div>
            <button
              id="home-logout-btn"
              type="button"
              aria-label="Sign out"
              title="Sign out"
              className="home__theme-toggle"
              onClick={handleLogout}
            >
              <span className="material-symbols-outlined home__theme-icon">
                logout
              </span>
            </button>
          </div>
        </header>

        <section className="home__hero">
          <p className="home__eyebrow">Atelier Showroom Suite</p>
          <h1 className="home__brand-title">DEVYORA</h1>
          <h2 className="home__subtitle">Tile Visualizer</h2>
          <p className="home__vision">
            Turn a physical tile into architectural concepts.
          </p>

          <div className="home__sample">
            <div className="home__corner home__corner--top-left">
              <div className="home__corner-bar home__corner-bar--h"></div>
              <div className="home__corner-bar home__corner-bar--v"></div>
            </div>
            <div className="home__corner home__corner--top-right">
              <div className="home__corner-bar home__corner-bar--h"></div>
              <div className="home__corner-bar home__corner-bar--v"></div>
            </div>
            <div className="home__corner home__corner--bottom-left">
              <div className="home__corner-bar home__corner-bar--v"></div>
              <div className="home__corner-bar home__corner-bar--h"></div>
            </div>
            <div className="home__corner home__corner--bottom-right">
              <div className="home__corner-bar home__corner-bar--v"></div>
              <div className="home__corner-bar home__corner-bar--h"></div>
            </div>

            <div className="home__sample-surface">
              <img
                alt="Architectural porcelain slab tile preview"
                className="home__sample-image"
                src={TILE_SRC}
              />
              <div className="home__spec-tag">
                <span className="home__spec-name">Navona Travertine</span>
                <span className="home__spec-size">1200×600</span>
              </div>
            </div>
          </div>

          <div className="home__metrics">
            <div className="home__metric">
              <span className="home__metric-label">Matte Honed</span>
            </div>
            <span className="home__metric-dot">•</span>
            <div className="home__metric">
              <span className="home__metric-label">10.5 mm</span>
            </div>
            <span className="home__metric-dot">•</span>
            <div className="home__metric">
              <span className="home__metric-label">R10 A+B</span>
            </div>
          </div>
        </section>

        <footer className="home__footer">
          <div className="home__actions">
            <button
              type="button"
              aria-label="Start visualizer session"
              className="home__start"
              id="start-consultation-btn"
              onClick={handleStart}
            >
              <span className="home__start-label">Start</span>
              <span className="material-symbols-outlined home__start-icon">
                arrow_forward
              </span>
            </button>
            <div className="home__mode">
              <span className="material-symbols-outlined home__mode-icon">
                concierge
              </span>
              <span className="home__mode-label">
                Showroom Client Consultation Mode
              </span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}

export default Home
