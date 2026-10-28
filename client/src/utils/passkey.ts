import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
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
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export type Enrolment = { username: string; displayName: string }
export type BiometricSession = { token: string; role: Role; displayName: string }

/** Whether this device has a built-in Face ID / fingerprint / Windows Hello check. */
export async function biometricsAvailable(): Promise<boolean> {
  try {
    return browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable())
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

/** The device's own prompt was dismissed or refused — say so plainly. */
function describe(error: unknown): string {
  const name = (error as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'AbortError') return 'Face ID / fingerprint was cancelled.'
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

/** Sign in with this device's Face ID / fingerprint. Resolves to a normal session. */
export async function signInWithBiometrics(username: string): Promise<BiometricSession> {
  try {
    const { options, challengeToken } = await post<{
      options: PublicKeyCredentialRequestOptionsJSON
      challengeToken: string
    }>('login-options', { username })
    const response = await startAuthentication({ optionsJSON: options })
    return await post<BiometricSession>('login', { challengeToken, response })
  } catch (error) {
    // The server no longer accepts this device (account removed or password changed).
    if (error instanceof PasskeyRequestError && error.code === 'stale') forgetEnrolment()
    throw new Error(describe(error))
  }
}
