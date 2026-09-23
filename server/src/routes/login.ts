import { Router } from 'express'
import { AuthConfigError, signSessionToken, verifyCredentials } from '../config/auth'

const router = Router()

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {}

  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    res.status(400).json({ error: 'Username and password are required.' })
    return
  }

  try {
    const account = await verifyCredentials(username, password)
    if (!account) {
      // Deliberately generic: never reveal whether the username or the
      // password was the one that didn't match.
      res.status(401).json({ error: 'Invalid username or password.' })
      return
    }
    const token = signSessionToken(account)
    res.status(200).json({ token, role: account.role, displayName: account.displayName })
  } catch (error) {
    if (error instanceof AuthConfigError) {
      console.error('[POST /api/login] server misconfigured:', error.message)
      res.status(500).json({ error: 'Sign-in is not configured on the server.' })
      return
    }
    console.error('[POST /api/login] unexpected failure:', error)
    res.status(500).json({ error: 'Something went wrong while signing in. Please try again.' })
  }
})

export default router
