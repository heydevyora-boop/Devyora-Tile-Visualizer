import { Router, type Request, type Response } from 'express'
import {
  AccountsError,
  createAccount,
  deleteAccount,
  listAccounts,
  normaliseUsername,
  updateAccount,
} from '../services/accountsStore'
import { verifyAuthHeader } from '../config/auth'
import { DbError, asDbError } from '../services/db'

/**
 * The showroom's sign-in accounts. Admin only throughout, including the
 * listing: who can sign in to a showroom is not something a salesperson needs
 * to enumerate.
 *
 * No response here can carry a password hash — the store returns a shape that
 * structurally has no such field.
 *
 * KEEP IN SYNC with the deployed Vercel copy in client/api/accounts.ts.
 */
const router = Router()

function fail(res: Response, label: string, error: unknown): void {
  const failure = asDbError(error) ?? error
  const status = failure instanceof AccountsError || failure instanceof DbError ? failure.status : 500
  // Only messages this code wrote are repeated back; anything else could carry
  // a driver detail, so it is logged and replaced.
  const message =
    failure instanceof AccountsError || failure instanceof DbError
      ? failure.message
      : 'That change could not be saved. Please try again.'
  console.error(`[${label}] failed:`, error)
  res.status(status).json({ error: message })
}

/** Resolves the session, or answers 401/403 and returns null. */
function requireAdmin(req: Request, res: Response): { sub: string } | null {
  const session = verifyAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(401).json({ error: 'Sign in required.' })
    return null
  }
  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Only an administrator can manage accounts.' })
    return null
  }
  return { sub: session.sub }
}

router.get('/accounts', async (req, res) => {
  if (!requireAdmin(req, res)) return
  try {
    res.status(200).json(await listAccounts())
  } catch (error) {
    fail(res, 'GET /api/accounts', error)
  }
})

router.post('/accounts', async (req, res) => {
  if (!requireAdmin(req, res)) return
  try {
    res.status(201).json(await createAccount((req.body ?? {}) as Record<string, unknown>))
  } catch (error) {
    fail(res, 'POST /api/accounts', error)
  }
})

router.patch('/accounts', async (req, res) => {
  const session = requireAdmin(req, res)
  if (!session) return
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    const target = typeof body.username === 'string' ? body.username : ''
    if (!target.trim()) throw new AccountsError('Which account should be changed?')

    // Self-lockout guard. An administrator demoting themselves would be the one
    // change nobody could undo from inside the app. Together with the
    // self-deletion guard on DELETE, it keeps at least one administrator in
    // existence: every other demotion and removal is performed by an admin who
    // survives it, so those two are the only paths to zero administrators.
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
        ...(newUsername !== undefined ? { username: newUsername } : {}),
      }),
    )
  } catch (error) {
    fail(res, 'PATCH /api/accounts', error)
  }
})

router.delete('/accounts', async (req, res) => {
  const session = requireAdmin(req, res)
  if (!session) return
  try {
    // Named in the query string, matching the deployed copy.
    const target = typeof req.query.username === 'string' ? req.query.username : ''
    if (!target.trim()) throw new AccountsError('Which account should be removed?')

    // Deleting yourself is the one removal nobody could undo from inside the
    // app. Another administrator can do it, which is the point.
    if (normaliseUsername(target) === session.sub) {
      res.status(403).json({
        error: 'You cannot remove your own account — ask another administrator to do it.',
      })
      return
    }

    res.status(200).json(await deleteAccount(target))
  } catch (error) {
    fail(res, 'DELETE /api/accounts', error)
  }
})

export default router
