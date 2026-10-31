import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  getBrowserCapabilities,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import type { Role } from '../state/AuthContext'

/**
 * Face ID / fingerprint sign-in on this device (WebAuthn passkeys; the server
 * side is api/_lib/passkeys.ts).
 *
 * Enrolment is only offered after a password sign-in, and it is remembered per
 * device: this file keeps which account (if any) enrolled on this browser, so
 * the login screen knows whether to show the Face ID / fingerprint button. The
 * face or fingerprint itself never leaves the device.
 */

const ENROLMENT_KEY = 'devyora.passkey'
/** Set for this tab by a sign-out, so the login screen does not ask for Face ID straight back. */
const SIGNED_OUT_KEY = 'devyora.signedOut'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export type Enrolment = { username: string; displayName: string }
export type BiometricSession = { token: string; role: Role; displayName: string; username?: string }

/** A failed Face ID / fingerprint sign-in; `cancelled` when the person dismissed the device's prompt. */
export class BiometricError extends Error {
  cancelled: boolean
  constructor(message: string, cancelled: boolean) {
    super(message)
    this.cancelled = cancelled
  }
}

/** A phone or tablet (iPadOS reports itself as a Mac; touch points tell them apart). */
function isPhoneOrTablet(): boolean {
  const ua = navigator.userAgent
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/**
 * Whether this device can sign in with Face ID / fingerprint / Windows Hello.
 *
 * The browser's own "is there a built-in authenticator" answer is not
 * reliable: some Android phones say no despite a fingerprint and screen lock,
 * and that hid the option on those phones entirely. A phone or tablet always
 * has its own lock check, so it gets the option; a computer also qualifies
 * when the browser can keep passkeys itself (Chrome's password manager,
 * without Windows Hello).
 */
export async function biometricsAvailable(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false
  if (isPhoneOrTablet()) return true
  try {
    if (await platformAuthenticatorIsAvailable()) return true
    const capabilities = await getBrowserCapabilities()
    return (
      capabilities.userVerifyingPlatformAuthenticator === 'supported' ||
      capabilities.passkeyPlatformAuthenticator === 'supported'
    )
  } catch {
    return false
  }
}

export function enrolledAccount(): Enrolment | null {
  try {
    const raw = window.localStorage.getItem(ENROLMENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Enrolment>
    return typeof parsed.username === 'string' && typeof parsed.displayName === 'string'
      ? { username: parsed.username, displayName: parsed.displayName }
      : null
  } catch {
    return null
  }
}

function rememberEnrolment(enrolment: Enrolment): void {
  try {
    window.localStorage.setItem(ENROLMENT_KEY, JSON.stringify(enrolment))
  } catch {
    // Storage unavailable: the key still exists on the device, the button just won't show.
  }
}

export function forgetEnrolment(): void {
  try {
    window.localStorage.removeItem(ENROLMENT_KEY)
  } catch {
    // Nothing to forget.
  }
}

export function markSignedOut(): void {
  try {
    window.sessionStorage.setItem(SIGNED_OUT_KEY, '1')
  } catch {
    // Storage unavailable: the login screen will simply ask for Face ID again.
  }
}

/** Whether this tab was just signed out; reading it clears it. */
export function takeSignedOut(): boolean {
  try {
    const signedOut = window.sessionStorage.getItem(SIGNED_OUT_KEY) !== null
    window.sessionStorage.removeItem(SIGNED_OUT_KEY)
    return signedOut
  } catch {
    return false
  }
}

class PasskeyRequestError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

async function post<T>(step: string, body: unknown, token: string | null = null): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/passkeys?step=${step}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
  } catch {
    throw new PasskeyRequestError('We could not reach the server. Please check your connection and try again.')
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string }
  if (!response.ok) {
    throw new PasskeyRequestError(data.error || 'Something went wrong. Please sign in with your password.', data.code)
  }
  return data as T
}

function isCancelled(error: unknown): boolean {
  const name = (error as { name?: string })?.name
  return name === 'NotAllowedError' || name === 'AbortError'
}

/** The device's own prompt was dismissed or refused — say so plainly. */
function describe(error: unknown): string {
  const name = (error as { name?: string })?.name
  if (isCancelled(error)) return 'Face ID / fingerprint was cancelled.'
  if (name === 'InvalidStateError') return 'This device is already set up for Face ID / fingerprint.'
  return error instanceof Error && error.message ? error.message : 'Face ID / fingerprint did not work. Please try again.'
}

/** Enrol this device for the signed-in account. Call from a tap; asks for Face ID / fingerprint once. */
export async function enableBiometrics(token: string, username: string, displayName: string): Promise<void> {
  try {
    const { options, challengeToken } = await post<{
      options: PublicKeyCredentialCreationOptionsJSON
      challengeToken: string
    }>('register-options', {}, token)
    const response = await startRegistration({ optionsJSON: options })
    await post('register', { challengeToken, response }, token)
    rememberEnrolment({ username: username.trim().toLowerCase(), displayName })
  } catch (error) {
    // Already enrolled on this device under this account: just remember it.
    if ((error as { name?: string })?.name === 'InvalidStateError') {
      rememberEnrolment({ username: username.trim().toLowerCase(), displayName })
      return
    }
    throw new Error(describe(error))
  }
}

async function authenticate(username: string, useBrowserAutofill: boolean): Promise<BiometricSession> {
  const { options, challengeToken } = await post<{
    options: PublicKeyCredentialRequestOptionsJSON
    challengeToken: string
  }>('login-options', { username })
  const response = await startAuthentication({ optionsJSON: options, useBrowserAutofill })
  const session = await post<BiometricSession>('login', { challengeToken, response })
  // Remember the account on this device (a sign-in picked from autofill may be
  // the first this browser has heard of it).
  rememberEnrolment({ username: session.username || username, displayName: session.displayName })
  return session
}

/** Sign in with this device's Face ID / fingerprint. Resolves to a normal session. */
export async function signInWithBiometrics(username: string): Promise<BiometricSession> {
  try {
    return await authenticate(username, false)
  } catch (error) {
    // The server no longer accepts this device (account removed or password changed).
    if (error instanceof PasskeyRequestError && error.code === 'stale') forgetEnrolment()
    throw new BiometricError(describe(error), isCancelled(error))
  }
}

/**
 * Offers this device's saved passkey in the username field's autofill, the
 * way official sites do. Resolves to a session once one is picked and
 * verified, or null when the browser has no such autofill or the offer was
 * withdrawn (see cancelAutofillSignIn).
 */
export async function signInFromAutofill(): Promise<BiometricSession | null> {
  if (!(await browserSupportsWebAuthnAutofill().catch(() => false))) return null
  try {
    return await authenticate('', true)
  } catch (error) {
    if (isCancelled(error)) return null
    if (error instanceof PasskeyRequestError && error.code === 'stale') forgetEnrolment()
    throw new BiometricError(describe(error), false)
  }
}

export function cancelAutofillSignIn(): void {
  WebAuthnAbortService.cancelCeremony()
}
