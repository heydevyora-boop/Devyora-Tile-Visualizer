import { useNavigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import './Space.css'

function Space() {
  const navigate = useNavigate()
  const { space, setSpace } = useFlow()
  const handleReturn = () => {
    navigate('/tile-size')
  }
  const handleSelectSpace = (value: string) => {
    setSpace(value)
  }
  const handleContinue = () => {
    navigate('/style')
  }

  return (
    <div className="space-page bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
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
        <div className="flex flex-col w-full">
          <div className="px-margin pt-space-md pb-space-xs flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
                DEVYORA ARCHITECTURAL
              </span>
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 rounded-full shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
                Step 04 / 06
              </span>
            </div>
          </div>
          <div className="px-margin pt-space-xs pb-space-md">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-wide">
              Where would you like to use this tile?
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Select the architectural environment to visualize.
            </p>
          </div>
          <div className="px-margin grid grid-cols-2 gap-space-sm pb-32" id="spaceSelectorGrid">
            <div
              className={`space-card relative flex flex-col rounded-xl overflow-hidden bg-surface-container-high cursor-pointer shadow-md transition-all duration-300 transform active:scale-[0.98]${space === 'Bathroom' ? ' selected' : ''}`}
              onClick={() => handleSelectSpace('Bathroom')}
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-lowest">
                <img
                  alt="Bathroom architectural space"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDP5oA3AvnTsObA-oOr4trg44RxFMMyW1m2E5Wj_q9lD8zAQpMucUrLBk1i1LS3-0QMe5H1M9vIcaNV7UZer4PYV8q16dhpMVMIWdKyqidxgMR1C40tcJKfupQba_dFnRvQyL9_ZbtHz2N5OfsvGA__l8k4ov_w-LRcpxFLSl06yQWvUZ1yQZy9E1HM8OdDMZC1QbbLRXfpckIN3-C89gipLFBzNYdi0iCqSJYptKIrO6cqG7S7utJooQ"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent"></div>
                <div className="selection-badge hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-primary items-center justify-center shadow-lg transition-transform duration-200">
                  <span
                    className="material-symbols-outlined text-on-primary text-[16px] font-bold"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              </div>
              <div className="selection-indicator hidden absolute inset-0 rounded-xl pointer-events-none bg-primary/10 shadow-[inset_0_0_0_2px_#e2c399]"></div>
              <div className="p-space-sm bg-surface-container-high flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-wide">Bathroom</span>
                <span className="selection-dot hidden w-2 h-2 rounded-full bg-primary"></span>
              </div>
            </div>
            <div
              className={`space-card relative flex flex-col rounded-xl overflow-hidden bg-surface-container-high cursor-pointer shadow-md transition-all duration-300 transform active:scale-[0.98]${space === 'Living Room' ? ' selected' : ''}`}
              onClick={() => handleSelectSpace('Living Room')}
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-lowest">
                <img
                  alt="Living Room architectural space"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDEpIiiTMWE3tlqPgacanwBWvrlqlG6yioPf75-SOnp0uAf0O8cNzvnaO_1Toqhj7hHHiF4gXu-W-auEGwIJhM3ydoh1__OhYTjgizqJbYzmWcaw58wxITXm3jtZm2xfURG3ahEkSWTZwMrVpu5B8Ft2kEWlOyzU1xcW1nX_jbw5v1u64B9pkwoNH9O9GHqfq7KmbLVw6SzRU8Bzq5bc-NRnbM7FdIOtlDbEmwzzkNrZH9AZqqF7uIg3w"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent"></div>
                <div className="selection-badge hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-primary items-center justify-center shadow-lg transition-transform duration-200">
                  <span
                    className="material-symbols-outlined text-on-primary text-[16px] font-bold"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              </div>
              <div className="selection-indicator hidden absolute inset-0 rounded-xl pointer-events-none bg-primary/10 shadow-[inset_0_0_0_2px_#e2c399]"></div>
              <div className="p-space-sm bg-surface-container-high flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-wide">Living Room</span>
                <span className="selection-dot hidden w-2 h-2 rounded-full bg-primary"></span>
              </div>
            </div>
            <div
              className={`space-card relative flex flex-col rounded-xl overflow-hidden bg-surface-container-high cursor-pointer shadow-md transition-all duration-300 transform active:scale-[0.98]${space === 'Kitchen' ? ' selected' : ''}`}
              onClick={() => handleSelectSpace('Kitchen')}
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-lowest">
                <img
                  alt="Kitchen architectural space"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB00wtIuZZffbITcFtmcFsbTCdn_bhuz-jF0VLOqT77jqOnOpV6LFOH6AloZZVAl4HlC-YeZDpywkX1PQcE2T87vfmpgcqLRM8kDsl3ovTJTN6hP4TutpbLN9O6lgXofAVjw4LXYm9Ouaa2Ba_sZ7T6-OE78YIB-N5kIqjI6sx8tWWEMEmHTtt7znsHib_w4XqSX3C1i2uJ3NlEssWvq3EoaxkyeIxr5WV_KUfgHVSkiyzXdhryU5hFNA"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent"></div>
                <div className="selection-badge hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-primary items-center justify-center shadow-lg transition-transform duration-200">
                  <span
                    className="material-symbols-outlined text-on-primary text-[16px] font-bold"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              </div>
              <div className="selection-indicator hidden absolute inset-0 rounded-xl pointer-events-none bg-primary/10 shadow-[inset_0_0_0_2px_#e2c399]"></div>
              <div className="p-space-sm bg-surface-container-high flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-wide">Kitchen</span>
                <span className="selection-dot hidden w-2 h-2 rounded-full bg-primary"></span>
              </div>
            </div>
            <div
              className={`space-card relative flex flex-col rounded-xl overflow-hidden bg-surface-container-high cursor-pointer shadow-md transition-all duration-300 transform active:scale-[0.98]${space === 'Terrace' ? ' selected' : ''}`}
              onClick={() => handleSelectSpace('Terrace')}
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-lowest">
                <img
                  alt="Terrace architectural space"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAtMjsDOhZ0uLWpGMXtxpWM_Q3U2SBcJy0IQor5310F-NPPKNZ-6d9kHLvg78lKrmhbFWkXpV-PkU1tXNmarWPG4e904fJKF66MrwZjSYmOqCVnHxBT9fH3-EDlQbxt6Ky8e7WMZAXF3VGKCaRnFLrSgjW8XPD_hkTYAzMfZGWmY4vj9JJMMl_gwJhDjZ74SSzr7w6X--u8IOr7-cC30K1N8b8Qh-nWtrmW4MuPHM5DGhFv1qdwllo7FQ"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent"></div>
                <div className="selection-badge hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-primary items-center justify-center shadow-lg transition-transform duration-200">
                  <span
                    className="material-symbols-outlined text-on-primary text-[16px] font-bold"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              </div>
              <div className="selection-indicator hidden absolute inset-0 rounded-xl pointer-events-none bg-primary/10 shadow-[inset_0_0_0_2px_#e2c399]"></div>
              <div className="p-space-sm bg-surface-container-high flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-wide">Terrace</span>
                <span className="selection-dot hidden w-2 h-2 rounded-full bg-primary"></span>
              </div>
            </div>
            <div
              className={`space-card relative flex flex-col rounded-xl overflow-hidden bg-surface-container-high cursor-pointer shadow-md transition-all duration-300 transform active:scale-[0.98]${space === 'Bedroom' ? ' selected' : ''}`}
              onClick={() => handleSelectSpace('Bedroom')}
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  data-alt="Minimalist modern bedroom interior with wide format textured stone floor tiles, low platform timber bed, warm linear recessed lighting, and soft neutral linen textures in architectural luxury residence."
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuASzL7Q5ti4ELe4-ViXrl_06vxDl5vx6-oW3F7cQvLfZ43arsRYzUHJvPxkt2pcBnsnftDPK3hNhhZQMS4ec27IItqPxhxI5OY7XlX4E-IYgLJYH4Lg3uCWCdsdr04hzMYl5bGyQJ7o25ExxhD4uLs4BHOMhiMttrT9WgOu9xIxCWWENNolQJJDs-NYQAhFWt8eNslmD6iQSrTjQj3Ucnt_DK6lyxrFlNuguQXea8a9eFqNMRNvjkqd0w"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent"></div>
                <div className="selection-badge hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-primary items-center justify-center shadow-lg transition-transform duration-200">
                  <span
                    className="material-symbols-outlined text-on-primary text-[16px] font-bold"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              </div>
              <div className="selection-indicator hidden absolute inset-0 rounded-xl pointer-events-none bg-primary/10 shadow-[inset_0_0_0_2px_#e2c399]"></div>
              <div className="p-space-sm bg-surface-container-high flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-wide">Bedroom</span>
                <span className="selection-dot hidden w-2 h-2 rounded-full bg-primary"></span>
              </div>
            </div>
            <div
              className={`space-card relative flex flex-col rounded-xl overflow-hidden bg-surface-container-high cursor-pointer shadow-md transition-all duration-300 transform active:scale-[0.98]${space === 'Balcony' ? ' selected' : ''}`}
              onClick={() => handleSelectSpace('Balcony')}
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  data-alt="Sophisticated urban balcony with seamless outdoor porcelain pavers, glass guardrail overlooking city skyline at golden dusk hour, warm bronze architectural trim, and subtle floor uplighting."
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC25p5dYHCUJpvOHhOS-wUARau6fJrXC09sUlL51QLIZ24Fmx-JVA3CAnEZJCkOxewN2MF9w3r2BYj5RLPWkn2mTp9632zrdEI_2XDaN0HfwZqj1n7hJIEpOOS8nVQXW9HbbGtJK7Z3Xj8ric93lt_cfifzga6fNZyFXAJkEfYa8DwQHZRGzkxpKk7YqaAOm6WtWj8xT4MMqQ699qH_OjnhxaixMpNBaxAcdWu6n5MNJhiKmeAuZc8Uzw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent"></div>
                <div className="selection-badge hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-primary items-center justify-center shadow-lg transition-transform duration-200">
                  <span
                    className="material-symbols-outlined text-on-primary text-[16px] font-bold"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              </div>
              <div className="selection-indicator hidden absolute inset-0 rounded-xl pointer-events-none bg-primary/10 shadow-[inset_0_0_0_2px_#e2c399]"></div>
              <div className="p-space-sm bg-surface-container-high flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-wide">Balcony</span>
                <span className="selection-dot hidden w-2 h-2 rounded-full bg-primary"></span>
              </div>
            </div>
            <div
              className={`space-card relative flex flex-col rounded-xl overflow-hidden bg-surface-container-high cursor-pointer shadow-md transition-all duration-300 transform active:scale-[0.98]${space === 'Parking' ? ' selected' : ''}`}
              onClick={() => handleSelectSpace('Parking')}
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  data-alt="High-end private villa underground garage showroom with heavy duty honed dark sintered stone floor tiles, sleek LED ceiling channel lights, and luxury sports cars parked in pristine gallery setting."
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDtIlbj5sJMTysDoom5akD4coy5DizJw60Wh5ScywzPACAI9yHn_Wu6sclDof5kMhHX2ftMEsftvEPSPHDYuwMCIRiAaG9enzk-D1ZPni6dHREQL-6gn1GdfIItMxIOoagclG1gLJa3_TPtg0ftAZaunLjcSm_a40AnWjWPFSiiCpzigkHI_qzoN7NaoZXhFB942zfiIHRoUvB3pwlEgtG43pcRveCg8YLgfPmBgXWLr1oKt3TmGt9NEg"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent"></div>
                <div className="selection-badge hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-primary items-center justify-center shadow-lg transition-transform duration-200">
                  <span
                    className="material-symbols-outlined text-on-primary text-[16px] font-bold"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              </div>
              <div className="selection-indicator hidden absolute inset-0 rounded-xl pointer-events-none bg-primary/10 shadow-[inset_0_0_0_2px_#e2c399]"></div>
              <div className="p-space-sm bg-surface-container-high flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-wide">Parking</span>
                <span className="selection-dot hidden w-2 h-2 rounded-full bg-primary"></span>
              </div>
            </div>
            <div
              className={`space-card relative flex flex-col rounded-xl overflow-hidden bg-surface-container-high cursor-pointer shadow-md transition-all duration-300 transform active:scale-[0.98]${space === 'Staircase' ? ' selected' : ''}`}
              onClick={() => handleSelectSpace('Staircase')}
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  data-alt="Architectural monolithic cantilevered floating staircase clad in travertine stone tiles with under-tread concealed warm lighting, smooth concrete walls, and clean contemporary museum aesthetic."
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDdUyxeUex-fmNkLbzD7qOf5JQi04vlepZQ-7cSGQbdJ5dkwxq5i6sygCx56q6YhfpiQ45d-q7gnmmHFmA-oUysCB_pfTj_aXoFcn25d-bb2rE_-qXcQvGga9ajB8GQZRLy7OfLTIyHR9XIWa2TZKzQg_-cCcs4DibKaeHVEWUDA_ukT2zvzOOdMpbGHQPn1sm72Wh0-oeEG9gQSDSW3dFd2KXcckv9wyo3xM4GlbXUCQVOIy2RNpA_xg"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent"></div>
                <div className="selection-badge hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-primary items-center justify-center shadow-lg transition-transform duration-200">
                  <span
                    className="material-symbols-outlined text-on-primary text-[16px] font-bold"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              </div>
              <div className="selection-indicator hidden absolute inset-0 rounded-xl pointer-events-none bg-primary/10 shadow-[inset_0_0_0_2px_#e2c399]"></div>
              <div className="p-space-sm bg-surface-container-high flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-wide">Staircase</span>
                <span className="selection-dot hidden w-2 h-2 rounded-full bg-primary"></span>
              </div>
            </div>
            <div
              className={`space-card relative flex flex-col rounded-xl overflow-hidden bg-surface-container-high cursor-pointer shadow-md transition-all duration-300 transform active:scale-[0.98]${space === 'Entrance' ? ' selected' : ''}`}
              onClick={() => handleSelectSpace('Entrance')}
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  data-alt="Grand residential entry foyer with monumental bookmatched porcelain slab flooring, warm walnut pivoting front door, subtle ambient gallery spotlights, and minimal console sculpture."
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBnqsiHNbx1NllUHe5RemwBOHLOgHgQaUeW1L60G7YRqHuyRdDw1P6XcP5-j2RfYCd_DOvXk3FGLJYp1zmCdcFERIVWlHS2_PqATZXsP6MSMG1eLPLoyAaA2TL90XVu7YIpaLE3A_aa3s4hOyzKbX78pBZUAqNE_Atb1zwsND9FSUVysssVElrnbeeGLD_4Htv-0RVR-YpABmK-JTjpVXc-2cY7Mc78dMe8fbjiE8wepw_RSPEva7hiow"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent"></div>
                <div className="selection-badge hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-primary items-center justify-center shadow-lg transition-transform duration-200">
                  <span
                    className="material-symbols-outlined text-on-primary text-[16px] font-bold"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              </div>
              <div className="selection-indicator hidden absolute inset-0 rounded-xl pointer-events-none bg-primary/10 shadow-[inset_0_0_0_2px_#e2c399]"></div>
              <div className="p-space-sm bg-surface-container-high flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-wide">Entrance</span>
                <span className="selection-dot hidden w-2 h-2 rounded-full bg-primary"></span>
              </div>
            </div>
            <div
              className={`space-card relative flex flex-col rounded-xl overflow-hidden bg-surface-container-high cursor-pointer shadow-md transition-all duration-300 transform active:scale-[0.98]${space === 'Facade' ? ' selected' : ''}`}
              onClick={() => handleSelectSpace('Facade')}
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container-lowest">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  data-alt="Modern architectural exterior building facade clad in matte textured porcelain ventilated panels with warm charcoal and beige undertones, precise reveals, and evening exterior wash lighting."
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAamkbeH_oO13a62IbxZVljHVUismIcuGJubDr9xdphVTIJpKVO9m-JP0h7gJ_idJSyNgAeXmNVlOdNYAiJCjcuDTeRAyVwbq_dA4oozsiOb2VCr8QBb1m4ChieBKJ08HT6018iG8Au3kc9l-FHO8fdeqZ6lw4xtWfV8bBKV6rN6PLydg1pML9RjdVMgbHATNRSup7pQhHqAOm5Fri4skOYJO6oy2ZBV0zivFNLyPZIAAu0yn7M-WOeDw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent"></div>
                <div className="selection-badge hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-primary items-center justify-center shadow-lg transition-transform duration-200">
                  <span
                    className="material-symbols-outlined text-on-primary text-[16px] font-bold"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              </div>
              <div className="selection-indicator hidden absolute inset-0 rounded-xl pointer-events-none bg-primary/10 shadow-[inset_0_0_0_2px_#e2c399]"></div>
              <div className="p-space-sm bg-surface-container-high flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-wide">Facade</span>
                <span className="selection-dot hidden w-2 h-2 rounded-full bg-primary"></span>
              </div>
            </div>
          </div>
          <div className="fixed bottom-0 inset-x-0 z-40 px-margin pb-safe bg-gradient-to-t from-surface via-surface/95 to-transparent pt-6 pointer-events-none">
            <div className="w-full max-w-[480px] mx-auto pb-4 pointer-events-auto">
              <div className="flex items-center justify-between px-space-xs pb-space-xs text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
                <span>Selected Canvas</span>
                <span className="text-primary font-body-md font-semibold" id="activeSpaceLabel">
                  {space ?? 'None'}
                </span>
              </div>
              <button
                className="w-full h-[54px] rounded-lg bg-primary text-on-primary font-title-md text-title-md tracking-wider uppercase flex items-center justify-center gap-space-sm shadow-[0_4px_24px_rgba(197,168,128,0.3)] hover:brightness-105 active:scale-[0.99] transition-all"
                id="continueCta"
                type="button"
                onClick={handleContinue}
              >
                <span>Continue</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Space
