/**
 * A synthetic irregular-stone tile for the fidelity tests: Voronoi "stones"
 * in a body colour, separated by lighter lines — the crazy-paving case the
 * metrics have to tell apart from a redrawn or recoloured version.
 */
import { homography, type Quad, type RgbImage } from '../src/scripts/fidelityMetrics'

export interface TileSpec {
  size: number
  stones: number
  lineWidth: number
  body: [number, number, number]
  line: [number, number, number]
  seed?: number
}

function random(seed: number) {
  let state = seed >>> 0
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

export function stoneTile({ size, stones, lineWidth, body, line, seed = 7 }: TileSpec): RgbImage {
  const next = random(seed)
  const points = Array.from({ length: stones }, () => [next() * size, next() * size])
  const data = new Uint8Array(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let first = Infinity, second = Infinity
      for (const [px, py] of points) {
        const d = Math.hypot(px - x, py - y)
        if (d < first) { second = first; first = d } else if (d < second) second = d
      }
      // A little texture so the body is not flat.
      const grain = ((x * 7919 + y * 104729) % 11) - 5
      const colour = second - first < lineWidth ? line : body.map((c) => c + grain)
      data.set(colour.map((c) => Math.max(0, Math.min(255, Math.round(c)))), (y * size + x) * 3)
    }
  }
  return { width: size, height: size, data }
}

/** Scales the light falling on an image: linear RGB times k, as a dimmer or brighter room would. */
export function relight(image: RgbImage, k: number): RgbImage {
  const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const enc = (c: number) => Math.round(255 * Math.min(1, c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055))
  return { ...image, data: Uint8Array.from(image.data, (v) => enc(lin(v) * k)) }
}

/** Paints `block` (a flat image) into a `width` x `height` scene inside `quad`, as a camera would. */
export function project(block: RgbImage, quad: Quad, width: number, height: number, background = 90): RgbImage {
  const inverse = homography(quad, [[0, 0], [1, 0], [1, 1], [0, 1]])
  const data = new Uint8Array(width * height * 3).fill(background)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = inverse[6] * (x + 0.5) + inverse[7] * (y + 0.5) + inverse[8]
      const u = (inverse[0] * (x + 0.5) + inverse[1] * (y + 0.5) + inverse[2]) / w
      const v = (inverse[3] * (x + 0.5) + inverse[4] * (y + 0.5) + inverse[5]) / w
      if (u < 0 || v < 0 || u >= 1 || v >= 1) continue
      const bx = Math.floor(u * block.width), by = Math.floor(v * block.height)
      data.set(block.data.subarray((by * block.width + bx) * 3, (by * block.width + bx) * 3 + 3), (y * width + x) * 3)
    }
  }
  return { width, height, data }
}
