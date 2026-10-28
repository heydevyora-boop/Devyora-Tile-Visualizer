import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { landingPathFor, useAuth } from '../state/AuthContext'
import devyoraLogo from '../assets/devyora-logo.png'
import {
  biometricsAvailable,
  enableBiometrics,
  enrolledAccount,
  signInWithBiometrics,
} from '../utils/passkey'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const { isAuthenticated, role, token, userName, login, adoptSession } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Face ID / fingerprint: whether this device has it, which account (if any)
  // enrolled it here, and the one-time offer shown after a password sign-in.
  const [canUseBiometrics, setCanUseBiometrics] = useState(false)
  const [enrolment, setEnrolment] = useState(() => enrolledAccount())
  const [offering, setOffering] = useState(false)
  const [offerBusy, setOfferBusy] = useState(false)
  const [offerError, setOfferError] = useState<string | null>(null)
  const [biometricBusy, setBiometricBusy] = useState(false)
  // Holds the usual redirect while the offer is on screen.
  const holdRedirect = useRef(false)

  useEffect(() => {
    void biometricsAvailable().then(setCanUseBiometrics)
  }, [])

  // Already signed in (e.g. returning via the browser back button) — skip ahead
  // to wherever this role belongs.
  useEffect(() => {
    if (isAuthenticated && !holdRedirect.current) navigate(landingPathFor(role), { replace: true })
  }, [isAuthenticated, role, navigate])

  /** Clears a visible error as soon as the user starts correcting the input. */
  const handleChange = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    if (error) setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }

    setSubmitting(true)
    setError(null)
    // Offer Face ID / fingerprint after this sign-in, unless this device
    // already uses it for this account.
    holdRedirect.current = canUseBiometrics && enrolment?.username !== username.trim().toLowerCase()

    try {
      // Verified server-side; admins land on /history, everyone else on /home.
      const signedInRole = await login(username, password)
      if (signedInRole) {
        if (holdRedirect.current) {
          setSubmitting(false)
          setOffering(true)
          return
        }
        navigate(landingPathFor(signedInRole), { replace: true })
        return
      }
      holdRedirect.current = false
      setSubmitting(false)
      setError('Those credentials were not recognised. Please check and try again.')
    } catch (loginError) {
      holdRedirect.current = false
      setSubmitting(false)
      setError(
        loginError instanceof Error && loginError.message
          ? loginError.message
          : 'Something went wrong while signing in. Please try again.',
      )
    }
  }

  /** Leaves the offer and carries on to wherever this role belongs. */
  const finishOffer = () => {
    holdRedirect.current = false
    setOffering(false)
    navigate(landingPathFor(role), { replace: true })
  }

  const handleEnable = async () => {
    if (!token || offerBusy) return
    setOfferBusy(true)
    setOfferError(null)
    try {
      await enableBiometrics(token, username, userName ?? username)
      setEnrolment(enrolledAccount())
      finishOffer()
    } catch (enableError) {
      setOfferBusy(false)
      setOfferError(enableError instanceof Error ? enableError.message : 'That did not work. Please try again.')
    }
  }

  const handleBiometricSignIn = async () => {
    if (!enrolment || biometricBusy || submitting) return
    setBiometricBusy(true)
    setError(null)
    try {
      adoptSession(await signInWithBiometrics(enrolment.username))
    } catch (signInError) {
      setBiometricBusy(false)
      // The server may have retired this device (account removed, password changed).
      setEnrolment(enrolledAccount())
      setError(signInError instanceof Error ? signInError.message : 'Please sign in with your password.')
    }
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
            <img className="login__brand-mark" src={devyoraLogo} alt="Devyora" />
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

          {canUseBiometrics && enrolment && !offering && (
            <div className="login__biometric">
              <span className="login__biometric-or">or</span>
              <button
                className="login__biometric-btn"
                disabled={biometricBusy || submitting}
                id="login-biometric-btn"
                onClick={() => void handleBiometricSignIn()}
                type="button"
              >
                <span className="material-symbols-outlined login__biometric-icon" aria-hidden="true">
                  fingerprint
                </span>
                <span>{biometricBusy ? 'Checking…' : 'Sign in with Face ID / Fingerprint'}</span>
              </button>
              <span className="login__biometric-who">as {enrolment.displayName}</span>
            </div>
          )}
        </section>

        {offering && (
          <div className="login__offer-backdrop">
            <div className="login__offer" role="dialog" aria-modal="true" aria-labelledby="login-offer-title">
              <span className="material-symbols-outlined login__offer-icon" aria-hidden="true">
                fingerprint
              </span>
              <h3 className="login__offer-title" id="login-offer-title">
                Sign in faster next time?
              </h3>
              <p className="login__offer-text">
                Use Face ID or your fingerprint to sign in on this device. Your face and fingerprint never
                leave the device.
              </p>
              {offerError && (
                <p className="login__error" role="alert">
                  <span className="material-symbols-outlined login__error-icon">error</span>
                  <span>{offerError}</span>
                </p>
              )}
              <button
                className="login__submit"
                disabled={offerBusy}
                id="login-enable-biometric-btn"
                onClick={() => void handleEnable()}
                type="button"
              >
                <span className="login__submit-label">
                  {offerBusy ? 'Setting up…' : 'Enable Face ID / Fingerprint'}
                </span>
              </button>
              <button className="login__offer-later" disabled={offerBusy} onClick={finishOffer} type="button">
                Not now
              </button>
            </div>
          </div>
        )}

        <footer className="login__footer">
          <span className="material-symbols-outlined login__footer-icon">concierge</span>
          <span className="login__footer-label">Showroom Client Consultation Mode</span>
        </footer>
      </div>
    </main>
  )
}

export default Login
