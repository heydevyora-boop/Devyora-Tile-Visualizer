import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import HeaderUserMenu from './HeaderUserMenu'
import { haptic } from '../utils/haptic'
import '../pages/DesignStep.css'

type FlowStepProps = {
  /** Centre of the header, e.g. "Joint". */
  title: string
  /** "Step 05 / 08". */
  step: string
  /** Where Back goes — the step before this one. */
  backTo: string
  heading: string
  lede: string
  children: ReactNode
  /** Where Continue goes. */
  continueTo: string
  /** When false, Continue is disabled. Steps that are optional pass true. */
  canContinue: boolean
  /** Shown above Continue while it is disabled, so a stalled screen says why. */
  blockedReason?: string
}

/**
 * The frame every step of the consultation after the tile screens shares: the
 * header, the way back, the step counter, the heading and the fixed Continue
 * bar. One copy, so a change to how the flow looks is made once.
 */
function FlowStep({
  title,
  step,
  backTo,
  heading,
  lede,
  children,
  continueTo,
  canContinue,
  blockedReason,
}: FlowStepProps) {
  const navigate = useNavigate()
  return (
    <div className="design-step-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_12px_rgba(0,0,0,0.45)]">
        <div className="h-16 px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              aria-label="Return"
              className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors focus:outline-none"
              onClick={() => navigate(backTo)}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
            </button>
            <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">DEVYORA</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-headline-sm text-headline-sm uppercase text-on-surface">{title}</span>
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
              onClick={() => navigate(backTo)}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">west</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider">Back</span>
            </button>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-medium">
                {step}
              </span>
            </div>
          </div>

          <div className="px-margin pt-space-xs pb-space-md flex flex-col gap-1.5">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">
              {heading}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">{lede}</p>
          </div>

          {children}

          <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-lg pb-safe">
            <div className="max-w-md mx-auto px-margin pt-space-sm pb-space-md flex flex-col gap-space-xs">
              {!canContinue && blockedReason ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant text-center">{blockedReason}</p>
              ) : null}
              <button
                className="w-full h-[52px] bg-primary text-on-primary hover:bg-primary-fixed-dim active:scale-[0.99] rounded-lg font-title-md text-title-md tracking-wider uppercase flex items-center justify-center gap-space-xs transition-all shadow-[0_8px_24px_rgba(197,168,128,0.22)] disabled:opacity-60"
                id="continue-btn"
                type="button"
                disabled={!canContinue}
                onClick={() => {
                  haptic()
                  navigate(continueTo)
                }}
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

export default FlowStep
