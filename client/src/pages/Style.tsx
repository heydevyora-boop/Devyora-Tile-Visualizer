import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import './Style.css'

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

function Style() {
  const navigate = useNavigate()
  const { style, setStyle } = useFlow()
  const handleReturn = () => {
    navigate('/space')
  }
  const handleSelectStyle = (value: string) => {
    setStyle(value)
  }
  const handleReview = () => {
    navigate('/summary')
  }

  return (
    <div className="style-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
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
        <div className="flex flex-col w-full px-margin pb-32">
          {/* Progress Tracker & Step Navigation */}
          <div className="flex items-center justify-between py-space-sm">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">Phase</span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Atmosphere</span>
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 rounded-full shadow-sm">
              <span className="font-spec-numeral text-spec-numeral text-primary">05</span>
              <span className="font-label-caps text-label-caps text-outline uppercase">/</span>
              <span className="font-spec-numeral text-spec-numeral text-outline">06</span>
            </div>
          </div>
          {/* Header Block */}
          <div className="flex flex-col mt-space-sm mb-space-lg">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-wide uppercase">Choose a design style</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Define the aesthetic mood and interior language.</p>
          </div>
          {/* Style Curations Grid */}
          <div aria-label="Interior Design Styles" className="grid grid-cols-2 gap-space-sm" id="style-grid" role="radiogroup">
            {/* 1. Minimal (Default Selected) */}
            <div
              aria-checked={style === 'minimal'}
              className={`style-card relative flex flex-col p-space-sm rounded-xl cursor-pointer transition-all duration-200 bg-surface-container shadow-sm overflow-hidden${style === 'minimal' ? ' selected' : ''}`}
              data-style="minimal"
              onClick={() => handleSelectStyle('minimal')}
              role="radio"
              tabIndex={0}
            >
              <div className="style-indicator absolute top-2 right-2 w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center opacity-0 transition-opacity">
                <span className="material-symbols-outlined text-[14px] text-on-surface font-bold">check</span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden mb-space-sm relative bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover"
                  data-alt="Architectural minimal interior showcase in Tokyo apartment, ultra-clean microcement surfaces, soft monolithic travertine block, neutral charcoal stone shadows, warm linear light wash, devyora aesthetic luxury design"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDtDIiWZiTr-fDoTSJt8b2wal_LjhTVhDvxp7-NIWfaUrsZ6OfX_QOQ82BUYgFKxw6vtnrkFMadGA1kAyIXJPJNyb_o2Ns0-Yhn8RkzToQJKcTgQDgAW4re4NXD-83_B_S8lyrv8JRShxMShkeDax_9ysLeJsqGtTakBDBkcW-qg7lvONBA3I6VgqFgxf5UcYmBnql99sOL7pf8RzMwARRfcp6sDR0jy9ff7tQzy6SWvYKw_1a57yFgSw"
                />
              </div>
              <div className="flex flex-col">
                <span className="style-title font-headline-sm text-headline-sm uppercase text-on-surface">Minimal</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">Monolithic silence & stone</span>
              </div>
            </div>
            {/* 2. Modern */}
            <div
              aria-checked={style === 'modern'}
              className={`style-card relative flex flex-col p-space-sm rounded-xl cursor-pointer transition-all duration-200 bg-surface-container shadow-sm overflow-hidden${style === 'modern' ? ' selected' : ''}`}
              data-style="modern"
              onClick={() => handleSelectStyle('modern')}
              role="radio"
              tabIndex={0}
            >
              <div className="style-indicator absolute top-2 right-2 w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center opacity-0 transition-opacity">
                <span className="material-symbols-outlined text-[14px] text-on-surface font-bold">check</span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden mb-space-sm relative bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover"
                  data-alt="Sleek modern luxury interior architecture, fluted dark walnut wood paneling, black honed granite waterfall slab, floor-to-ceiling glass, architectural dimming lighting, moody charcoal ambience"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAS-l-Ygc79TDOWHdimCWNqx7SsH3IlBOSCd2bkkT_k3ql2yDiDw9TA6YObbeb3jtwWQ6cKs-wfiY8cUSVT9MfsVctguYpGF-fuEVPZEZvv3qfK2QXlkTsqggwnwGWGR_Y-Fp03Ucbk-dk6YrD-YgktRLE5Oo_LpPmX1UP-_BWpPGD_c96ctCW44PcRnRmj11ErHQxW-x9f3Tl6bCclGpgWkaf_wNAApsCe_GUBA391Y4Lry9R8l2C5TQ"
                />
              </div>
              <div className="flex flex-col">
                <span className="style-title font-headline-sm text-headline-sm uppercase text-on-surface">Modern</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">Crisp geometry & steel</span>
              </div>
            </div>
            {/* 3. Luxury */}
            <div
              aria-checked={style === 'luxury'}
              className={`style-card relative flex flex-col p-space-sm rounded-xl cursor-pointer transition-all duration-200 bg-surface-container shadow-sm overflow-hidden${style === 'luxury' ? ' selected' : ''}`}
              data-style="luxury"
              onClick={() => handleSelectStyle('luxury')}
              role="radio"
              tabIndex={0}
            >
              <div className="style-indicator absolute top-2 right-2 w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center opacity-0 transition-opacity">
                <span className="material-symbols-outlined text-[14px] text-on-surface font-bold">check</span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden mb-space-sm relative bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover"
                  data-alt="High-end penthouse grand salon with bookmatched Calacatta marble walls, polished dark bronze hardware accents, soft warm diffused ambient light, bespoke tailored architectural staging"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuArILIyxWf58P0HAU1H5WVBq_1Y-sBz6_hQQHreCkwFlQPSrxSZdrNcxAXwX5xn4L8XKJ2Izi0OgA0oOI_fFvZiTuClFXQLpRE0FE2ziT2AJKadUlyXmdrbuS1EjyUA8nHiYXmzFNZGzp0Jmf3OpORayGwmBohgtcrEayl1bV1wXgrPiy8XPCZ3DTJPOUUY7a-Yx2z4OuGTZQecyKGG4YjJ9tyvggSlkjiFMUC7bWQx7p6yUXWzqaAoqw"
                />
              </div>
              <div className="flex flex-col">
                <span className="style-title font-headline-sm text-headline-sm uppercase text-on-surface">Luxury</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">Rich bookmatched veining</span>
              </div>
            </div>
            {/* 4. Warm */}
            <div
              aria-checked={style === 'warm'}
              className={`style-card relative flex flex-col p-space-sm rounded-xl cursor-pointer transition-all duration-200 bg-surface-container shadow-sm overflow-hidden${style === 'warm' ? ' selected' : ''}`}
              data-style="warm"
              onClick={() => handleSelectStyle('warm')}
              role="radio"
              tabIndex={0}
            >
              <div className="style-indicator absolute top-2 right-2 w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center opacity-0 transition-opacity">
                <span className="material-symbols-outlined text-[14px] text-on-surface font-bold">check</span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden mb-space-sm relative bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover"
                  data-alt="Cozy tactile Scandinavian and Japandi interior salon, light oak timber slats, sandblasted limestone hearth, warm amber glowing cove lights, linen and textured clay plaster details"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAlG8Ck3JVdzPZ-_jpCR-qu7xx6TJgz3umEJZtpwF3uTU6jjtCA3hrMXl0pmDU7A8njc02XUmhsHVgCiDPauoX7nKu-5Y65BJLRjHAef-1SAsCTews8R4labuav6Ky62x-2yrQyftSd0uj_H8ZQ2KM8ecjb7e6RC4dJZfPO8PzDLNpWz_78fSHSHLF9TYrlfayd4CjKhpQNKGXLP7vb6thhE7xtVkfoFmNhqcai4aMlXGwbna0wfG9EUQ"
                />
              </div>
              <div className="flex flex-col">
                <span className="style-title font-headline-sm text-headline-sm uppercase text-on-surface">Warm</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">Sunlit terracotta & timber</span>
              </div>
            </div>
            {/* 5. Contemporary */}
            <div
              aria-checked={style === 'contemporary'}
              className={`style-card relative flex flex-col p-space-sm rounded-xl cursor-pointer transition-all duration-200 bg-surface-container shadow-sm overflow-hidden${style === 'contemporary' ? ' selected' : ''}`}
              data-style="contemporary"
              onClick={() => handleSelectStyle('contemporary')}
              role="radio"
              tabIndex={0}
            >
              <div className="style-indicator absolute top-2 right-2 w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center opacity-0 transition-opacity">
                <span className="material-symbols-outlined text-[14px] text-on-surface font-bold">check</span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden mb-space-sm relative bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover"
                  data-alt="Fluid contemporary gallery architecture, sculptural curved plaster walls, brushed brass framing, large format basaltina tiles, soft architectural shadows and natural light well"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAISgGkGRvbw85qYF4YD4upH43Ay7zNwTalH6BxjgSF2gacq4913UOB5LiD4RcfDiBPyumGrxI91ZmgTNGpC-Sj_HCgdb2NzUm8M5HwFFrE9hHrKstkwAZHAS3JKpd19YXFEx4wLpXAC3ngWqGhIC0CoYAqiyxeLmlU3-wUVVbiaGNTXyG2oSm9-CHtVhlY6WK0gHpO5LJ6TON4JsOesnsGdst6wDztr0FD8OcbZMMmyRqWjJkGxEaycA"
                />
              </div>
              <div className="flex flex-col">
                <span className="style-title font-headline-sm text-headline-sm uppercase text-on-surface">Contemporary</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">Curved forms & fluidity</span>
              </div>
            </div>
            {/* 6. Earthy */}
            <div
              aria-checked={style === 'earthy'}
              className={`style-card relative flex flex-col p-space-sm rounded-xl cursor-pointer transition-all duration-200 bg-surface-container shadow-sm overflow-hidden${style === 'earthy' ? ' selected' : ''}`}
              data-style="earthy"
              onClick={() => handleSelectStyle('earthy')}
              role="radio"
              tabIndex={0}
            >
              <div className="style-indicator absolute top-2 right-2 w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center opacity-0 transition-opacity">
                <span className="material-symbols-outlined text-[14px] text-on-surface font-bold">check</span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden mb-space-sm relative bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover"
                  data-alt="Wabi sabi earthen villa interior, rough split-face slate walls, hand-pressed terracotta floor pavers, deep clay renders, olive greenery, natural low raking light"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCxKEpR4Oh3rsuBXF4woFwnhRmgaiukMoRy3v3Vnt4QWyfJbie2mxQIYd-HHkADUsFxgrOUA_sMkOaEBaIOkB5CHz3HpR2R4QhLGuj0-utunLyDnl-I1cwg_IriWUsq-2VbQJoHKhnLOvLYUa2lcvJKJaJVnAAW-HiFb9p4YqPsABB0su5vsUVyQ9ah_WkOprrTOCXh_IQG7KrQLgnevtcURe2DDj-5gGh-AmZJuBuTKdhrmwKCMD5LpQ"
                />
              </div>
              <div className="flex flex-col">
                <span className="style-title font-headline-sm text-headline-sm uppercase text-on-surface">Earthy</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">Raw slate & fired clay</span>
              </div>
            </div>
            {/* 7. Indian */}
            <div
              aria-checked={style === 'indian'}
              className={`style-card relative flex flex-col p-space-sm rounded-xl cursor-pointer transition-all duration-200 bg-surface-container shadow-sm overflow-hidden${style === 'indian' ? ' selected' : ''}`}
              data-style="indian"
              onClick={() => handleSelectStyle('indian')}
              role="radio"
              tabIndex={0}
            >
              <div className="style-indicator absolute top-2 right-2 w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center opacity-0 transition-opacity">
                <span className="material-symbols-outlined text-[14px] text-on-surface font-bold">check</span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden mb-space-sm relative bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover"
                  data-alt="Modern Indian haveli inspired spatial design, hand-carved Jodhpur sandstone fretwork, deep heritage teak pillars, brushed copper water feature, moody atmospheric interior"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuASh35O2QMRdqb8IQdkDMxC_cS2VVqG7n5GKOw3gMR_BnPigHGLktzqIbrb7mTS94YlsOdvO7DJOp4MWyroCwu7TFu6x8Q1820GCm7LYigygbi3tGKLXSuv5f-TzIezmpDbCLPs-NrHPkKRuf1LNR8dFXTfD0b42hkY9cfYms2f0s5Qtl9t3uw9oCq5KPmv-g3BZpgrU2Qk0yM1xTdRhIQBRWQEhXlAlRYk0l7swSv2Hqjhfb0UgQPGpw"
                />
              </div>
              <div className="flex flex-col">
                <span className="style-title font-headline-sm text-headline-sm uppercase text-on-surface">Indian</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">Sandstone jaali & brass</span>
              </div>
            </div>
            {/* 8. Elegant */}
            <div
              aria-checked={style === 'elegant'}
              className={`style-card relative flex flex-col p-space-sm rounded-xl cursor-pointer transition-all duration-200 bg-surface-container shadow-sm overflow-hidden${style === 'elegant' ? ' selected' : ''}`}
              data-style="elegant"
              onClick={() => handleSelectStyle('elegant')}
              role="radio"
              tabIndex={0}
            >
              <div className="style-indicator absolute top-2 right-2 w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center opacity-0 transition-opacity">
                <span className="material-symbols-outlined text-[14px] text-on-surface font-bold">check</span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden mb-space-sm relative bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover"
                  data-alt="Refined neoclassical Parisian flat renovation, delicate boiserie wall moldings, herringbone parquet flooring, honed Statuario marble fireplace, diffused daylight"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDf34uZjwt9jJ1FFjrTOAnCfu3FpmtEhKXsLGTRey_2ov4_XcYw8XW6d_H84g-DuAe63qIEGke_lYBXcH51GVAaoBAZr4DCidUanvBfa_t6NoX-q1hqbgEx8J9i9a37GitafHsn1YAiN_u0jnBGbXASHd7WCzyQBjh_AkhanMdiVQsK7tRTCMpHmaK1aMN8xqoRaZzHnpcHGv2GZJCKQcmBcQmfgzXZ50YIi5CjdGeaPQoMGtIaQDkJ_Q"
                />
              </div>
              <div className="flex flex-col">
                <span className="style-title font-headline-sm text-headline-sm uppercase text-on-surface">Elegant</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">Quiet symmetry & poise</span>
              </div>
            </div>
          </div>
          {/* 9. Surprise Me Feature Pill */}
          <div className="mt-space-sm w-full">
            <div
              aria-checked={style === 'surprise'}
              className={`style-card relative flex items-center justify-between p-space-md rounded-xl cursor-pointer transition-all duration-200 bg-surface-container shadow-sm${style === 'surprise' ? ' selected' : ''}`}
              data-style="surprise"
              onClick={() => handleSelectStyle('surprise')}
              role="radio"
              tabIndex={0}
            >
              <div className="flex items-center gap-space-md">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                </div>
                <div className="flex flex-col">
                  <span className="style-title font-headline-sm text-headline-sm uppercase text-on-surface">Surprise Me</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Let Devyora compose an eclectic tactile fusion</span>
                </div>
              </div>
              <div className="style-indicator w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center opacity-0 transition-opacity">
                <span className="material-symbols-outlined text-[14px] text-on-surface font-bold">check</span>
              </div>
            </div>
          </div>
          {/* Spatial Room Spec Confirmation Summary */}
          <div className="mt-space-md p-space-md bg-surface-container-low rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-outline text-[20px]">layers</span>
              <div className="flex flex-col">
                <span className="font-label-caps text-label-caps uppercase text-outline">Selected Atmosphere</span>
                <span className="font-title-md text-title-md text-primary tracking-wide" id="active-style-label">
                  {style ? STYLE_LABELS[style] ?? style : 'None'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-xs text-on-surface-variant">
              <span className="font-label-caps text-label-caps uppercase tracking-wider">Surface Specs Locked</span>
              <span className="material-symbols-outlined text-primary text-[16px]">lock</span>
            </div>
          </div>
          {/* Fixed Showroom Floor Action Dock */}
          <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-xl px-margin py-space-sm shadow-[0_-8px_24px_rgba(0,0,0,0.5)]">
            <div className="max-w-md mx-auto w-full">
              <button
                className="w-full h-14 bg-primary text-on-primary font-title-md text-title-md uppercase tracking-wider rounded flex items-center justify-center gap-space-sm shadow-[0_4px_20px_rgba(197,168,128,0.22)] active:scale-[0.99] transition-transform"
                id="review-generate-btn"
                type="button"
                onClick={handleReview}
              >
                <span>Review & Generate</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Style
