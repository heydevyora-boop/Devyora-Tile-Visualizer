import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import './TileSize.css'

function TileSize() {
  const navigate = useNavigate()
  const { tileSize, setTileSize } = useFlow()
  const handleReturn = () => {
    navigate('/crop')
  }
  const handleBack = () => {
    navigate('/crop')
  }
  const handleSelectSize = (size: string) => {
    setTileSize(size)
  }
  const handleContinue = () => {
    navigate('/space')
  }
  const sizeLabel =
    tileSize === '600x600'
      ? '600 × 600 mm'
      : tileSize === '800x800'
        ? '800 × 800 mm'
        : tileSize === '1200x600'
          ? '1200 × 600 mm'
          : tileSize === '1200x1200'
            ? '1200 × 1200 mm'
            : null

  return (
    <div className="tile-size-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
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
            <span className="font-headline-sm text-headline-sm uppercase text-on-surface">Layout Configuration</span>
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Visualizer</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(197,168,128,0.18)]">
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </header>
      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full pb-32">
          {/* Stepper & Context Header */}
          <div className="px-margin pt-space-md pb-space-sm flex items-center justify-between">
            <button
              aria-label="Previous step"
              className="flex items-center gap-space-xs text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
              onClick={handleBack}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">west</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider">Back</span>
            </button>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-medium">
                Step 03 / 06
              </span>
            </div>
          </div>
          {/* Prompt Headline */}
          <div className="px-margin pt-space-xs pb-space-lg flex flex-col gap-1.5">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">
              What is the size of this tile?
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Select the actual size of the tile for accurate scale.
            </p>
          </div>
          {/* Interactive Scale Dimension Cards */}
          <div className="px-margin flex flex-col gap-space-md" id="size-selector-group">
            {/* Option 1: 600 x 600 mm */}
            <div
              className={`tile-card cursor-pointer w-full bg-surface-container-low hover:bg-surface-container transition-all duration-200 p-space-md rounded-xl flex items-center justify-between relative shadow-sm${tileSize === '600x600' ? ' selected' : ''}`}
              data-size="600x600"
              onClick={() => handleSelectSize('600x600')}
            >
              <div className="flex items-center gap-space-md min-w-0">
                {/* Architectural Ratio Silhouette */}
                <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0 text-outline">
                  <div className="w-6 h-6 rounded-[2px] bg-outline-variant/60 flex items-center justify-center">
                    <span className="font-label-caps text-[8px] text-outline select-none">1:1</span>
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-spec-numeral text-spec-numeral text-on-surface tracking-wide">600 × 600 mm</span>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mt-0.5">
                    Standard Square Format
                  </span>
                </div>
              </div>
              {/* Radio Indicator */}
              <div className="radio-pill w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                <span
                  className="check-icon material-symbols-outlined text-[16px] text-on-primary hidden"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check
                </span>
              </div>
            </div>
            {/* Option 2: 800 x 800 mm */}
            <div
              className={`tile-card cursor-pointer w-full bg-surface-container-low hover:bg-surface-container transition-all duration-200 p-space-md rounded-xl flex items-center justify-between relative shadow-sm${tileSize === '800x800' ? ' selected' : ''}`}
              data-size="800x800"
              onClick={() => handleSelectSize('800x800')}
            >
              <div className="flex items-center gap-space-md min-w-0">
                {/* Architectural Ratio Silhouette */}
                <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0 text-outline">
                  <div className="w-7 h-7 rounded-[2px] bg-outline-variant/60 flex items-center justify-center">
                    <span className="font-label-caps text-[8px] text-outline select-none">1:1</span>
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-spec-numeral text-spec-numeral text-on-surface tracking-wide">800 × 800 mm</span>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mt-0.5">
                    Contemporary Medium Square
                  </span>
                </div>
              </div>
              {/* Radio Indicator */}
              <div className="radio-pill w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                <span
                  className="check-icon material-symbols-outlined text-[16px] text-on-primary hidden"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check
                </span>
              </div>
            </div>
            {/* Option 3: 1200 x 600 mm (Pre-Selected) */}
            <div
              className={`tile-card cursor-pointer w-full bg-surface-container-low hover:bg-surface-container transition-all duration-200 p-space-md rounded-xl flex items-center justify-between relative shadow-sm${tileSize === '1200x600' ? ' selected' : ''}`}
              data-size="1200x600"
              onClick={() => handleSelectSize('1200x600')}
            >
              <div className="flex items-center gap-space-md min-w-0">
                {/* Architectural Ratio Silhouette (2:1 Rectangle) */}
                <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0 text-outline">
                  <div className="w-9 h-5 rounded-[2px] bg-outline-variant/60 flex items-center justify-center">
                    <span className="font-label-caps text-[8px] text-outline select-none">2:1</span>
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-spec-numeral text-spec-numeral text-on-surface tracking-wide">1200 × 600 mm</span>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mt-0.5">
                    Large Rectangular Slab
                  </span>
                </div>
              </div>
              {/* Radio Indicator */}
              <div className="radio-pill w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                <span
                  className="check-icon material-symbols-outlined text-[16px] text-on-primary hidden"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check
                </span>
              </div>
            </div>
            {/* Option 4: 1200 x 1200 mm */}
            <div
              className={`tile-card cursor-pointer w-full bg-surface-container-low hover:bg-surface-container transition-all duration-200 p-space-md rounded-xl flex items-center justify-between relative shadow-sm${tileSize === '1200x1200' ? ' selected' : ''}`}
              data-size="1200x1200"
              onClick={() => handleSelectSize('1200x1200')}
            >
              <div className="flex items-center gap-space-md min-w-0">
                {/* Architectural Ratio Silhouette */}
                <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0 text-outline">
                  <div className="w-8 h-8 rounded-[2px] bg-outline-variant/60 flex items-center justify-center">
                    <span className="font-label-caps text-[8px] text-outline select-none">1:1</span>
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-spec-numeral text-spec-numeral text-on-surface tracking-wide">1200 × 1200 mm</span>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mt-0.5">
                    Grand Monolithic Slab
                  </span>
                </div>
              </div>
              {/* Radio Indicator */}
              <div className="radio-pill w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                <span
                  className="check-icon material-symbols-outlined text-[16px] text-on-primary hidden"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check
                </span>
              </div>
            </div>
          </div>
          {/* Subtle Scale Reference Preview */}
          <div className="px-margin mt-space-lg">
            <div className="w-full bg-surface-container-lowest rounded-xl p-space-md flex flex-col gap-space-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">
                  Proportional Perspective
                </span>
                <span
                  className="font-label-caps text-label-caps text-primary tracking-widest uppercase"
                  id="active-size-label"
                >
                  {sizeLabel ? `${sizeLabel} Selected` : 'Select a size'}
                </span>
              </div>
              {/* Tactile Architectural Visualizer Preview */}
              <div className="relative w-full h-28 bg-surface-container-high/60 rounded-lg flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#998f83_1px,transparent_1px)] [background-size:12px_12px]"></div>
                {/* Scaling Tile Model Silhouette */}
                <div
                  className="transition-all duration-300 w-28 h-14 bg-surface-container-highest rounded-[3px] shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex items-center justify-center relative"
                  id="visualizer-tile"
                >
                  <div className="absolute inset-0.5 bg-surface-container rounded-[2px] flex items-center justify-center">
                    <span
                      className="font-label-caps text-[10px] text-primary tracking-wider uppercase"
                      id="visualizer-metric"
                    >
                      2:1 Aspect
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Bottom Docked Tactical Trigger */}
          <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-lg pb-safe">
            <div className="max-w-md mx-auto px-margin pt-space-sm pb-space-md">
              <button
                className="w-full h-[52px] bg-primary text-on-primary hover:bg-primary-fixed-dim active:scale-[0.99] rounded-lg font-title-md text-title-md tracking-wider uppercase flex items-center justify-center gap-space-xs transition-all shadow-[0_8px_24px_rgba(197,168,128,0.22)]"
                id="continue-btn"
                type="button"
                onClick={handleContinue}
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

export default TileSize
