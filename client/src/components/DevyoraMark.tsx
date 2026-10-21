import { useId } from 'react'
import './DevyoraMark.css'

/** A high-contrast serif "D": thick stem and bowl, hairline top and bottom, small serifs. */
const D_PATH =
  'M5 4H11.5C16.2 4 19.5 7.4 19.5 12C19.5 16.6 16.2 20 11.5 20H5V19.2H6.6V4.8H5Z' +
  'M9.4 4.9V19.1H11.2C14.6 19.1 16.6 16.2 16.6 12C16.6 7.8 14.6 4.9 11.2 4.9Z'

/**
 * The Devyora "D", for the buttons that create a concept (in place of a
 * generic sparkle icon): a solid serif monogram in the button's own text
 * colour, a soft band of light sweeping across it every few seconds, and a
 * small four-point star that twinkles after each sweep. `busy` quickens the
 * sweep while a concept is being created.
 */
function DevyoraMark({ busy = false, size = 22 }: { busy?: boolean; size?: number }) {
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
      <path
        className="devyora-mark__star"
        d="M21.6 0L22.55 2.75L25.3 3.7L22.55 4.65L21.6 7.4L20.65 4.65L17.9 3.7L20.65 2.75Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default DevyoraMark
