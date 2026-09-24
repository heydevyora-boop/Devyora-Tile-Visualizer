/**
 * Same-origin by default: in production this hits the Vercel functions in
 * client/api/, and in `npm run dev` Vite proxies /api to the local Express
 * server. Set VITE_API_BASE_URL only to point at a different host.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/** An API call that failed, carrying the server's own message where it gave one. */
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * A GET against the API as the signed-in user.
 *
 * The server scopes every response to that session, so a screen never has to
 * ask for "my" records — it just asks, and gets back only what this person is
 * allowed to see.
 */
export async function apiGet<T>(path: string, token: string | null, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    })
  } catch (networkError) {
    if (signal?.aborted) throw networkError
    // Safari reports an unreachable server as the unhelpful "Load failed".
    throw new ApiError('We could not reach the server. Please check your connection.', 0)
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = (await response.json()) as { error?: unknown }
      detail = typeof body?.error === 'string' ? body.error : ''
    } catch {
      detail = ''
    }
    throw new ApiError(detail || `Request failed with status ${response.status}`, response.status)
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError('The server sent a response we could not read.', response.status)
  }
}

/** Shapes returned by the API, mirrored from the server-side stores. */
export interface Customer {
  id: string
  architectId: string | null
  name: string
  mobile: string
  createdAt: string
}

export interface Architect {
  id: string
  name: string
  mobile: string
  createdAt: string
}

export interface SavedVisualisation {
  generationId: string
  userName: string
  customerId: string | null
  space: string | null
  style: string | null
  tileSize: string | null
  croppedImage: string
  generatedImages: string[]
  timestamp: string
}
