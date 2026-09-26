import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  AccountsError,
  createAccount,
  listAccounts,
  normaliseUsername,
  updateAccount,
} from './_lib/accountsStore.js'
import { verifyAuthHeader } from './_lib/auth.js'
import { DbError, asDbError } from './_lib/db.js'

/**
 * The showroom's sign-in accounts.
 *
 * GET   — admin only; every account, without password hashes.
 * POST  — admin only; add a salesperson or administrator.
 * PATCH — admin only; change one account's username, display name, role or
 *         password. The account is named in the body rather than the path,
 *         matching every other route here.
 *
 * Admin only throughout, including the listing: who can sign in to a showroom
 * is not something a salesperson needs to enumerate.
 *
 * No response from this file can carry a password hash — the store returns a
 * shape that structurally has no such field, so it is not a rule this route
 * has to remember to follow.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }
  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Only an administrator can manage accounts.' })
    return
  }

  const parseBody = (): Record<string, unknown> => {
    let body: unknown = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        throw new AccountsError('Request body was not valid JSON.')
      }
    }
    return (body ?? {}) as Record<string, unknown>
  }

  try {
    if (req.method === 'GET') {
      res.status(200).json(await listAccounts())
      return
    }

    if (req.method === 'POST') {
      res.status(201).json(await createAccount(parseBody()))
      return
    }

    if (req.method === 'PATCH') {
      const body = parseBody()
      const target = typeof body.username === 'string' ? body.username : ''
      if (!target.trim()) throw new AccountsError('Which account should be changed?')

      // Self-lockout guard. An administrator demoting themselves would be the
      // one change nobody could undo from inside the app, so it is refused
      // here rather than in the store: it is a fact about who is asking, not
      // about whether the account is valid.
      //
      // It is also what keeps at least one administrator in existence. Any
      // other demotion is performed by an admin who stays one, so the only
      // path to zero administrators is the one this closes.
      const isSelf = normaliseUsername(target) === session.sub
      if (isSelf && body.role !== undefined && body.role !== 'admin') {
        res.status(403).json({
          error: 'You cannot remove your own administrator role — ask another administrator to do it.',
        })
        return
      }

      const { username: _named, newUsername, ...rest } = body
      res.status(200).json(
        await updateAccount(target, {
          ...rest,
          // The body names the account being changed; a rename is asked for
          // separately so the two cannot be confused for one another.
          ...(newUsername !== undefined ? { username: newUsername } : {}),
        }),
      )
      return
    }

    res.setHeader('Allow', 'GET, POST, PATCH')
    res.status(405).json({ error: 'Method not allowed.' })
  } catch (error) {
    const failure = asDbError(error) ?? error
    const status =
      failure instanceof AccountsError || failure instanceof DbError ? failure.status : 500
    // Only messages this code wrote are repeated back. Anything else could
    // carry a driver detail, so it is logged and replaced.
    const message =
      failure instanceof AccountsError || failure instanceof DbError
        ? failure.message
        : 'That change could not be saved. Please try again.'
    console.error(`[${req.method} /api/accounts] failed:`, error)
    res.status(status).json({ error: message })
  }
}
