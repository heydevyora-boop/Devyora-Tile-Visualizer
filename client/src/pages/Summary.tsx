import { useNavigate } from 'react-router-dom'
import { formatTileSize as tileSizeLabelFor } from '../utils/tileSizeLabel'
import { useFlow } from '../state/FlowContext'
import HeaderUserMenu from '../components/HeaderUserMenu'
import './Summary.css'

const NOT_SELECTED = 'Not selected'

/**
 * One reviewable choice: what was picked, and the step that owns it.
 *
 * Declared here rather than inside Summary: a component created during render
 * is a new type every time, so React would remount it on every render.
 */
function Row({
  label,
  value,
  to,
  editLabel,
}: {
  label: string
  value: string
  to: string
  editLabel: string
}) {
  const navigate = useNavigate()
  return (
    <div className="summary-row">
      <div className="summary-row__text">
        <span className="summary-row__label">{label}</span>
        <span
          className={`summary-row__value${value === NOT_SELECTED ? ' summary-row__value--missing' : ''}`}
        >
          {value}
        </span>
      </div>
      <button
        type="button"
        className="summary-row__edit"
        onClick={() => navigate(to)}
        aria-label={editLabel}
      >
        <span className="material-symbols-outlined text-[16px]">edit</span>
        <span>Edit</span>
      </button>
    </div>
  )
}

/**
 * One tile reference as it will be sent: the crop, the photo it came from, and
 * the way to change either. Used for both tiles, so the highlighter and the
 * plain tile are reviewed — and edited — as the two separate things they are.
 */
function TileBlock({
  label,
  image,
  source,
  emptyText,
  emptyIsError,
  cropTo,
}: {
  label: string
  image: string | null
  source: string | null
  emptyText: string
  /** A missing required tile is an error; a deliberate "No Plain Tile" is not. */
  emptyIsError: boolean
  cropTo: string
}) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-1.5">
      <span className="summary-tile__label">{label}</span>
      <div className="summary-tile">
        <div className="summary-tile__main">
          {image ? (
            <img src={image} alt={`The cropped ${label.toLowerCase()}, used as a design reference`} />
          ) : (
            <span className={emptyIsError ? 'summary-tile__empty' : 'summary-tile__none'}>
              {emptyText}
            </span>
          )}
        </div>
        <div className="summary-tile__side">
          {image && source && (
            <div className="summary-tile__thumb">
              <img src={source} alt={`The ${label.toLowerCase()} photograph before cropping`} />
              <span className="summary-tile__caption">Photo</span>
            </div>
          )}
          <div className="summary-tile__actions">
            {image && source && (
              <button type="button" onClick={() => navigate(cropTo)}>
                <span className="material-symbols-outlined text-[16px]">crop</span>
                <span>Re-crop</span>
              </button>
            )}
            <button type="button" onClick={() => navigate('/tile-input')}>
              <span className="material-symbols-outlined text-[16px]">
                {image ? 'swap_horiz' : 'edit'}
              </span>
              <span>{image ? 'Replace' : 'Edit'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The last look before a concept is paid for.
 *
 * Every choice made across the flow is on one screen, each with its own Edit
 * that returns to the step that owns it — and only that step. A salesperson
 * correcting the joint width in front of a customer should not have to retake
 * the photograph, so nothing here restarts anything.
 *
 * Every value shown is the one that will be sent. Nothing on this screen is
 * decorative or assumed: if a choice was not made, it says so rather than
 * showing a plausible default.
 */
function Summary() {
  const navigate = useNavigate()
  const {
    customer,
    highlighterSource,
    highlighterTileImage,
    plainSource,
    plainTileImage,
    plainTileProvided,
    tileSize,
    tileFormatOption,
    spacePath,
    highlighterLocationOption,
    jointWidthMm,
    patternOption,
    additionalRequirement,
  } = useFlow()

  const tileSizeLabel = tileSizeLabelFor(tileSize, tileFormatOption) ?? NOT_SELECTED
  // The plain tile is complete as a photo or as the explicit "No Plain Tile".
  const plainDecided =
    plainTileProvided === false || (plainTileProvided === true && plainTileImage !== null)
  // What is still missing, by name — so a disabled Generate says why.
  const missing = [
    !highlighterTileImage && 'the highlighter tile',
    !plainDecided && 'a plain tile (or No Plain Tile)',
    !tileSize && 'the tile size',
    spacePath.length === 0 && 'the placement',
    !highlighterLocationOption && 'the highlighter location',
  ].filter((item): item is string => Boolean(item))
  const ready = missing.length === 0
  const instructions = additionalRequirement.trim()

  return (
    <div className="summary-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_12px_rgba(0,0,0,0.45)]">
        <div className="h-16 px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              aria-label="Return"
              className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors focus:outline-none"
              onClick={() => navigate('/instructions')}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
            </button>
            <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">DEVYORA</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Review</span>
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Visualizer</span>
          </div>
          <HeaderUserMenu />
        </div>
      </header>

      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full pb-32">
          <div className="px-margin pt-space-md pb-space-sm flex items-center justify-between">
            <button
              className="tap-target flex items-center gap-space-xs text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
              onClick={() => navigate('/instructions')}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">west</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider">Back</span>
            </button>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-medium">
                Step 08 / 08
              </span>
            </div>
          </div>

          <div className="px-margin pt-space-xs pb-space-md flex flex-col gap-1.5">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">
              Check before we generate
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Change anything here without starting over.
            </p>
          </div>

          {/* The two tile references, each as photographed and as cropped. They
              are separate inputs with separate roles, so they are reviewed
              and changed separately. */}
          <div className="px-margin pb-space-md flex flex-col gap-space-md">
            <TileBlock
              label="Highlighter tile"
              image={highlighterTileImage}
              source={highlighterSource}
              emptyText={NOT_SELECTED}
              emptyIsError
              cropTo="/crop/highlighter"
            />
            <TileBlock
              label="Plain tile"
              image={plainTileImage}
              source={plainSource}
              // Three distinct states, never collapsed into "empty": a photo,
              // the explicit "No Plain Tile", or not decided yet.
              emptyText={plainTileProvided === false ? 'No Plain Tile' : NOT_SELECTED}
              emptyIsError={plainTileProvided !== false}
              cropTo="/crop/plain"
            />
          </div>

          <div className="px-margin flex flex-col gap-space-sm">
            <Row
              label="Client"
              value={customer ? `${customer.name} · ${customer.mobile}` : NOT_SELECTED}
              to="/start"
              editLabel="Change the client"
            />
            <Row label="Tile size" value={tileSizeLabel} to="/tile-size" editLabel="Change the tile size" />

            {/* Each level of the chosen application is its own line, because
                each is a decision the customer made and may want changed. */}
            {spacePath.length === 0 ? (
              <Row label="Space" value={NOT_SELECTED} to="/space" editLabel="Choose the space" />
            ) : (
              spacePath.map((node, index) => (
                <Row
                  key={node.id}
                  label={index === 0 ? 'Space' : index === 1 ? 'Subcategory' : 'Further option'}
                  value={node.name}
                  to="/space"
                  editLabel={`Change ${node.name}`}
                />
              ))
            )}

            {/* The whole chain on one line as well: the placement is what the
                result is held to, so it is worth reading as a single phrase. */}
            <Row
              label="Placement"
              value={spacePath.length ? spacePath.map((node) => node.name).join(' → ') : NOT_SELECTED}
              to="/space"
              editLabel="Change the placement"
            />
            <Row
              label="Highlighter location"
              value={highlighterLocationOption?.name ?? NOT_SELECTED}
              to="/highlighter-location"
              editLabel="Change the highlighter location"
            />
            {/* Optional, as it always was — so an unset joint reads as not
                specified rather than as a missing required choice. */}
            <Row
              label="Joint width"
              value={jointWidthMm !== null ? `${jointWidthMm} mm` : 'Not specified'}
              to="/joint"
              editLabel="Change the joint width"
            />
            <Row
              label="Laying pattern"
              value={patternOption?.name ?? 'Not specified'}
              to="/pattern"
              editLabel="Change the laying pattern"
            />
            <Row
              label="Additional instructions"
              value={instructions || 'None'}
              to="/instructions"
              editLabel="Change the additional instructions"
            />
          </div>

          <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-lg pb-safe">
            <div className="max-w-md mx-auto px-margin pt-space-sm pb-space-md flex flex-col gap-space-xs">
              {!ready && (
                <p className="font-body-sm text-body-sm text-on-surface-variant text-center" id="missing-note">
                  Still needed: {missing.join(', ')}.
                </p>
              )}
              <button
                className="w-full h-[52px] bg-primary text-on-primary hover:bg-primary-fixed-dim active:scale-[0.99] rounded-lg font-title-md text-title-md tracking-wider uppercase flex items-center justify-center gap-space-xs transition-all shadow-[0_8px_24px_rgba(197,168,128,0.22)] disabled:opacity-60"
                id="generate-btn"
                type="button"
                disabled={!ready}
                onClick={() => navigate('/loading')}
              >
                <span>Generate concept</span>
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Summary
