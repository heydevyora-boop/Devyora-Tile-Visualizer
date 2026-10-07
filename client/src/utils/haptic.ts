/**
 * A short tactile tick for every tap on something pressable — buttons, links,
 * options, tabs, toggles — across the whole app (see installGlobalHaptics).
 *
 * It runs inside the tap's own click event, before the page's handler
 * navigates or fetches: browsers only allow haptics during the user's tap.
 *
 * - Android (Chrome, Samsung Internet, …) has the Vibration API. One 35ms
 *   pulse: anything much shorter is below what many phone motors can spin up
 *   to, so it is simply not felt (the previous 10ms was exactly that).
 * - iOS Safari has no Vibration API at all. The only tactile response a web
 *   page can get there is the system tick iOS 18+ plays when a native switch
 *   control (<input type="checkbox" switch>) is toggled, so a fresh, unrendered
 *   one is toggled through its label and removed again. On iOS 17 and older,
 *   or with System Haptics turned off, iOS gives nothing and nothing happens.
 * - Anything else: nothing happens, and the tap carries on as normal.
 */
const PULSE_MS = 35

function isAppleTouchDevice(): boolean {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; touch points tell them apart.
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function iosSwitchTick(): void {
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  // The global listener must not answer this click with another tick.
  label.setAttribute('data-no-haptic', '')
  // Not rendered: no layout, nothing visible, and it cannot take focus (so an
  // open keyboard stays open). The label still toggles its switch.
  label.style.display = 'none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  label.appendChild(input)
  document.head.appendChild(label)
  try {
    label.click()
  } finally {
    label.remove()
  }
}

/** True while a tick is being produced, so it can never set off another. */
let ticking = false

export function haptic(): void {
  if (ticking) return
  ticking = true
  try {
    if (typeof navigator === 'undefined') return
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PULSE_MS)
      return
    }
    if (typeof document !== 'undefined' && isAppleTouchDevice()) iosSwitchTick()
  } catch {
    // Haptics are a nicety; never let them break the action they decorate.
  } finally {
    ticking = false
  }
}

/**
 * What counts as pressable: anything a person taps to act, choose or move on.
 * Text fields are not here, so typing never vibrates.
 */
const PRESSABLE = [
  'button',
  'a[href]',
  'summary',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="file"]',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
].join(',')

let installed = false

/**
 * One listener for the whole app, so every button and link — admin and
 * salesperson panels alike, and any added later — ticks once per tap without
 * each one wiring it up.
 *
 * Only real taps count (event.isTrusted): the iOS tick itself works by
 * clicking a hidden switch, and that synthetic click must not tick again.
 * A disabled button fires no click, so it stays silent. Capture phase, so the
 * tick lands before a page handler navigates away.
 */
export function installGlobalHaptics(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener(
    'click',
    (event) => {
      if (!event.isTrusted) return
      const target = event.target
      if (!(target instanceof Element)) return
      const pressable = target.closest(PRESSABLE)
      if (!pressable || pressable.closest('[data-no-haptic]')) return
      haptic()
    },
    { capture: true },
  )
}
