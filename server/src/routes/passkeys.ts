import { Router } from 'express'
import { AuthConfigError, verifyAuthHeader } from '../config/auth'
import { asDbError } from '../services/db'
import {
  PasskeyError,
  login,
  loginOptions,
  register,
  registrationOptions,
  type PasskeyResult,
} from '../services/passkeys'

/**
 * Face ID / fingerprint sign-in (WebAuthn passkeys). See services/passkeys.ts.
 * KEEP IN SYNC with the deployed copy in client/api/passkeys.ts.
 */
const router = Router()

router.post('/passkeys', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const step = typeof req.query.step === 'string' ? req.query.step : ''
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
})

export default router
