import { useEffect } from 'react'

/**
 * Keeps the space a page reserves under its content equal to the fixed action
 * bar that sits over it.
 *
 * Several screens end in a bar pinned to the bottom (Continue / Generate / the
 * result dock) and reserve room under their content so the last row is never
 * hidden behind it. That room was a fixed 8rem, but the bars are about half that,
 * so a screen whose content fits above its bar still scrolled by the difference —
 * a page that moved when swiped for no reason. This publishes the bar's real
 * height as --action-bar-reserve, which the `.pb-32` reserve reads (index.css).
 * Where the bar is taller (an error line above the button) the reserve grows
 * with it, so a screen that does need to scroll still scrolls clear of the bar.
 *
 * Renders nothing. Screens without a bar leave the variable unset, and the
 * reserve falls back to its old 8rem.
 */
const BAR_SELECTOR = '.fixed.bottom-0.inset-x-0, aside.fixed.bottom-3'
/** A little air between the last row and the bar. */
const GAP_PX = 8

function ActionBarReserve() {
  useEffect(() => {
    const root = document.documentElement
    const appRoot = document.getElementById('root')
    if (!appRoot) return
    let bar: Element | null = null
    let resizeObserver: ResizeObserver | null = null

    const publish = () => {
      if (!bar) {
        root.style.removeProperty('--action-bar-reserve')
        return
      }
      // The bar's own height plus how far it floats above the edge — not its
      // distance from the top of the window, which moves with the keyboard.
      const gapBelow = parseFloat(getComputedStyle(bar).bottom) || 0
      const reserve = Math.ceil(bar.getBoundingClientRect().height + gapBelow + GAP_PX)
      root.style.setProperty('--action-bar-reserve', `${reserve}px`)
    }

    const refresh = () => {
      const found = document.querySelector(BAR_SELECTOR)
      if (found !== bar) {
        resizeObserver?.disconnect()
        bar = found
        if (bar && 'ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(publish)
          resizeObserver.observe(bar)
        }
      }
      publish()
    }

    // The bar belongs to whichever screen is showing, so follow the DOM.
    const mutationObserver = new MutationObserver(refresh)
    mutationObserver.observe(appRoot, { childList: true, subtree: true })
    window.addEventListener('resize', publish)
    refresh()

    return () => {
      mutationObserver.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', publish)
      root.style.removeProperty('--action-bar-reserve')
    }
  }, [])

  return null
}

export default ActionBarReserve
