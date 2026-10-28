// Deployed copy of the passkey (Face ID / fingerprint) sign-in module used by
// the Vercel serverless function in client/api/. Vercel only uploads files under
// the project Root Directory (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/services/.
import { createHash } from 'node:crypto'
import jwt from 'jsonwebtoken'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { findAccountByUsername } from './accountsStore.js'
import { AuthConfigError, signSessionToken, type SessionPayload } from './auth.js'
import { getCollection } from './db.js'

/**
 * Face ID / fingerprint sign-in, as WebAuthn passkeys.
 *
 * The face or finger never leaves the device: the phone or laptop checks it
 * itself and then signs a one-time challenge with a key it created for this
 * site. The server keeps only that key's public half and verifies the
 * signature. A device can only be enrolled from an already signed-in session
 * (after a password sign-in), and a sign-in with it issues exactly the same
 * session token a password sign-in does.
 *
 * A passkey stops working when its account is deleted, or when the account's
 * password is changed (for instance after a phone is lost): it then needs a
 * fresh password sign-in to be enrolled again.
 */

const PASSKEYS = 'passkeys'
const USED_CHALLENGES = 'passkeyChallenges'
const RP_NAME = 'Devyora Tile Visualizer'
const CHALLENGE_TTL_SECONDS = 300

/** A stored passkey. `_id` is the credential id (base64url), unique per device key. */
interface PasskeyDoc {
  _id: string
  accountId: string
  username: string
  /** The credential's public key, base64url. Never a secret. */
  publicKey: string
  counter: number
  transports: AuthenticatorTransport[]
  /** The site (hostname) the key was created for; it only works there. */
  rpID: string
  /** Ties the key to the password it was enrolled under (a hash of the hash). */
  passwordTag: string
  createdAt: string
  lastUsedAt: string | null
}

interface UsedChallengeDoc {
  _id: string
  expiresAt: Date
}

type ChallengePurpose = 'passkey-register' | 'passkey-login'

interface ChallengeClaims {
  purpose: ChallengePurpose
  challenge: string
  rpID: string
  /** Registration only: the signed-in account it was issued to. */
  sub?: string
}

/** What a passkey step answers with. */
export interface PasskeyResult {
  status: number
  body: Record<string, unknown>
}

export class PasskeyError extends Error {
  status: number
  /** 'stale' tells the browser to forget this device's enrolment. */
  code?: 'stale'

  constructor(message: string, status = 400, code?: 'stale') {
    super(message)
    this.name = 'PasskeyError'
    this.status = status
    this.code = code
  }
}

function requireSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret) throw new AuthConfigError('AUTH_JWT_SECRET is not configured on the server.')
  return secret
}

/**
 * The relying party — the site the passkey belongs to — from the request's
 * Origin. The browser binds each passkey to its site and the server checks the
 * signed origin and site against these, so a key made on one address can never
 * be used from another (including a look-alike site).
 */
function relyingPartyFrom(originHeader: string | undefined): { rpID: string; origin: string } {
  let url: URL
  try {
    url = new URL(String(originHeader ?? ''))
  } catch {
    throw new PasskeyError('Face ID / fingerprint sign-in needs a browser request.', 400)
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new PasskeyError('Face ID / fingerprint sign-in needs a secure (https) connection.', 400)
  }
  return { rpID: url.hostname, origin: url.origin }
}

function passwordTag(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 32)
}

function signChallenge(claims: ChallengeClaims): string {
  return jwt.sign(claims, requireSecret(), { expiresIn: CHALLENGE_TTL_SECONDS })
}

/** Verifies a challenge token and marks its challenge as used, so it can never be replayed. */
async function consumeChallenge(token: unknown, purpose: ChallengePurpose, rpID: string): Promise<ChallengeClaims> {
  let claims: ChallengeClaims
  try {
    claims = jwt.verify(String(token ?? ''), requireSecret()) as ChallengeClaims
  } catch {
    throw new PasskeyError('That request expired. Please try again.', 400)
  }
  if (claims.purpose !== purpose || claims.rpID !== rpID || typeof claims.challenge !== 'string') {
    throw new PasskeyError('That request was not valid. Please try again.', 400)
  }
  const used = await getCollection<UsedChallengeDoc>(USED_CHALLENGES)
  void used.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
  try {
    await used.insertOne({ _id: claims.challenge, expiresAt: new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000) })
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      throw new PasskeyError('That request was already used. Please try again.', 400)
    }
    throw error
  }
  return claims
}

async function passkeys() {
  return getCollection<PasskeyDoc>(PASSKEYS)
}

/** Step 1 of enrolling this device: options for the browser to create a key. Signed-in only. */
export async function registrationOptions(
  session: SessionPayload | null,
  originHeader: string | undefined,
): Promise<PasskeyResult> {
  if (!session) throw new PasskeyError('Sign in with your password first.', 401)
  const { rpID } = relyingPartyFrom(originHeader)
  const account = await findAccountByUsername(session.sub)
  if (!account) throw new PasskeyError('That account no longer exists.', 401)

  const existing = await (await passkeys()).find({ accountId: account.id, rpID }).toArray()
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: account.username,
    userDisplayName: account.displayName,
    userID: new TextEncoder().encode(account.id),
    attestationType: 'none',
    excludeCredentials: existing.map((doc) => ({ id: doc._id, transports: doc.transports })),
    authenticatorSelection: {
      // The phone's or laptop's own Face ID / fingerprint, not a USB key.
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
  })
  const challengeToken = signChallenge({
    purpose: 'passkey-register',
    challenge: options.challenge,
    rpID,
    sub: account.username,
  })
  return { status: 200, body: { options, challengeToken } }
}

/** Step 2 of enrolling: verify the new key and keep its public half. */
export async function register(
  session: SessionPayload | null,
  originHeader: string | undefined,
  body: Record<string, unknown>,
): Promise<PasskeyResult> {
  if (!session) throw new PasskeyError('Sign in with your password first.', 401)
  const { rpID, origin } = relyingPartyFrom(originHeader)
  const claims = await consumeChallenge(body.challengeToken, 'passkey-register', rpID)
  if (claims.sub !== session.sub) throw new PasskeyError('That request was not valid. Please try again.', 400)
  const account = await findAccountByUsername(session.sub)
  if (!account) throw new PasskeyError('That account no longer exists.', 401)

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body.response as RegistrationResponseJSON,
      expectedChallenge: claims.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    })
  } catch {
    throw new PasskeyError('This device could not be set up. Please try again.', 400)
  }
  if (!verification.verified || !verification.registrationInfo) {
    throw new PasskeyError('This device could not be set up. Please try again.', 400)
  }

  const { credential } = verification.registrationInfo
  const now = new Date().toISOString()
  await (await passkeys()).replaceOne(
    { _id: credential.id },
    {
      accountId: account.id,
      username: account.username,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: (credential.transports ?? []) as AuthenticatorTransport[],
      rpID,
      passwordTag: passwordTag(account.passwordHash),
      createdAt: now,
      lastUsedAt: null,
    },
    { upsert: true },
  )
  return { status: 200, body: { ok: true } }
}

/** Step 1 of signing in: a challenge for the device to sign. */
export async function loginOptions(originHeader: string | undefined, body: Record<string, unknown>): Promise<PasskeyResult> {
  const { rpID } = relyingPartyFrom(originHeader)
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  const keys = username ? await (await passkeys()).find({ username, rpID }).toArray() : []
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: keys.map((doc) => ({ id: doc._id, transports: doc.transports })),
  })
  const challengeToken = signChallenge({ purpose: 'passkey-login', challenge: options.challenge, rpID })
  return { status: 200, body: { options, challengeToken } }
}

/** Step 2 of signing in: verify the device's signature and issue a normal session. */
export async function login(originHeader: string | undefined, body: Record<string, unknown>): Promise<PasskeyResult> {
  const { rpID, origin } = relyingPartyFrom(originHeader)
  const claims = await consumeChallenge(body.challengeToken, 'passkey-login', rpID)
  const response = body.response as AuthenticationResponseJSON | undefined
  if (!response || typeof response.id !== 'string') {
    throw new PasskeyError('That request was not valid. Please try again.', 400)
  }

  const collection = await passkeys()
  const doc = await collection.findOne({ _id: response.id, rpID })
  const stale = () =>
    new PasskeyError(
      'Face ID / fingerprint is no longer set up for this account on this device. Please sign in with your password.',
      401,
      'stale',
    )
  if (!doc) throw stale()

  const account = await findAccountByUsername(doc.username)
  if (!account || account.id !== doc.accountId || passwordTag(account.passwordHash) !== doc.passwordTag) {
    // Deleted account, or the password changed since this device was enrolled.
    await collection.deleteOne({ _id: doc._id })
    throw stale()
  }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: claims.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: doc._id,
        publicKey: isoBase64URL.toBuffer(doc.publicKey),
        counter: doc.counter,
        transports: doc.transports,
      },
      requireUserVerification: true,
    })
  } catch {
    throw new PasskeyError('Face ID / fingerprint could not be verified. Please try again.', 401)
  }
  if (!verification.verified) {
    throw new PasskeyError('Face ID / fingerprint could not be verified. Please try again.', 401)
  }

  await collection.updateOne(
    { _id: doc._id },
    { $set: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() } },
  )
  const token = signSessionToken({
    username: account.username,
    passwordHash: account.passwordHash,
    role: account.role,
    displayName: account.displayName,
  })
  return { status: 200, body: { token, role: account.role, displayName: account.displayName } }
}
