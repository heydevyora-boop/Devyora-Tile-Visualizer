import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, type SpaceNode } from '../utils/api'
import HeaderUserMenu from '../components/HeaderUserMenu'
import './Space.css'

/**
 * Where the tile is going.
 *
 * Not a flat list of rooms: the showroom's catalogue is a tree, and a
 * consultation walks down it until there is nothing further to choose —
 * Bathroom, then Powder Washroom, then Half Height. Nothing about that shape
 * is written here. This screen asks the server for the children of wherever
 * the salesperson currently is, and stops when a level comes back empty.
 *
 * That matters beyond tidiness: the level a customer picks is the one the
 * generation is held to, so the catalogue has to be the single place it is
 * defined.
 */
function Space() {
  const navigate = useNavigate()
  const { spacePath, setSpacePath, setSpace } = useFlow()
  const { token } = useAuth()

  // What was loaded, and for which level. Keeping the level alongside the
  // result means "still loading" is derived by comparing the two, rather than
  // blanking the list in an effect — which would flash the previous level's
  // options against the new heading on every step down.
  const [loaded, setLoaded] = useState<{ parentId: string | null; nodes: SpaceNode[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const current = spacePath[spacePath.length - 1] ?? null
  const currentParentId = current?.id ?? null
  const options = loaded && loaded.parentId === currentParentId ? loaded.nodes : null

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const nodes = await apiGet<SpaceNode[]>(
          `/api/space-nodes?parentId=${currentParentId ? encodeURIComponent(currentParentId) : 'root'}`,
          token,
          controller.signal,
        )
        if (!controller.signal.aborted) setLoaded({ parentId: currentParentId, nodes })
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load the spaces.')
      }
    })()
    return () => controller.abort()
  }, [currentParentId, token])

  // A level with no children is the end of the chain, so the choice is
  // complete and the flow can move on.
  const atLeaf = options !== null && options.length === 0 && spacePath.length > 0

  const choose = (node: SpaceNode) => {
    const next = [...spacePath, node]
    setSpacePath(next)
    // The root category still drives the curated per-room prompt config.
    setSpace(next[0].spaceId ?? next[0].name)
  }

  const back = () => {
    if (spacePath.length === 0) {
      navigate('/tile-size')
      return
    }
    const next = spacePath.slice(0, -1)
    setSpacePath(next)
    setSpace(next.length ? (next[0].spaceId ?? next[0].name) : null)
  }

  return (
    <div className="space-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_12px_rgba(0,0,0,0.45)]">
        <div className="h-16 px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              aria-label="Return"
              className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors focus:outline-none"
              onClick={back}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
            </button>
            <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">DEVYORA</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Space Selection</span>
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Visualizer</span>
          </div>
          <HeaderUserMenu />
        </div>
      </header>

      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full pb-32">
          <div className="px-margin pt-space-md pb-space-sm flex items-center justify-between">
            <button
              className="flex items-center gap-space-xs text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
              onClick={back}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">west</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider">Back</span>
            </button>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-medium">
                Step 04 / 06
              </span>
            </div>
          </div>

          {/* The trail so far, so the salesperson can see and undo a step in
              front of the customer. */}
          {spacePath.length > 0 && (
            <div className="px-margin pb-space-xs flex flex-wrap items-center gap-1">
              {spacePath.map((node, index) => (
                <span key={node.id} className="flex items-center gap-1">
                  {index > 0 && <span className="text-outline">/</span>}
                  <button
                    type="button"
                    className="font-label-caps text-label-caps uppercase tracking-wider text-primary hover:underline"
                    onClick={() => {
                      const next = spacePath.slice(0, index + 1)
                      setSpacePath(next)
                      setSpace(next[0].spaceId ?? next[0].name)
                    }}
                  >
                    {node.name}
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="px-margin pt-space-xs pb-space-lg flex flex-col gap-1.5">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">
              {spacePath.length === 0 ? 'Where is the tile going?' : `${current?.name}`}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {atLeaf
                ? current?.description || 'This application is ready to visualise.'
                : spacePath.length === 0
                  ? 'Select the architectural environment to visualize.'
                  : 'Choose the exact application — the result will follow it precisely.'}
            </p>
          </div>

          <div className="px-margin flex flex-col gap-space-sm">
            {error && (
              <p className="font-body-sm text-body-sm text-error" role="alert">
                {error}
              </p>
            )}
            {!error && options === null && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>
            )}

            {(options ?? []).map((node) => (
              <button
                key={node.id}
                type="button"
                className="w-full text-left bg-surface-container-low hover:bg-surface-container transition-all duration-200 rounded-xl overflow-hidden shadow-sm flex items-stretch"
                onClick={() => choose(node)}
              >
                {node.imageUrl && (
                  <img
                    className="w-24 h-24 object-cover flex-shrink-0"
                    src={node.imageUrl}
                    alt={node.name}
                    loading="lazy"
                  />
                )}
                <span className="flex-1 min-w-0 p-space-md flex flex-col justify-center gap-1">
                  <span className="font-title-md text-title-md text-on-surface">{node.name}</span>
                  {node.description && (
                    <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                      {node.description}
                    </span>
                  )}
                </span>
                <span className="material-symbols-outlined text-[20px] text-outline self-center pr-space-sm">
                  chevron_right
                </span>
              </button>
            ))}
          </div>

          <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-lg pb-safe">
            <div className="max-w-md mx-auto px-margin pt-space-sm pb-space-md">
              <button
                className="w-full h-[52px] bg-primary text-on-primary hover:bg-primary-fixed-dim active:scale-[0.99] rounded-lg font-title-md text-title-md tracking-wider uppercase flex items-center justify-center gap-space-xs transition-all shadow-[0_8px_24px_rgba(197,168,128,0.22)] disabled:opacity-60"
                id="continue-btn"
                type="button"
                disabled={!atLeaf}
                onClick={() => navigate('/style')}
              >
                <span>Continue</span>
                <span className="material-symbols-outlined text-[20px]">east</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Space
