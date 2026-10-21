import './DevyoraMark.css'

/**
 * The Devyora "D", for the buttons that create a concept (in place of a
 * generic sparkle icon). A fine ring with a short arc slowly orbiting it, and
 * a D monogram that draws itself in when the button appears. Drawn in
 * currentColor, so it takes the button's own text colour. `busy` speeds the
 * orbit while a concept is being created.
 */
function DevyoraMark({ busy = false, size = 22 }: { busy?: boolean; size?: number }) {
  return (
    <svg
      className={`devyora-mark${busy ? ' devyora-mark--busy' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="devyora-mark__ring" cx="12" cy="12" r="10.5" />
      <circle className="devyora-mark__orbit" cx="12" cy="12" r="10.5" />
      <path className="devyora-mark__d" d="M8.25 6V18M8.25 6H11A6 6 0 0 1 11 18H8.25" />
      <path className="devyora-mark__serif" d="M6.75 6H8.25M6.75 18H8.25" />
    </svg>
  )
}

export default DevyoraMark
