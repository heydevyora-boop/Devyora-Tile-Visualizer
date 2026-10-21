import { apiGet, type Architect, type Customer } from './api'
import { loadShared } from './apiCache'

/**
 * The salesperson's clients and architects, behind one shared, cached request
 * each (see loadShared) — the same cache keys the Dashboard, Clients and
 * client-detail pages already fill, so a list loaded on one screen is shown
 * at once on the next.
 */
export const CUSTOMERS_KEY = '/api/customers'
export const ARCHITECTS_KEY = '/api/architects'

export const loadCustomers = (token: string | null) =>
  loadShared(CUSTOMERS_KEY, () => apiGet<Customer[]>(CUSTOMERS_KEY, token))

export const loadArchitects = (token: string | null) =>
  loadShared(ARCHITECTS_KEY, () => apiGet<Architect[]>(ARCHITECTS_KEY, token))

/**
 * Warm both lists in the background, so New Visualization opens with the
 * client names already there. Failures are ignored here; the screen that
 * needs a list reports its own error.
 */
export function prefetchClients(token: string | null): void {
  if (!token) return
  void loadCustomers(token).catch(() => {})
  void loadArchitects(token).catch(() => {})
}
