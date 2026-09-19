import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import './Results.css'

const TILE_SIZE_LABELS: Record<string, string> = {
  '600x600': '600 × 600 mm',
  '800x800': '800 × 800 mm',
  '1200x600': '1200 × 600 mm',
  '1200x1200': '1200 × 1200 mm',
}

const NOT_SELECTED = 'Not selected'

// Used when the user lands on /results without a completed generation
// (e.g. navigating directly to the route).
const FALLBACK_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDP5oA3AvnTsObA-oOr4trg44RxFMMyW1m2E5Wj_q9lD8zAQpMucUrLBk1i1LS3-0QMe5H1M9vIcaNV7UZer4PYV8q16dhpMVMIWdKyqidxgMR1C40tcJKfupQba_dFnRvQyL9_ZbtHz2N5OfsvGA__l8k4ov_w-LRcpxFLSl06yQWvUZ1yQZy9E1HM8OdDMZC1QbbLRXfpckIN3-C89gipLFBzNYdi0iCqSJYptKIrO6cqG7S7utJooQ',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDEpIiiTMWE3tlqPgacanwBWvrlqlG6yioPf75-SOnp0uAf0O8cNzvnaO_1Toqhj7hHHiF4gXu-W-auEGwIJhM3ydoh1__OhYTjgizqJbYzmWcaw58wxITXm3jtZm2xfURG3ahEkSWTZwMrVpu5B8Ft2kEWlOyzU1xcW1nX_jbw5v1u64B9pkwoNH9O9GHqfq7KmbLVw6SzRU8Bzq5bc-NRnbM7FdIOtlDbEmwzzkNrZH9AZqqF7uIg3w',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB00wtIuZZffbITcFtmcFsbTCdn_bhuz-jF0VLOqT77jqOnOpV6LFOH6AloZZVAl4HlC-YeZDpywkX1PQcE2T87vfmpgcqLRM8kDsl3ovTJTN6hP4TutpbLN9O6lgXofAVjw4LXYm9Ouaa2Ba_sZ7T6-OE78YIB-N5kIqjI6sx8tWWEMEmHTtt7znsHib_w4XqSX3C1i2uJ3NlEssWvq3EoaxkyeIxr5WV_KUfgHVSkiyzXdhryU5hFNA',
]

function Results() {
  const navigate = useNavigate()
  const { tileSize, space, generatedResult } = useFlow()
  const conceptImages = generatedResult?.images?.length
    ? generatedResult.images
    : FALLBACK_IMAGES
  const tileSizeLabel = tileSize ? TILE_SIZE_LABELS[tileSize] ?? tileSize : NOT_SELECTED
  const spaceLabel = space ?? NOT_SELECTED
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({})
  const handleImageError = (index: number) => {
    setFailedImages((prev) => ({ ...prev, [index]: true }))
  }
  const handleReturn = () => {
    navigate('/summary')
  }
  const handleShare = () => {}
  const handleExport = () => {}
  const handlePin = () => {}
  const handleRegenerate = () => {
    navigate('/loading')
  }
  const handleStartNew = () => {
    navigate('/')
  }
  const handleDownload = () => {}

  return (
    <div className="results-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
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
        <div className="flex flex-col w-full">
          {/* Sub-Header Context Bar */}
          <div className="w-full bg-surface-container-low px-margin py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">DEVYORA</span>
              <span className="text-outline text-[10px]">•</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{spaceLabel}</span>
              <span className="text-outline text-[10px]">•</span>
              <span className="font-spec-numeral text-body-sm text-primary">{tileSizeLabel}</span>
            </div>
            <div className="flex items-center gap-space-xs">
              <button
                aria-label="Share concept folio"
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant active:text-primary active:bg-surface-bright transition-colors"
                type="button"
                onClick={handleShare}
              >
                <span className="material-symbols-outlined text-[18px]">share</span>
              </button>
              <button
                aria-label="Export folio"
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant active:text-primary active:bg-surface-bright transition-colors"
                type="button"
                onClick={handleExport}
              >
                <span className="material-symbols-outlined text-[18px]">ios_share</span>
              </button>
            </div>
          </div>
          {/* Editorial Section Intro */}
          <section className="px-margin pt-space-lg pb-space-md flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">Showroom Spec Sheet No. 09</span>
            </div>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-wide">
              Architectural Concepts
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              3 generated visions using your showroom tile selection.
            </p>
          </section>
          {/* Vertical Stacked Feed of Concepts */}
          <main className="px-margin pb-32 flex flex-col gap-space-lg">
            {/* Concept 01 Card */}
            <article className="bg-surface-container rounded-xl overflow-hidden shadow-lg flex flex-col transition-all">
              {/* Image Container */}
              <div className="relative w-full aspect-[4/3] bg-surface-container-highest overflow-hidden">
                {failedImages[0] ? (
                  <div className="w-full h-full flex items-center justify-center bg-surface-container-highest">
                    <span className="material-symbols-outlined text-[40px] text-on-surface-variant">broken_image</span>
                  </div>
                ) : (
                  <img
                    alt="High-end minimal architectural luxury bathroom interior featuring warm limestone and large format floor and wall tiles, floating vanity, warm recessed cove lighting, serene spa ambiance"
                    className="w-full h-full object-cover"
                    src={conceptImages[0] ?? FALLBACK_IMAGES[0]}
                    onError={() => handleImageError(0)}
                  />
                )}
                {/* Ambient subtle overlay scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 via-transparent to-transparent"></div>
                {/* Surface Specification Tag */}
                <div className="absolute top-space-md left-space-md bg-surface-container-lowest/85 backdrop-blur-md px-space-sm py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface">Concept 01</span>
                </div>
                <button
                  aria-label="Pin finish selection"
                  className="absolute top-space-md right-space-md w-9 h-9 rounded-full bg-surface-container-lowest/80 backdrop-blur-md flex items-center justify-center text-on-surface active:text-primary transition-colors"
                  type="button"
                  onClick={handlePin}
                >
                  <span className="material-symbols-outlined text-[18px]">bookmark</span>
                </button>
                {/* In-view specs pill anchored over lower image bounds */}
                <div className="absolute bottom-space-md left-space-md right-space-md flex items-center justify-between">
                  <div className="bg-surface-container/90 backdrop-blur-md px-space-sm py-1 rounded-full">
                    <span className="font-body-sm text-body-sm text-primary">Full Height Slab • Matte Honed</span>
                  </div>
                  <span className="font-spec-numeral text-body-sm text-on-surface/80 bg-surface-container-lowest/80 backdrop-blur-md px-2 py-0.5 rounded">R10 • 9.5mm</span>
                </div>
              </div>
              {/* Card Metadata & Consultation Notes */}
              <div className="p-space-md flex flex-col gap-space-xs bg-surface-container">
                <div className="flex items-center justify-between">
                  <h2 className="font-title-md text-title-md text-on-surface">
                    Vanity Wall & Floor
                  </h2>
                  <span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">Plan A</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Continuous slab orientation minimizing lateral grout joints. Balanced against floating rift-cut timber joinery and warm 2700K perimeter cove grazing.
                </p>
              </div>
            </article>
            {/* Concept 02 Card */}
            <article className="bg-surface-container rounded-xl overflow-hidden shadow-lg flex flex-col transition-all">
              {/* Image Container */}
              <div className="relative w-full aspect-[4/3] bg-surface-container-highest overflow-hidden">
                {failedImages[1] ? (
                  <div className="w-full h-full flex items-center justify-center bg-surface-container-highest">
                    <span className="material-symbols-outlined text-[40px] text-on-surface-variant">broken_image</span>
                  </div>
                ) : (
                  <img
                    alt="Ultra-luxury architectural living room with floor-to-ceiling glass, polished warm stone large format porcelain tile flooring, contemporary minimal Italian furniture, warm diffused sunlight"
                    className="w-full h-full object-cover"
                    src={conceptImages[1] ?? FALLBACK_IMAGES[1]}
                    onError={() => handleImageError(1)}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 via-transparent to-transparent"></div>
                {/* Surface Specification Tag */}
                <div className="absolute top-space-md left-space-md bg-surface-container-lowest/85 backdrop-blur-md px-space-sm py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface">Concept 02</span>
                </div>
                <button
                  aria-label="Pin finish selection"
                  className="absolute top-space-md right-space-md w-9 h-9 rounded-full bg-surface-container-lowest/80 backdrop-blur-md flex items-center justify-center text-on-surface active:text-primary transition-colors"
                  type="button"
                  onClick={handlePin}
                >
                  <span className="material-symbols-outlined text-[18px]">bookmark</span>
                </button>
                {/* In-view specs pill anchored over lower image bounds */}
                <div className="absolute bottom-space-md left-space-md right-space-md flex items-center justify-between">
                  <div className="bg-surface-container/90 backdrop-blur-md px-space-sm py-1 rounded-full">
                    <span className="font-body-sm text-body-sm text-primary">Continuous Vein Match</span>
                  </div>
                  <span className="font-spec-numeral text-body-sm text-on-surface/80 bg-surface-container-lowest/80 backdrop-blur-md px-2 py-0.5 rounded">R11 • Wet Grip</span>
                </div>
              </div>
              {/* Card Metadata & Consultation Notes */}
              <div className="p-space-md flex flex-col gap-space-xs bg-surface-container">
                <div className="flex items-center justify-between">
                  <h2 className="font-title-md text-title-md text-on-surface">
                    Spa Walk-in & Wet Room
                  </h2>
                  <span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">Plan B</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Curated travertine-inflected vein continuity traveling from dry threshold into linear-drain wet room envelope.
                </p>
              </div>
            </article>
            {/* Concept 03 Card */}
            <article className="bg-surface-container rounded-xl overflow-hidden shadow-lg flex flex-col transition-all">
              {/* Image Container */}
              <div className="relative w-full aspect-[4/3] bg-surface-container-highest overflow-hidden">
                {failedImages[2] ? (
                  <div className="w-full h-full flex items-center justify-center bg-surface-container-highest">
                    <span className="material-symbols-outlined text-[40px] text-on-surface-variant">broken_image</span>
                  </div>
                ) : (
                  <img
                    alt="Editorial architectural photography of a luxury modern kitchen with large format warm porcelain floor tiles, minimalist monolithic marble kitchen island, matte black hardware, warm daylight"
                    className="w-full h-full object-cover"
                    src={conceptImages[2] ?? FALLBACK_IMAGES[2]}
                    onError={() => handleImageError(2)}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 via-transparent to-transparent"></div>
                {/* Surface Specification Tag */}
                <div className="absolute top-space-md left-space-md bg-surface-container-lowest/85 backdrop-blur-md px-space-sm py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface">Concept 03</span>
                </div>
                <button
                  aria-label="Pin finish selection"
                  className="absolute top-space-md right-space-md w-9 h-9 rounded-full bg-surface-container-lowest/80 backdrop-blur-md flex items-center justify-center text-on-surface active:text-primary transition-colors"
                  type="button"
                  onClick={handlePin}
                >
                  <span className="material-symbols-outlined text-[18px]">bookmark</span>
                </button>
                {/* In-view specs pill anchored over lower image bounds */}
                <div className="absolute bottom-space-md left-space-md right-space-md flex items-center justify-between">
                  <div className="bg-surface-container/90 backdrop-blur-md px-space-sm py-1 rounded-full">
                    <span className="font-body-sm text-body-sm text-primary">Natural Raking Light</span>
                  </div>
                  <span className="font-spec-numeral text-body-sm text-on-surface/80 bg-surface-container-lowest/80 backdrop-blur-md px-2 py-0.5 rounded">Low Luster</span>
                </div>
              </div>
              {/* Card Metadata & Consultation Notes */}
              <div className="p-space-md flex flex-col gap-space-xs bg-surface-container">
                <div className="flex items-center justify-between">
                  <h2 className="font-title-md text-title-md text-on-surface">
                    Daylight Perspective
                  </h2>
                  <span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">Plan C</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Low-angle solar exposure highlights surface micro-relief and calibrated satin mineral aggregates under direct south-facing glazing.
                </p>
              </div>
            </article>
            {/* Advisory Consultation Summary Footnote */}
            <div className="bg-surface-container-low rounded-xl p-space-md flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary flex-shrink-0">
                <span className="material-symbols-outlined text-[20px]">architecture</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-caps text-label-caps uppercase text-primary tracking-wider">Architectural Advisory</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  All concepts rendered with zero-radius rectified porcelain edge profiles.
                </p>
              </div>
            </div>
          </main>
          {/* Fixed Sticky Showroom Consultation Dock */}
          <aside className="fixed bottom-3 inset-x-0 z-40 px-margin pointer-events-none">
            <div className="max-w-md mx-auto pointer-events-auto bg-surface-container/95 backdrop-blur-2xl rounded-full shadow-[0_16px_40px_-8px_rgba(0,0,0,0.75)] p-2 flex items-center gap-2">
              {/* Regenerate Action */}
              <button
                className="flex-1 h-[52px] bg-surface-container-high active:bg-surface-bright text-on-surface font-title-md text-title-md rounded-full flex items-center justify-center gap-1.5 transition-colors"
                id="regenerateBtn"
                type="button"
                onClick={handleRegenerate}
              >
                <span className="material-symbols-outlined text-[18px] text-primary">autorenew</span>
                <span>Regenerate</span>
              </button>
              {/* Primary Start New CTA */}
              <button
                className="flex-1 h-[52px] bg-primary active:bg-primary-container text-on-primary font-title-md text-title-md rounded-full flex items-center justify-center gap-1.5 transition-colors shadow-[0_0_16px_rgba(197,168,128,0.22)]"
                id="startNewBtn"
                type="button"
                onClick={handleStartNew}
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Start New</span>
              </button>
              {/* Download Folio / PDF Quick Trigger */}
              <button
                aria-label="Download Architectural PDF Spec Folio"
                className="w-[52px] h-[52px] rounded-full bg-surface-container-high active:bg-surface-bright text-primary flex items-center justify-center transition-colors flex-shrink-0"
                id="downloadPdfBtn"
                type="button"
                onClick={handleDownload}
              >
                <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default Results
