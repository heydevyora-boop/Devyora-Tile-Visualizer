import { apiGet, type DesignOption, type DesignOptionKind, type SpaceNode, type TileFormat } from './api'
import { loadShared, seedShared } from './apiCache'

/**
 * The lists the visualisation flow steps through, each behind one shared,
 * cached request (see loadShared). Steps read them with these, and the start
 * of a consultation prefetches them, so pressing Continue lands on a screen
 * whose options are already there instead of on "Loading…".
 */
export const TILE_FORMATS_KEY = '/api/tile-formats'
export const designOptionsKey = (kind: DesignOptionKind) => `/api/design-options?kind=${kind}`
export const spaceNodesKey = (parentId: string | null) =>
  `/api/space-nodes?parentId=${parentId ? encodeURIComponent(parentId) : 'root'}`

export const loadTileFormats = (token: string | null) =>
  loadShared(TILE_FORMATS_KEY, () => apiGet<TileFormat[]>(TILE_FORMATS_KEY, token))

export const loadDesignOptions = (kind: DesignOptionKind, token: string | null) =>
  loadShared(designOptionsKey(kind), () => apiGet<DesignOption[]>(designOptionsKey(kind), token))

export const loadSpaceNodes = (parentId: string | null, token: string | null) =>
  loadShared(spaceNodesKey(parentId), () => apiGet<SpaceNode[]>(spaceNodesKey(parentId), token))

/**
 * The whole active space catalogue in one request, filed under every level's
 * own key — including the empty list under each final choice, which is what
 * tells the Space screen the choice is complete. Every level of Space then
 * opens without a round trip. Children keep the server's order.
 */
const SPACE_TREE_KEY = '/api/space-nodes?tree=1'

export function loadSpaceTree(token: string | null): Promise<SpaceNode[]> {
  return loadShared(SPACE_TREE_KEY, () => apiGet<SpaceNode[]>(SPACE_TREE_KEY, token)).then((nodes) => {
    const children = new Map<string | null, SpaceNode[]>([[null, []]])
    for (const node of nodes) {
      children.set(node.parentId, [...(children.get(node.parentId) ?? []), node])
      if (!children.has(node.id)) children.set(node.id, [])
    }
    for (const [parentId, list] of children) seedShared(spaceNodesKey(parentId), list)
    return nodes
  })
}

/**
 * Everything the flow will ask for, requested together in the background.
 * Failures are ignored here; the step that needs a list reports its own error.
 */
export function prefetchFlowData(token: string | null): void {
  if (!token) return
  void loadTileFormats(token).catch(() => {})
  for (const kind of ['highlighterLocation', 'joint', 'pattern'] as const) {
    void loadDesignOptions(kind, token).catch(() => {})
  }
  void loadSpaceTree(token).catch(() => {})
}
