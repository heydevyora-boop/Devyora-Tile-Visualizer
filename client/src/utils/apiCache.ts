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

/**
 * The flow's option lists (tile formats, spaces, highlighter locations,
 * joints, patterns) are the same for every consultation, so each step reads
 * them through here instead of fetching only once it is already on screen.
 *
 * - One request per URL at a time: a step that opens while its list is still
 *   being prefetched waits for that same request instead of starting another.
 * - An answer younger than FRESH_MS is used as is, so stepping through the
 *   flow right after the prefetch costs no round trip at all.
 * - Anything older is fetched again; the step shows the cached list meanwhile
 *   (see getCached) and swaps in the new one when it arrives.
 *
 * Callers that are aborted simply ignore the answer: the shared request is
 * never cancelled on their behalf, because another step may be waiting on it.
 */
const FRESH_MS = 30_000
const fetchedAt = new Map<string, number>()
const inFlight = new Map<string, Promise<unknown>>()

export function loadShared<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const pending = inFlight.get(key)
  if (pending) return pending as Promise<T>
  const at = fetchedAt.get(key)
  if (at !== undefined && Date.now() - at < FRESH_MS && cache.has(key)) {
    return Promise.resolve(cache.get(key) as T)
  }
  const request = fetcher()
    .then((value) => {
      cache.set(key, value)
      fetchedAt.set(key, Date.now())
      return value
    })
    .finally(() => inFlight.delete(key))
  inFlight.set(key, request)
  return request
}

/**
 * Record an answer obtained some other way (one request that covers many
 * URLs) as if loadShared had just fetched it, so it counts as fresh.
 */
export function seedShared<T>(key: string, value: T): void {
  if (inFlight.has(key)) return
  cache.set(key, value)
  fetchedAt.set(key, Date.now())
}
