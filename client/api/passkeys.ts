import type { VercelRequest, VercelResponse } from '@vercel/node'
import { AuthConfigError, verifyAuthHeader } from './_lib/auth.js'
import { asDbError } from './_lib/db.js'
import {
  PasskeyError,
  login,
  loginOptions,
  register,
  registrationOptions,
  type PasskeyResult,
} from './_lib/passkeys.js'

/**
 * Face ID / fingerprint sign-in (WebAuthn passkeys). See _lib/passkeys.ts.
 *
 * POST ?step=register-options — signed in: options to enrol this device
 * POST ?step=register         — signed in: store the new device key
 * POST ?step=login-options    — a challenge for the device to sign
 * POST ?step=login            — verify it and issue a normal session
 *
 * KEEP IN SYNC with the local-dev Express copy in server/src/routes/passkeys.ts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  let body: Record<string, unknown> = {}
  if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body)
    } catch {
      res.status(400).json({ error: 'Request body was not valid JSON.' })
      return
    }
  } else if (req.body && typeof req.body === 'object') {
    body = req.body as Record<string, unknown>
  }

  const step = typeof req.query?.step === 'string' ? req.query.step : ''
  const origin = req.headers.origin
  const session = verifyAuthHeader(req.headers.authorization)

  try {
    let result: PasskeyResult
    if (step === 'register-options') result = await registrationOptions(session, origin)
    else if (step === 'register') result = await register(session, origin, body)
    else if (step === 'login-options') result = await loginOptions(origin, body)
    else if (step === 'login') result = await login(origin, body)
    else {
      res.status(404).json({ error: 'Unknown step.' })
      return
    }
    res.status(result.status).json(result.body)
  } catch (error) {
    if (error instanceof PasskeyError) {
      res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) })
      return
    }
    if (error instanceof AuthConfigError) {
      console.error('[POST /api/passkeys] server misconfigured:', error.message)
      res.status(500).json({ error: 'Sign-in is not configured on the server.' })
      return
    }
    const dbFailure = asDbError(error)
    if (dbFailure) {
      console.error('[POST /api/passkeys] database unavailable:', error)
      res.status(dbFailure.status).json({ error: dbFailure.message })
      return
    }
    console.error(`[POST /api/passkeys ${step}] unexpected failure:`, error)
    res.status(500).json({ error: 'Something went wrong. Please sign in with your password.' })
  }
}
