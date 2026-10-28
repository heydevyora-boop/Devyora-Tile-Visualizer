/**
 * The fidelity screen must pass the same tile seen in perspective or under
 * another light, and fail the mismatches reported from real renders: a
 * recoloured tile, a stone pattern redrawn at another scale, lines lost.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareTiles, rectify, tilePatch, type Quad, type RgbImage } from '../src/scripts/fidelityMetrics'
import { project, relight, stoneTile } from './syntheticTile'

const S = 192
const BLUE_GREY = { body: [128, 142, 150] as [number, number, number], line: [196, 200, 198] as [number, number, number] }
const reference = stoneTile({ size: S, stones: 9, lineWidth: 6, ...BLUE_GREY })

test('the same tile, photographed in perspective as part of a floor, passes', () => {
  const block: RgbImage = { width: 2 * S, height: S, data: new Uint8Array(2 * S * S * 3) }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < 2 * S; x++) {
      const from = (y * S + (x % S)) * 3
      block.data.set(reference.data.subarray(from, from + 3), (y * 2 * S + x) * 3)
    }
  }
  const quad: Quad = [[180, 120], [560, 110], [660, 360], [60, 380]]
  const flat = rectify(project(block, quad, 700, 400), quad, 2 * S, S)
  const report = compareTiles(reference, [tilePatch(flat, 0, 0, S), tilePatch(flat, 1, 0, S)])
  assert.equal(report.overall, 'PASS', JSON.stringify(report))
})

test('a dimmer or brighter room does not count as a colour change', () => {
  for (const k of [0.55, 1.4]) {
    const report = compareTiles(reference, [relight(reference, k)])
    assert.equal(report.overall, 'PASS', JSON.stringify(report))
    assert.ok(Math.abs(report.lightingRatio - k) < 0.05)
  }
})

test('a blue-grey tile rendered neutral grey fails on colour', () => {
  const grey = stoneTile({ size: S, stones: 9, lineWidth: 6, body: [140, 140, 140], line: BLUE_GREY.line })
  const report = compareTiles(reference, [grey])
  assert.equal(report.bodyColour.verdict, 'FAIL')
})

test('the stone pattern redrawn with smaller, more numerous stones fails', () => {
  const denser = stoneTile({ size: S, stones: 36, lineWidth: 6, ...BLUE_GREY, seed: 3 })
  const report = compareTiles(reference, [denser])
  assert.equal(report.patternScale.verdict, 'FAIL')
  assert.equal(report.overall, 'FAIL')
})

test('lines drawn much thinner fail', () => {
  const thin = stoneTile({ size: S, stones: 9, lineWidth: 2.5, ...BLUE_GREY })
  assert.equal(compareTiles(reference, [thin]).lineThickness.verdict, 'FAIL')
})

test('a different arrangement of the same stones (another piece of the same product) passes', () => {
  const another = stoneTile({ size: S, stones: 9, lineWidth: 6, ...BLUE_GREY, seed: 99 })
  assert.equal(compareTiles(reference, [another]).overall, 'PASS')
})

/** A plain tile: one colour with a little sensor-like noise. */
function plainTile(colour: [number, number, number], seed = 1): RgbImage {
  let state = seed
  const data = new Uint8Array(S * S * 3)
  for (let i = 0; i < S * S; i++) {
    state = (state * 1664525 + 1013904223) >>> 0
    const noise = (state / 2 ** 32 - 0.5) * 6
    data.set(colour.map((c) => Math.round(c + noise)), i * 3)
  }
  return { width: S, height: S, data }
}

test('a plain tile is recognised as plain, and matches itself under another light', () => {
  const beige = plainTile([201, 186, 160])
  const report = compareTiles(beige, [relight(plainTile([201, 186, 160], 9), 0.7)])
  assert.equal(report.plain, true)
  assert.equal(report.patternScale.verdict, 'N/A')
  assert.equal(report.overall, 'PASS', JSON.stringify(report))
})

test('a plain tile given an invented pattern fails, and so does a recoloured one', () => {
  const beige = plainTile([201, 186, 160])
  const patterned = stoneTile({ size: S, stones: 9, lineWidth: 6, body: [201, 186, 160], line: [150, 140, 120] })
  assert.equal(compareTiles(beige, [patterned]).uniformity.verdict, 'FAIL')
  assert.equal(compareTiles(beige, [plainTile([170, 175, 180])]).bodyColour.verdict, 'FAIL')
})

test('the same design redrawn at half size (four copies per tile, thinner lines) fails', () => {
  // Average 2x2 blocks to half size, then repeat 2x2 — the "more, smaller stones" render.
  const half = new Uint8Array((S / 2) * (S / 2) * 3)
  for (let y = 0; y < S / 2; y++) for (let x = 0; x < S / 2; x++) for (let c = 0; c < 3; c++) {
    const at = (dx: number, dy: number) => reference.data[((2 * y + dy) * S + 2 * x + dx) * 3 + c]
    half[(y * (S / 2) + x) * 3 + c] = Math.round((at(0, 0) + at(1, 0) + at(0, 1) + at(1, 1)) / 4)
  }
  const redrawn = new Uint8Array(S * S * 3)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const from = ((y % (S / 2)) * (S / 2) + (x % (S / 2))) * 3
    redrawn.set(half.subarray(from, from + 3), (y * S + x) * 3)
  }
  const report = compareTiles(reference, [{ width: S, height: S, data: redrawn }])
  assert.equal(report.patternScale.verdict, 'FAIL', JSON.stringify(report.patternScale))
})
