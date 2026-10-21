import { useId } from 'react'
import './DevyoraMark.css'

/** A high-contrast serif "D": thick stem and bowl, hairline top and bottom, small serifs. */
const D_PATH =
  'M5 4H11.5C16.2 4 19.5 7.4 19.5 12C19.5 16.6 16.2 20 11.5 20H5V19.2H6.6V4.8H5Z' +
  'M9.4 4.9V19.1H11.2C14.6 19.1 16.6 16.2 16.6 12C16.6 7.8 14.6 4.9 11.2 4.9Z'

/**
 * The Devyora "D", for the buttons that create a concept (in place of a
 * generic sparkle icon): a solid serif monogram inside a fine ring, like a
 * logo emblem, in the button's own text colour, a soft band of light sweeping across it every few seconds, and a
 * small four-point star that twinkles after each sweep. `busy` quickens the
 * sweep while a concept is being created.
 */
function DevyoraMark({ busy = false, size = 24 }: { busy?: boolean; size?: number }) {
  // url(#…) references must be unique per instance and free of ":".
  const clipId = `devyora-d-${useId().replace(/:/g, '')}`
  return (
    <svg
      className={`devyora-mark${busy ? ' devyora-mark--busy' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={D_PATH} fillRule="evenodd" />
        </clipPath>
        <linearGradient id={`${clipId}-sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff6e6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff6e6" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff6e6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="devyora-mark__glyph">
        {/* The emblem: a fine ring with the D centred inside it. */}
        <circle className="devyora-mark__ring" cx="12" cy="12" r="11" />
        <g transform="translate(12 12) scale(0.66) translate(-12.25 -12)">
          <path d={D_PATH} fill="currentColor" fillRule="evenodd" />
          <g clipPath={`url(#${clipId})`}>
            <rect
              className="devyora-mark__sheen"
              x="-8"
              y="-4"
              width="7"
              height="32"
              fill={`url(#${clipId}-sheen)`}
              transform="skewX(-20)"
            />
          </g>
        </g>
      </g>
      <path
        className="devyora-mark__star"
        d="M21.4 -0.6L22.25 1.85L24.7 2.7L22.25 3.55L21.4 6L20.55 3.55L18.1 2.7L20.55 1.85Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default DevyoraMark
