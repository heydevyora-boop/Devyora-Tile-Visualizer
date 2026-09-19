import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Loading.css'

function Loading() {
  const navigate = useNavigate()
  const handleReturn = () => {
    navigate('/summary')
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate('/results')
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [navigate])

  return (
    <div className="loading-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
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
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(197,168,128,0.18)]">
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </header>
      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full px-margin py-space-xl items-center justify-between min-h-[calc(100vh-4rem)]">
          {/* Top Subtle Architectural Identity */}
          <div className="flex flex-col items-center justify-center pt-space-md text-center">
            <span className="font-label-caps text-label-caps tracking-[0.28em] text-outline uppercase">Studio Visualizer</span>
            <span className="font-spec-numeral text-spec-numeral text-primary/80 mt-space-xs font-light">PROPORTION / 1:1.618</span>
          </div>
          {/* Central Visual Anchor & Geometric Architectural Motion */}
          <div className="flex flex-col items-center justify-center w-full max-w-sm my-auto text-center">
            {/* Architectural Grid Projection Wireframe */}
            <div className="relative w-56 h-56 flex items-center justify-center mb-space-xl">
              {/* Ambient Ground Layer Glow (Subtle Material Luminance) */}
              <div className="absolute inset-4 rounded-full bg-primary/5 blur-2xl pointer-events-none"></div>
              {/* Animated SVG Architectural Tile Framework */}
              <svg className="w-full h-full text-outline-variant" fill="none" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                {/* Isometric Ground Reference Grid */}
                <g className="text-surface-container-highest" stroke="currentColor" strokeDasharray="2 3" strokeWidth="0.75">
                  <path d="M20 100 L100 55 L180 100 L100 145 Z"></path>
                  <path d="M40 100 L100 66 L160 100 L100 134 Z"></path>
                  <path d="M60 100 L100 77 L140 100 L100 123 Z"></path>
                </g>
                {/* Converging Spec Projection Lines */}
                <line className="text-outline/40" stroke="currentColor" strokeWidth="0.5" x1="100" x2="100" y1="20" y2="180"></line>
                <line className="text-outline/40" stroke="currentColor" strokeWidth="0.5" x1="20" x2="180" y1="100" y2="100"></line>
                {/* Primary Warm Bronze Calibration Tile (Floating Plane) */}
                <rect className="text-primary" fill="none" height="80" id="calibTile" opacity="0.85" stroke="currentColor" strokeWidth="1.25" width="80" x="60" y="60">
                  <animate attributeName="stroke-dasharray" dur="4.5s" repeatCount="indefinite" values="0,320; 80,0; 320,0"></animate>
                  <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" values="0.4; 0.95; 0.4"></animate>
                </rect>
                {/* Golden Ratio Nested Inner Tessellation */}
                <rect className="text-tertiary-fixed-dim" fill="none" height="50" opacity="0.65" stroke="currentColor" strokeDasharray="1 2" strokeWidth="0.75" width="50" x="75" y="75">
                  <animateTransform attributeName="transform" dur="9s" from="0 100 100" repeatCount="indefinite" to="90 100 100" type="rotate"></animateTransform>
                </rect>
                {/* Architectural Dimension Crosshairs (Corner Precision Ticks) */}
                <g className="text-primary" stroke="currentColor" strokeWidth="1">
                  {/* Top Left Cross */}
                  <line x1="56" x2="64" y1="60" y2="60"></line>
                  <line x1="60" x2="60" y1="56" y2="64"></line>
                  {/* Top Right Cross */}
                  <line x1="136" x2="144" y1="60" y2="60"></line>
                  <line x1="140" x2="140" y1="56" y2="64"></line>
                  {/* Bottom Left Cross */}
                  <line x1="56" x2="64" y1="140" y2="140"></line>
                  <line x1="60" x2="60" y1="136" y2="144"></line>
                  {/* Bottom Right Cross */}
                  <line x1="136" x2="144" y1="140" y2="140"></line>
                  <line x1="140" x2="140" y1="136" y2="144"></line>
                </g>
                {/* Center Intersection Point Indicator */}
                <circle className="text-primary" cx="100" cy="100" fill="currentColor" r="1.5">
                  <animate attributeName="r" dur="2.2s" repeatCount="indefinite" values="1; 2.5; 1"></animate>
                </circle>
              </svg>
              {/* Center Depth Spec Badge */}
              <div className="absolute bottom-1 px-space-sm py-0.5 rounded-DEFAULT bg-surface-container text-on-surface-variant font-label-caps text-label-caps tracking-widest uppercase">
                600 × 1200 mm
              </div>
            </div>
            {/* Editorial Architectural Heading */}
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-wide font-normal mb-space-sm">
              Creating your concepts…
            </h2>
            {/* Subtitle */}
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xs leading-relaxed mb-space-lg">
              We’re exploring different ways to use this tile.
            </p>
            {/* Linear Micro Calibration Metric Indicator */}
            <div className="w-full max-w-[240px] flex flex-col items-center gap-space-xs">
              <div className="w-full h-[2px] bg-surface-container-high rounded-full overflow-hidden relative">
                <div className="h-full bg-primary transition-all duration-700 ease-out" id="metricBar" style={{ width: '28%' }}></div>
              </div>
              {/* Real-time Calibration Stage Ticker */}
              <div className="flex items-center justify-between w-full pt-space-xs font-label-caps text-label-caps text-outline uppercase tracking-wider">
                <span id="metricStepLabel">Stage 01/03</span>
                <span id="metricRatioLabel">Surface Map</span>
              </div>
            </div>
          </div>
          {/* Bottom Curatorial Context & Spatial Reassurance */}
          <div className="w-full max-w-sm flex flex-col items-center gap-space-md pb-space-lg">
            {/* Active Stage Callout Card */}
            <div className="w-full bg-surface-container-low rounded-xl p-space-md flex items-center gap-space-md shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[18px]" id="phaseIcon">texture</span>
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="font-label-caps text-label-caps text-primary uppercase tracking-widest">Active Process</span>
                <span className="font-body-sm text-body-sm text-on-surface truncate" id="phaseText">
                  Calibrating tile scale and surface reflection…
                </span>
              </div>
            </div>
            {/* Quiet Reassurance Footer Note */}
            <div className="flex items-center justify-center gap-space-xs text-outline font-label-caps text-label-caps uppercase tracking-[0.16em]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 inline-block"></span>
              <span>Formulating 3 bespoke architectural visions</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Loading
