import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import HeaderUserMenu from '../components/HeaderUserMenu'
import './Summary.css'

const NOT_SELECTED = 'Not selected'

/** The longest a free-text requirement may be, matching the server's limit. */
const MAX_REQUIREMENT = 300

/**
 * One reviewable choice: what was picked, and the step that owns it.
 *
 * Declared here rather than inside Summary: a component created during render
 * is a new type every time, so React remounts it on each keystroke in the
 * requirement field below.
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
 * The last look before three images are paid for.
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
    tileImage,
    croppedImage,
    tileSize,
    spacePath,
    styleOption,
    style,
    jointWidthMm,
    patternOption,
    additionalRequirement,
    setAdditionalRequirement,
  } = useFlow()

  const tileSizeLabel = tileSize ? `${tileSize.replace('x', ' × ')} mm` : NOT_SELECTED
  const ready = Boolean(croppedImage && tileSize && spacePath.length > 0 && style)

  return (
    <div className="summary-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_12px_rgba(0,0,0,0.45)]">
        <div className="h-16 px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              aria-label="Return"
              className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors focus:outline-none"
              onClick={() => navigate('/style')}
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
              className="flex items-center gap-space-xs text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
              onClick={() => navigate('/style')}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">west</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider">Back</span>
            </button>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-medium">
                Step 06 / 06
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

          {/* The tile, as photographed and as cropped. The crop is what becomes
              the design reference, so it is the larger of the two. */}
          <div className="px-margin pb-space-md">
            <div className="summary-tile">
              <div className="summary-tile__main">
                {croppedImage ? (
                  <img src={croppedImage} alt="The cropped tile, used as the design reference" />
                ) : (
                  <span className="summary-tile__empty">{NOT_SELECTED}</span>
                )}
              </div>
              <div className="summary-tile__side">
                {tileImage && (
                  <div className="summary-tile__thumb">
                    <img src={tileImage} alt="The tile photograph before cropping" />
                    <span className="summary-tile__caption">Photo</span>
                  </div>
                )}
                <div className="summary-tile__actions">
                  <button type="button" onClick={() => navigate('/crop')}>
                    <span className="material-symbols-outlined text-[16px]">crop</span>
                    <span>Re-crop</span>
                  </button>
                  <button type="button" onClick={() => navigate('/camera')}>
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                    <span>Retake</span>
                  </button>
                </div>
              </div>
            </div>
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
                  label={index === 0 ? 'Space' : index === 1 ? 'Application' : 'Further selection'}
                  value={node.name}
                  to="/space"
                  editLabel={`Change ${node.name}`}
                />
              ))
            )}

            <Row
              label="Design style"
              value={styleOption?.name ?? style ?? NOT_SELECTED}
              to="/style"
              editLabel="Change the design style"
            />
            <Row
              label="Joint width"
              value={jointWidthMm !== null ? `${jointWidthMm} mm` : NOT_SELECTED}
              to="/style"
              editLabel="Change the joint width"
            />
            <Row
              label="Laying pattern"
              value={patternOption?.name ?? NOT_SELECTED}
              to="/style"
              editLabel="Change the laying pattern"
            />
          </div>

          <div className="px-margin pt-space-lg flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-outline">
                Additional important requirement — optional
              </span>
              <textarea
                className="summary-requirement"
                rows={3}
                maxLength={MAX_REQUIREMENT}
                placeholder="Jaise: warm lighting rakhna hai. Vanity floating honi chahiye."
                value={additionalRequirement}
                onChange={(event) => setAdditionalRequirement(event.target.value)}
              />
            </label>
            <span className="font-body-sm text-body-sm text-outline self-end">
              {additionalRequirement.length}/{MAX_REQUIREMENT}
            </span>
          </div>

          <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-lg pb-safe">
            <div className="max-w-md mx-auto px-margin pt-space-sm pb-space-md">
              <button
                className="w-full h-[52px] bg-primary text-on-primary hover:bg-primary-fixed-dim active:scale-[0.99] rounded-lg font-title-md text-title-md tracking-wider uppercase flex items-center justify-center gap-space-xs transition-all shadow-[0_8px_24px_rgba(197,168,128,0.22)] disabled:opacity-60"
                id="generate-btn"
                type="button"
                disabled={!ready}
                onClick={() => navigate('/loading')}
              >
                <span>Generate concepts</span>
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
