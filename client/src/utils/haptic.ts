/**
 * A very light tactile tick for the few actions that move a consultation
 * forward (Start, Continue, Generate, the microphone). Call it from the tap
 * handler itself: browsers only allow haptics during a user gesture.
 *
 * - Android and other browsers with the Vibration API: one 10ms pulse.
 * - iOS Safari has no Vibration API. Since iOS 18, toggling a native switch
 *   control gives the system's own light tick, so a hidden one is toggled.
 * - Anything else: nothing happens.
 */
let iosSwitch: HTMLLabelElement | null = null

function iosSwitchLabel(): HTMLLabelElement {
  if (iosSwitch?.isConnected) return iosSwitch
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText =
    'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px;top:0'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.appendChild(input)
  document.body.appendChild(label)
  iosSwitch = label
  return label
}

export function haptic(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10)
      return
    }
    const ua = navigator.userAgent
    const isIOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    if (typeof document === 'undefined' || !isIOS) return
    // Clicking the label moves focus to the hidden switch; hand it straight
    // back so an open keyboard (the instructions field) is not dismissed.
    const focused = document.activeElement
    iosSwitchLabel().click()
    if (focused instanceof HTMLElement && focused !== document.activeElement) {
      focused.focus({ preventScroll: true })
    }
  } catch {
    // Haptics are a nicety; never let them break the action they decorate.
  }
}
