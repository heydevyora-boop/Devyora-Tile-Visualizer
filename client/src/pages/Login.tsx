import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import './Login.css'

/**
 * Brief hold before the result lands. Validation is synchronous, so without
 * this the button state would flicker rather than read as a deliberate action.
 */
const SUBMIT_DELAY_MS = 300

function Login() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const timerRef = useRef<number | null>(null)

  // Already signed in (e.g. returning via the browser back button) — skip ahead.
  useEffect(() => {
    if (isAuthenticated) navigate('/home', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  /** Clears a visible error as soon as the user starts correcting the input. */
  const handleChange = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    if (error) setError(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }

    setSubmitting(true)
    setError(null)

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      const ok = login(username, password)
      if (ok) {
        navigate('/home', { replace: true })
        return
      }
      setSubmitting(false)
      setError('Those credentials were not recognised. Please check and try again.')
    }, SUBMIT_DELAY_MS)
  }

  return (
    <main className="login">
      <div className="login__frame">
        <header className="login__header">
          <span className="login__logo" aria-label="DEVYORA">
            DEVYORA
          </span>
          <div className="login__atelier-badge">
            <span className="login__atelier-dot"></span>
            <span className="login__atelier-label">Milan Atelier</span>
          </div>
        </header>

        <section className="login__body">
          <div className="login__intro">
            <p className="login__eyebrow">Atelier Showroom Suite</p>
            <h1 className="login__title">DEVYORA</h1>
            <h2 className="login__subtitle">Tile Visualizer</h2>
            <p className="login__vision">Sign in to begin a showroom consultation.</p>
          </div>

          <form className="login__form" onSubmit={handleSubmit} noValidate>
            <div className="login__field">
              <label className="login__label" htmlFor="login-username">
                Username
              </label>
              <input
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect="off"
                className="login__input"
                disabled={submitting}
                id="login-username"
                name="username"
                onChange={(event) => handleChange(setUsername)(event.target.value)}
                placeholder="Username"
                spellCheck={false}
                type="text"
                value={username}
              />
            </div>

            <div className="login__field">
              <label className="login__label" htmlFor="login-password">
                Password
              </label>
              <input
                autoComplete="current-password"
                className="login__input"
                disabled={submitting}
                id="login-password"
                name="password"
                onChange={(event) => handleChange(setPassword)(event.target.value)}
                placeholder="Password"
                type="password"
                value={password}
              />
            </div>

            {/* Reserved height: the message fades in without shifting the button. */}
            <div className="login__error-slot" aria-live="polite">
              {error && (
                <p className="login__error" id="loginError" role="alert">
                  <span className="material-symbols-outlined login__error-icon">error</span>
                  <span>{error}</span>
                </p>
              )}
            </div>

            <button
              className="login__submit"
              disabled={submitting}
              id="login-submit-btn"
              type="submit"
            >
              <span className="login__submit-label">
                {submitting ? 'Signing In' : 'Sign In'}
              </span>
              {submitting ? (
                <span className="login__spinner" aria-hidden="true"></span>
              ) : (
                <span className="material-symbols-outlined login__submit-icon">arrow_forward</span>
              )}
            </button>
          </form>
        </section>

        <footer className="login__footer">
          <span className="material-symbols-outlined login__footer-icon">concierge</span>
          <span className="login__footer-label">Showroom Client Consultation Mode</span>
        </footer>
      </div>
    </main>
  )
}

export default Login
