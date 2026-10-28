/**
 * The crop rectangle the exporter uses: whole pixels, entirely inside the
 * photo. A rectangle one pixel past the edge exports a black line along the
 * crop, which the model reads as a dark joint on the tile.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseCropRect } from '../src/utils/cropImage.ts'

test('a selection rounded up at the edge stays inside the photo', () => {
  // Rounded field by field this was x 11 + width 1390 = 1401 of 1400.
  const crop = normaliseCropRect({ x: 10.5, y: 0.5, width: 1389.5, height: 1092.5 }, 1400, 1093)
  assert.equal(crop.x + crop.width, 1400)
  assert.equal(crop.y + crop.height, 1093)
})

test('a selection inside the photo keeps its edges', () => {
  assert.deepEqual(normaliseCropRect({ x: 100.2, y: 50.7, width: 400.4, height: 300.1 }, 1400, 1093), {
    x: 100,
    y: 51,
    width: 401,
    height: 300,
  })
})

test('a selection past any edge is clipped to the photo, never extended', () => {
  assert.deepEqual(normaliseCropRect({ x: -3, y: -2, width: 1500, height: 1200 }, 1400, 1093), {
    x: 0,
    y: 0,
    width: 1400,
    height: 1093,
  })
})

test('a sliver is never less than one pixel', () => {
  const crop = normaliseCropRect({ x: 1399.8, y: 10, width: 0.1, height: 0.1 }, 1400, 1093)
  assert.ok(crop.width >= 1 && crop.height >= 1)
  assert.ok(crop.x + crop.width <= 1400)
})
