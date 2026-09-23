import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import HeaderUserMenu from '../components/HeaderUserMenu'
import './Summary.css'

const TILE_SIZE_LABELS: Record<string, string> = {
  '600x600': '600 × 600 mm',
  '800x800': '800 × 800 mm',
  '1200x600': '1200 × 600 mm',
  '1200x1200': '1200 × 1200 mm',
}

const STYLE_LABELS: Record<string, string> = {
  minimal: 'Minimal',
  modern: 'Modern',
  luxury: 'Luxury',
  warm: 'Warm',
  contemporary: 'Contemporary',
  earthy: 'Earthy',
  indian: 'Indian',
  elegant: 'Elegant',
  surprise: 'Surprise Me',
}

const NOT_SELECTED = 'Not selected'

function Summary() {
  const navigate = useNavigate()
  const { croppedImage, tileSize, space, style } = useFlow()
  const tileSizeLabel = tileSize ? TILE_SIZE_LABELS[tileSize] ?? tileSize : NOT_SELECTED
  const spaceLabel = space ?? NOT_SELECTED
  const styleLabel = style ? STYLE_LABELS[style] ?? style : NOT_SELECTED
  const missingClass = 'text-on-surface-variant'
  const handleReturn = () => {
    navigate('/style')
  }
  const handleGenerate = () => {
    navigate('/loading')
  }
  const handleRecrop = () => {
    navigate('/crop')
  }
  const handleEditProfile = () => {
    navigate('/camera')
  }
  const handleEditSize = () => {
    navigate('/tile-size')
  }
  const handleEditSpace = () => {
    navigate('/space')
  }
  const handleEditStyle = () => {
    navigate('/style')
  }

  return (
    <div className="summary-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_12px_rgba(0,0,0,0.45)]">
        <div className="h-16 px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              aria-label="Return"
              className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors focus:outline-none"
              onClick={handleReturn}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
            </button>
            <div className="flex items-center gap-space-sm">
              <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">DEVYORA</span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Specification Sheet</span>
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Visualizer</span>
          </div>
          <HeaderUserMenu />
        </div>
      </header>
      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full pb-10">
          {/* Micro Progress Bar & Step Tracker */}
          <section className="px-margin pt-4 pb-2 flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs text-outline">
                <span className="material-symbols-outlined text-[16px] text-primary">layers</span>
                <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Specification Package</span>
              </div>
              <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">Step 06 / 06</span>
            </div>
            <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: '100%' }}></div>
            </div>
          </section>
          {/* Page Header */}
          <header className="px-margin pt-3 pb-space-md flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-wide">Review Specification</h1>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">Verify your showroom configuration before generating concepts.</p>
          </header>
          {/* Main Content Stack */}
          <main className="px-margin flex flex-col gap-space-lg">
            {/* Architectural Summary Master Card */}
            <article className="bg-surface-container rounded-xl overflow-hidden shadow-xl flex flex-col">
              {/* Tile Texture Showcase with Bronze Framing Ambient */}
              <div className="relative w-full aspect-[16/10] bg-surface-container-lowest overflow-hidden">
                {/* Physical Tile Reference Image */}
                {croppedImage ? (
                  <img
                    alt="Cropped physical tile reference"
                    className="w-full h-full object-cover"
                    src={croppedImage}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-container-lowest">
                    <span className="font-title-md text-title-md text-on-surface-variant">{NOT_SELECTED}</span>
                  </div>
                )}
                {/* Subtle Vignette & Framing Glow */}
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-surface-container-lowest/30 pointer-events-none"></div>
                {/* Floating Badge for Material Authentication */}
                <div className="absolute top-3 left-3 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                  <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface">Physical Scan Captured</span>
                </div>
                {/* Recalibrate Trigger */}
                <button aria-label="Re-crop Tile" className="absolute top-3 right-3 bg-surface-container-lowest/90 backdrop-blur-md text-on-surface hover:text-primary px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md transition-colors" type="button" onClick={handleRecrop}>
                  <span className="material-symbols-outlined text-[14px]">crop</span>
                  <span className="font-label-caps text-label-caps uppercase">Crop</span>
                </button>
                {/* Texture Metadata Bar */}
                <div className="absolute bottom-2 inset-x-3 flex items-center justify-between pointer-events-none">
                  <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary-fixed-dim bg-surface-container-lowest/80 px-2 py-0.5 rounded">Honed Pore Scale 1:1</span>
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant bg-surface-container-lowest/80 px-2 py-0.5 rounded">Matte Sheen</span>
                </div>
              </div>
              {/* Card Content & Details */}
              <div className="p-4 flex flex-col gap-space-md">
                {/* Material Title & Provenance */}
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">Material Profile</span>
                    <h2 className="font-title-md text-title-md text-on-surface">Physical Tile Reference (Travertine Honed)</h2>
                    <span className="font-body-sm text-body-sm text-secondary-fixed-dim">Sintered Porcelain Slabs • Italy</span>
                  </div>
                  <button aria-label="Edit Tile Profile" className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-primary hover:bg-surface-bright transition-colors" type="button" onClick={handleEditProfile}>
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>
                {/* Specifications Breakdown Grid */}
                <div className="flex flex-col gap-2 pt-2">
                  {/* Row 1: Tile Size */}
                  <div className="bg-surface-container-low p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[18px]">aspect_ratio</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-caps text-label-caps uppercase text-outline">Tile Size</span>
                        <span className={`font-spec-numeral text-spec-numeral ${tileSize ? 'text-on-surface' : missingClass}`}>{tileSizeLabel}</span>
                      </div>
                    </div>
                    <button aria-label="Edit Tile Size" className="p-2 text-on-surface-variant hover:text-primary transition-colors" type="button" onClick={handleEditSize}>
                      <span className="material-symbols-outlined text-[18px]">tune</span>
                    </button>
                  </div>
                  {/* Row 2: Selected Space */}
                  <div className="bg-surface-container-low p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[18px]">bathtub</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-caps text-label-caps uppercase text-outline">Selected Space</span>
                        <span className={`font-title-md text-title-md ${space ? 'text-on-surface' : missingClass}`}>{spaceLabel}</span>
                      </div>
                    </div>
                    <button aria-label="Edit Space" className="p-2 text-on-surface-variant hover:text-primary transition-colors" type="button" onClick={handleEditSpace}>
                      <span className="material-symbols-outlined text-[18px]">tune</span>
                    </button>
                  </div>
                  {/* Row 3: Design Style */}
                  <div className="bg-surface-container-low p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[18px]">architecture</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-caps text-label-caps uppercase text-outline">Design Style</span>
                        <span className={`font-title-md text-title-md ${style ? 'text-on-surface' : missingClass}`}>{styleLabel}</span>
                      </div>
                    </div>
                    <button aria-label="Edit Style" className="p-2 text-on-surface-variant hover:text-primary transition-colors" type="button" onClick={handleEditStyle}>
                      <span className="material-symbols-outlined text-[18px]">tune</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
            {/* Technical Perspective Projection Preview Card */}
            <section className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">Render Pipeline Matrix</span>
                <span className="font-label-caps text-label-caps uppercase text-primary">3 Angles Queued</span>
              </div>
              {/* Tri-perspective Visual Diagram */}
              <div className="grid grid-cols-3 gap-2 py-1">
                {/* Angle 1 */}
                <div className="bg-surface-container p-2.5 rounded-lg flex flex-col items-center text-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[16px]">view_in_ar</span>
                  </div>
                  <span className="font-label-caps text-label-caps uppercase text-on-surface">Isometric Eye</span>
                  <span className="font-body-sm text-body-sm text-outline">35° Oblique</span>
                </div>
                {/* Angle 2 */}
                <div className="bg-surface-container p-2.5 rounded-lg flex flex-col items-center text-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[16px]">camera</span>
                  </div>
                  <span className="font-label-caps text-label-caps uppercase text-on-surface">Vanity Wall</span>
                  <span className="font-body-sm text-body-sm text-outline">Eye-Level</span>
                </div>
                {/* Angle 3 */}
                <div className="bg-surface-container p-2.5 rounded-lg flex flex-col items-center text-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[16px]">texture</span>
                  </div>
                  <span className="font-label-caps text-label-caps uppercase text-on-surface">Floor Joint</span>
                  <span className="font-body-sm text-body-sm text-outline">Raking Light</span>
                </div>
              </div>
              {/* Value Statement */}
              <div className="flex items-center gap-2.5 pt-1 text-on-surface-variant">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0">auto_awesome</span>
                <p className="font-body-sm text-body-sm leading-tight text-on-surface-variant">
                  Generating 3 unique architectural perspectives calibrated to your tile scale and finish.
                </p>
              </div>
            </section>
            {/* Primary Action Section */}
            <div className="flex flex-col gap-2 pt-2">
              {/* Large Primary Action Button */}
              <button
                className="w-full h-14 bg-primary text-on-primary font-title-md text-title-md rounded flex items-center justify-center gap-3 shadow-[0_4px_24px_rgba(197,168,128,0.25)] active:scale-[0.98] transition-transform duration-150 focus:outline-none"
                id="generate-btn"
                onClick={handleGenerate}
                type="button"
              >
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
                <span className="tracking-wide">Generate 3 Designs</span>
              </button>
              {/* Subtext Guarantee */}
              <div className="flex items-center justify-center gap-1.5 text-center py-1">
                <span className="material-symbols-outlined text-[14px] text-outline">lock</span>
                <span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">Devyora Precision Optical Calibrator</span>
              </div>
            </div>
          </main>
        </div>
      </main>
    </div>
  )
}

export default Summary
