/**
 * The signed-in account's username, read from the session token.
 *
 * AuthContext carries the display name, which is what screens show — but the
 * admin screens need the username, because that is what an account is keyed
 * on. Reading it from the token's `sub` avoids widening the shared auth state
 * for two screens.
 *
 * Display-only, exactly like the expiry check in AuthContext: the signature is
 * not verified here and nothing is trusted because of it. Every rule this
 * informs — who may not demote themselves, above all — is enforced again on
 * the server, which is the only place it counts.
 */
export function signedInUsername(token: string | null): string | null {
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { sub?: unknown }
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}
