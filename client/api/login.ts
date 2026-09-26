import type { VercelRequest, VercelResponse } from '@vercel/node'
import { AuthConfigError, signSessionToken, verifyCredentials } from './_lib/auth.js'
import { asDbError } from './_lib/db.js'

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

  const { username, password } = body as { username?: unknown; password?: unknown }

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
    // Accounts live in the database, so signing in can now fail because the
    // database is unreachable rather than because the password was wrong.
    // Saying "invalid username or password" to someone whose credentials were
    // never actually checked would send them hunting for a problem that is not
    // theirs, so the outage is reported as itself.
    const dbFailure = asDbError(error)
    if (dbFailure) {
      console.error('[POST /api/login] database unavailable:', error)
      res.status(dbFailure.status).json({ error: dbFailure.message })
      return
    }
    console.error('[POST /api/login] unexpected failure:', error)
    res.status(500).json({ error: 'Something went wrong while signing in. Please try again.' })
  }
}
