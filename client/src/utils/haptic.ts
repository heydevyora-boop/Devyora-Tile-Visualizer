/**
 * A short tactile tick for the few actions that move a consultation forward
 * (New Visualization, Start, Continue, Generate, the microphone).
 *
 * Call it first thing in the tap handler, before navigating or fetching:
 * browsers only allow haptics while handling the user's own tap.
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

export function haptic(): void {
  try {
    if (typeof navigator === 'undefined') return
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PULSE_MS)
      return
    }
    if (typeof document !== 'undefined' && isAppleTouchDevice()) iosSwitchTick()
  } catch {
    // Haptics are a nicety; never let them break the action they decorate.
  }
}
