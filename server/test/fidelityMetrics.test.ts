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
