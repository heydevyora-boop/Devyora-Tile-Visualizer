/**
 * Product-fidelity measurements: how closely a rendered tile matches its
 * reference photograph. Used by evalFidelity.ts; pure, no I/O.
 *
 * A render shows the tile in perspective and under the room's light, so the
 * two are compared on terms those cannot change:
 *
 * - Geometry is compared on a rectified patch: the corners of a block of
 *   whole tiles are marked in the render, and the block is warped back to a
 *   flat grid of one square patch per tile, the same size as the reference.
 * - Colour is compared as chromaticity in linear light (the share of red,
 *   green and blue), which a brighter or dimmer light does not change, so a
 *   shaded floor still matches but a blue-grey tile turned neutral grey does
 *   not.
 * - Each tile is split into its lighter and darker features at the midpoint
 *   between the two (isodata), after light smoothing, so texture grain does
 *   not count as pattern.
 * - Pattern scale is the typical width of the darker features (a stone, a
 *   motif), as a fraction of the tile — a design redrawn with twice as many,
 *   half-size stones roughly halves it.
 * - Line thickness is the same for the lighter features (lines, veins), and
 *   line coverage is their share of the tile.
 */

export interface RgbImage {
  width: number
  height: number
  /** 3 bytes per pixel, sRGB. */
  data: Uint8Array
}

/** Four corners in render pixels: top-left, top-right, bottom-right, bottom-left of the tile block. */
export type Quad = [[number, number], [number, number], [number, number], [number, number]]

const toLinear = (value: number) => {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const UNIT_SQUARE: Quad = [[0, 0], [1, 0], [1, 1], [0, 1]]

/** The homography (row-major 3x3) that maps the four `from` corners onto the four `to` corners. */
export function homography(from: Quad, to: Quad): number[] {
  const rows: number[][] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i]
    const [u, v] = to[i]
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col
    for (let r = col + 1; r < 8; r++) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r
    ;[rows[col], rows[pivot]] = [rows[pivot], rows[col]]
    for (let r = 0; r < 8; r++) {
      if (r === col) continue
      const factor = rows[r][col] / rows[col][col]
      for (let k = col; k < 9; k++) rows[r][k] -= factor * rows[col][k]
    }
  }
  return [...rows.map((row, i) => row[8] / row[i]), 1]
}

/** Warps the quad in `image` to a flat `width` x `height` patch (bilinear). */
export function rectify(image: RgbImage, quad: Quad, width: number, height: number): RgbImage {
  const h = homography(UNIT_SQUARE, quad)
  const out = new Uint8Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = (x + 0.5) / width
      const sy = (y + 0.5) / height
      const w = h[6] * sx + h[7] * sy + h[8]
      const u = Math.min(Math.max((h[0] * sx + h[1] * sy + h[2]) / w - 0.5, 0), image.width - 1)
      const v = Math.min(Math.max((h[3] * sx + h[4] * sy + h[5]) / w - 0.5, 0), image.height - 1)
      const x0 = Math.floor(u), y0 = Math.floor(v)
      const x1 = Math.min(x0 + 1, image.width - 1), y1 = Math.min(y0 + 1, image.height - 1)
      const fx = u - x0, fy = v - y0
      for (let c = 0; c < 3; c++) {
        const p = (px: number, py: number) => image.data[(py * image.width + px) * 3 + c]
        const top = p(x0, y0) * (1 - fx) + p(x1, y0) * fx
        const bottom = p(x0, y1) * (1 - fx) + p(x1, y1) * fx
        out[(y * width + x) * 3 + c] = Math.round(top * (1 - fy) + bottom * fy)
      }
    }
  }
  return { width, height, data: out }
}

/** One tile's patch out of a rectified block. */
export function tilePatch(block: RgbImage, column: number, row: number, size: number): RgbImage {
  const out = new Uint8Array(size * size * 3)
  for (let y = 0; y < size; y++) {
    const from = ((row * size + y) * block.width + column * size) * 3
    out.set(block.data.subarray(from, from + size * 3), y * size * 3)
  }
  return { width: size, height: size, data: out }
}

function luminance(image: RgbImage): Float64Array {
  const out = new Float64Array(image.width * image.height)
  for (let i = 0; i < out.length; i++) {
    const d = image.data
    out[i] = 0.2126 * toLinear(d[i * 3]) + 0.7152 * toLinear(d[i * 3 + 1]) + 0.0722 * toLinear(d[i * 3 + 2])
  }
  return out
}

/** A 3x3 box blur, twice: enough to stop texture grain counting as pattern. */
function smooth(values: Float64Array, width: number, height: number): Float64Array {
  let current = values
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float64Array(current.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, n = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx, py = y + dy
          if (px < 0 || py < 0 || px >= width || py >= height) continue
          sum += current[py * width + px]; n++
        }
        next[y * width + x] = sum / n
      }
    }
    current = next
  }
  return current
}

/**
 * The isodata threshold: the midpoint between the mean of the pixels below
 * it and the mean of those above, iterated. Unlike Otsu it is not pulled
 * into the larger class when the lighter features are a small share.
 */
function isodata(values: Float64Array): number {
  let t = values.reduce((a, b) => a + b, 0) / values.length
  for (let i = 0; i < 50; i++) {
    let low = 0, nLow = 0, high = 0, nHigh = 0
    for (const v of values) { if (v > t) { high += v; nHigh++ } else { low += v; nLow++ } }
    const next = ((nLow ? low / nLow : t) + (nHigh ? high / nHigh : t)) / 2
    if (Math.abs(next - t) < 1e-6) break
    t = next
  }
  return t
}

/** True for the lighter of the two classes in each pixel. */
export function lightMask(image: RgbImage): Uint8Array {
  const lum = smooth(luminance(image), image.width, image.height)
  const t = isodata(lum)
  return Uint8Array.from(lum, (v) => (v > t ? 1 : 0))
}

/** Mean linear-light chromaticity (r, g) of the pixels in `mask` (or all). */
export function chromaticity(image: RgbImage, mask?: Uint8Array, want = 1): [number, number] {
  let r = 0, g = 0, n = 0
  for (let i = 0; i < image.width * image.height; i++) {
    if (mask && mask[i] !== want) continue
    const R = toLinear(image.data[i * 3]), G = toLinear(image.data[i * 3 + 1]), B = toLinear(image.data[i * 3 + 2])
    const total = R + G + B
    if (total < 1e-4) continue
    r += R / total; g += G / total; n++
  }
  return n ? [r / n, g / n] : [1 / 3, 1 / 3]
}

/**
 * Typical width of the features of one class (1 = lighter, 0 = darker), as a
 * fraction of the tile: the mean length of its runs along every row and
 * column.
 */
export function featureScale(mask: Uint8Array, size: number, want: number): number {
  let total = 0, runs = 0
  for (let line = 0; line < size; line++) {
    for (const step of [1, size]) {
      const start = step === 1 ? line * size : line
      let run = 0
      for (let k = 0; k < size; k++) {
        if (mask[start + k * step] === want) run++
        else if (run) { total += run; runs++; run = 0 }
      }
      if (run) { total += run; runs++ }
    }
  }
  return runs ? total / runs / size : 0
}

export const lightShare = (mask: Uint8Array) => mask.reduce((sum, v) => sum + v, 0) / mask.length

export type Verdict = 'PASS' | 'WARN' | 'FAIL'

export interface FidelityReport {
  /** Linear chromaticity distance of the tile body (dark class), x1000. */
  bodyColour: { distance: number; verdict: Verdict }
  /** The same for the lighter features (lines, veins). */
  lineColour: { distance: number; verdict: Verdict }
  /** Rendered / reference width of the darker features (stones, motifs). 1 is identical; 0.5 is half-size. */
  patternScale: { ratio: number; verdict: Verdict }
  /** Rendered / reference width of the lighter features (lines, veins). */
  lineThickness: { ratio: number; verdict: Verdict }
  /** Rendered / reference share of the lighter class. */
  lineCoverage: { ratio: number; verdict: Verdict }
  /** Rendered / reference mean luminance: the room's light, informational only. */
  lightingRatio: number
  overall: Verdict
}

const band = (value: number, pass: number, warn: number): Verdict => (value <= pass ? 'PASS' : value <= warn ? 'WARN' : 'FAIL')
const ratioBand = (ratio: number, pass: number, warn: number): Verdict => {
  const off = Math.max(ratio, 1 / ratio)
  return off <= pass ? 'PASS' : off <= warn ? 'WARN' : 'FAIL'
}

/**
 * Compares a reference tile with rendered tiles, each a square patch of the
 * same size (see rectify/tilePatch). Several rendered patches are averaged.
 */
export function compareTiles(reference: RgbImage, rendered: RgbImage[]): FidelityReport {
  const size = reference.width
  const refMask = lightMask(reference)
  const refBody = chromaticity(reference, refMask, 0)
  const refLines = chromaticity(reference, refMask, 1)
  const refScale = featureScale(refMask, size, 0)
  const refThickness = featureScale(refMask, size, 1)
  const refShare = lightShare(refMask)
  const refLum = luminance(reference).reduce((a, b) => a + b, 0) / (size * size)

  let body = 0, lines = 0, scale = 0, thickness = 0, share = 0, lum = 0
  for (const patch of rendered) {
    const mask = lightMask(patch)
    const b = chromaticity(patch, mask, 0), l = chromaticity(patch, mask, 1)
    body += Math.hypot(b[0] - refBody[0], b[1] - refBody[1]) * 1000
    lines += Math.hypot(l[0] - refLines[0], l[1] - refLines[1]) * 1000
    scale += featureScale(mask, size, 0) / refScale
    thickness += featureScale(mask, size, 1) / refThickness
    share += lightShare(mask) / refShare
    lum += luminance(patch).reduce((a, v) => a + v, 0) / (size * size) / refLum
  }
  const n = rendered.length
  const report = {
    bodyColour: { distance: +(body / n).toFixed(1), verdict: band(body / n, 8, 15) },
    lineColour: { distance: +(lines / n).toFixed(1), verdict: band(lines / n, 10, 20) },
    patternScale: { ratio: +(scale / n).toFixed(2), verdict: ratioBand(scale / n, 1.25, 1.5) },
    lineThickness: { ratio: +(thickness / n).toFixed(2), verdict: ratioBand(thickness / n, 1.35, 1.8) },
    lineCoverage: { ratio: +(share / n).toFixed(2), verdict: ratioBand(share / n, 1.3, 1.7) },
    lightingRatio: +(lum / n).toFixed(2),
  }
  const verdicts = [report.bodyColour, report.lineColour, report.patternScale, report.lineThickness, report.lineCoverage].map((m) => m.verdict)
  return { ...report, overall: verdicts.includes('FAIL') ? 'FAIL' : verdicts.includes('WARN') ? 'WARN' : 'PASS' }
}
