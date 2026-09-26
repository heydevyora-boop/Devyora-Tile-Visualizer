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

/** A POST against the API as the signed-in user. */
export async function apiPost<T>(path: string, token: string | null, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('We could not reach the server. Please check your connection.', 0)
  }

  if (!response.ok) {
    let detail = ''
    try {
      const failure = (await response.json()) as { error?: unknown }
      detail = typeof failure?.error === 'string' ? failure.error : ''
    } catch {
      detail = ''
    }
    // The server's own message is the useful one here: it says which field was
    // missing, or that this client is already saved.
    throw new ApiError(detail || `Request failed with status ${response.status}`, response.status)
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError('The server sent a response we could not read.', response.status)
  }
}

/** A PATCH against the API as the signed-in user. */
export async function apiPatch<T>(path: string, token: string | null, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('We could not reach the server. Please check your connection.', 0)
  }
  if (!response.ok) {
    let detail = ''
    try {
      const failure = (await response.json()) as { error?: unknown }
      detail = typeof failure?.error === 'string' ? failure.error : ''
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

export interface TileFormat {
  id: string
  lengthMm: number
  breadthMm: number
  /** An admin-given name shown instead of the raw dimensions, where set. */
  label: string | null
  active: boolean
  order: number
}

export interface SpaceNode {
  id: string
  parentId: string | null
  name: string
  description: string
  imageUrl: string | null
  spaceId: string | null
  order: number
  active: boolean
}

export type DesignOptionKind = 'style' | 'joint' | 'pattern' | 'reason'

export interface DesignOption {
  id: string
  kind: DesignOptionKind
  name: string
  description: string
  imageUrl: string | null
  valueMm: number | null
  styleId: string | null
  order: number
  active: boolean
}

/**
 * One concept a salesperson chose to keep for a client.
 *
 * Generating does not produce one of these; saving does. Everything describing
 * it was recorded server-side when the image was made, so opening it shows what
 * was actually agreed rather than what today's catalogue would produce.
 */
export interface SavedVisualisation {
  id: string
  salesperson: string
  salespersonName: string
  customerId: string | null
  customerName: string | null
  architectId: string | null
  architectName: string | null
  generationId: string
  revisionId: string
  revision: number
  revisionReasons: string[]
  revisionNote: string
  originalTileImage: string | null
  croppedTileImage: string | null
  tileSize: string | null
  space: string | null
  spacePath: { id: string; name: string }[]
  styleName: string | null
  jointName: string | null
  jointWidthMm: number | null
  patternName: string | null
  additionalRequirement: string | null
  image: string
  generatedAt: string
  savedAt: string
}
