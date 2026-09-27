/**
 * A tiny in-memory cache for GET responses, keyed by the exact request URL.
 *
 * Measured cause of the reported lag: no page kept anything after it
 * unmounted, so revisiting a screen already loaded once this session paid
 * the same network round trip again, with a "Loading…" state blocking
 * content for the whole wait — even though the data likely hadn't changed.
 *
 * Every page that uses this still performs its real fetch on every mount,
 * unchanged, and still updates state and the cache when that fetch resolves
 * — so a write elsewhere is reflected within one navigation, never held
 * back longer than today's behaviour already allows. The only thing this
 * changes is what a revisit shows while that fetch is in flight: last
 * session's answer instead of a blank state, corrected moments later if
 * anything moved on.
 *
 * Cleared when the tab closes. Nothing here is meant to persist further.
 */
const cache = new Map<string, unknown>()

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value)
}
