/**
 * What the model is told, for the cases that went wrong: the request must
 * not contradict itself about where the tile goes, and every space gets the
 * same product-fidelity rules.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SYSTEM_INSTRUCTION, buildModelRequest, describeModelRequest } from '../src/services/buildGenerationPrompt'
import { buildGenerationBrief, type BriefOption } from '../src/services/generationBrief'
import { SPACES } from '../src/config/spaces'

const size = { lengthMm: 600, breadthMm: 600 }
const node = (name: string, spaceId: string | null = null) => ({ id: name, name, description: '', spaceId })

function request(path: ReturnType<typeof node>[], options: { plain?: boolean; location?: BriefOption | null } = {}) {
  const brief = buildGenerationBrief({
    highlighterDimensions: size,
    plainTileProvided: Boolean(options.plain),
    plainDimensions: options.plain ? size : null,
    path,
    highlighterLocation: options.location ?? null,
  })
  return describeModelRequest(buildModelRequest(brief))
}

const parkingFloor = [node('Parking', 'parking'), node('Parking Floor')]

test('parking floor, one tile: the tile covers the floor, nothing tells it to stay off it', () => {
  const text = request(parkingFloor)
  assert.match(text, /covers EVERY designated surface in placement\.application completely/)
  assert.doesNotMatch(text, /remaining designated surfaces use the complementary non-tile finish/)
  assert.doesNotMatch(text, /One whole wall carries the highlighter/)
  assert.match(text, /"highlighterLocation": null/)
})

test('parking: bays, markings painted over the tile, cars to scale, walls never tiled', () => {
  const text = request(parkingFloor)
  assert.match(text, /marked parking bays/)
  assert.match(text, /paint sits on the tile surface/)
  assert.match(text, /true scale/)
  assert.match(text, /never the tile/)
})

test('another space with a plain tile: the highlighter is one feature area and the plain tile the rest', () => {
  const text = request([node('Kitchen', 'kitchen'), node('Kitchen Dado')], { plain: true })
  assert.match(text, /ONE clear, well-proportioned area/)
  assert.match(text, /The plain tile covers the remaining designated surfaces/)
})

test('bathroom locations are unchanged', () => {
  const bath = [node('Bathroom', 'bathroom'), node('Bathroom with Shower Area')]
  const shower = request(bath, { location: { id: 's', name: 'Shower Area', description: '' } })
  assert.match(shower, /HIGHLIGHTER ZONE — Shower Area/)
  assert.match(shower, /The remaining designated surfaces use the complementary non-tile finish/)
  const vanity = request(bath, { location: { id: 'v', name: 'Basin / Vanity', description: '' }, plain: true })
  assert.match(vanity, /HIGHLIGHTER ZONE — Basin \/ Vanity/)
  assert.match(vanity, /The plain tile covers the remaining designated wall surfaces/)
})

test('the system instruction protects colour and the printed face, and no longer waives colour accuracy', () => {
  assert.doesNotMatch(SYSTEM_INSTRUCTION, /Do not claim exact colour calibration/)
  assert.match(SYSTEM_INSTRUCTION, /COLOUR — keep each tile's colour as photographed/)
  assert.match(SYSTEM_INSTRUCTION, /ONE PHOTOGRAPH = ONE TILE/)
  assert.match(SYSTEM_INSTRUCTION, /Never replace it with generic cobblestones/)
  assert.match(SYSTEM_INSTRUCTION, /Real grout joints exist only BETWEEN tiles/)
})

test('every space gets the same reference rules — no weaker path', () => {
  for (const space of Object.values(SPACES)) {
    const text = request([node(space.label, space.id), node(`${space.label} Floor`)])
    assert.match(text, /REFERENCE IMAGE 1 — HIGHLIGHTER TILE\./, space.id)
    assert.match(text, /cropped to ONE whole tile, edge to edge/, space.id)
    assert.match(text, /Lines inside the face are part of the design, not grout/, space.id)
  }
})

test('the first view keeps the nearest tiles large enough to read', () => {
  assert.match(request(parkingFloor), /nearest tiles are large enough in the image for each one's whole design to be read/)
})

test('every catalogue space id is recognised (Living Room was refused as "living-room")', async () => {
  const { getSpaceConfig } = await import('../src/config/spaces')
  for (const space of Object.values(SPACES)) {
    assert.equal(getSpaceConfig(space.id)?.id, space.id, space.id)
    assert.equal(getSpaceConfig(space.label)?.id, space.id, space.label)
  }
  assert.match(request([node('Living Room', 'living-room'), node('Living Floor')]), /ROOM CONTEXT — what a living room typically contains/)
})

function requestWithPhoto(size: { lengthMm: number; breadthMm: number }, photo: { width: number; height: number } | null, joint: number | null = null) {
  const brief = buildGenerationBrief({
    highlighterDimensions: size,
    plainTileProvided: false,
    plainDimensions: null,
    path: [node('Bathroom', 'bathroom'), node('Bathroom with Shower Area')],
    highlighterLocation: { id: 's', name: 'Shower Area', description: '' },
    jointWidthMm: joint,
  })
  return describeModelRequest(buildModelRequest(brief, photo ? { highlighter: photo } : {}))
}

test('a photo shaped like one 400 x 1200 tile: one tile, and which way it lies', () => {
  const text = requestWithPhoto({ lengthMm: 400, breadthMm: 1200 }, { width: 1200, height: 400 })
  assert.match(text, /REFERENCE PHOTO — 1200 × 400 px: the proportion of one whole 1200 × 400 mm tile, photographed with its long 1200 mm edge horizontal/)
  assert.match(text, /lay the tiles the same way — long edge horizontal/)
})

test('a photo of several tiles (the reported case) is not treated as one 400 x 1200 tile', () => {
  const text = requestWithPhoto({ lengthMm: 400, breadthMm: 1200 }, { width: 692, height: 540 })
  assert.match(text, /does NOT have the proportion of one 1200 × 400 mm tile \(3\.00:1\)/)
  assert.match(text, /lay that design on tiles of exactly 1200 × 400 mm/)
  assert.match(text, /Never treat the photograph's outline as one tile/)
})

test('a square photo of a square tile', () => {
  assert.match(requestWithPhoto({ lengthMm: 600, breadthMm: 600 }, { width: 900, height: 880 }), /square, the proportion of one whole 600 × 600 mm tile/)
})

test('the joint is stated relative to the tile, and the design never turns within the tile', () => {
  assert.match(requestWithPhoto({ lengthMm: 400, breadthMm: 1200 }, null, 2), /GROUT JOINT — 2 mm\..*about 1\/200 of the tile's short 400 mm edge/)
  assert.match(SYSTEM_INSTRUCTION, /never turn the design within the tile, so vertical waves never become horizontal ones/)
})

test('without a measured photo the request reads as before', () => {
  const text = requestWithPhoto({ lengthMm: 400, breadthMm: 1200 }, null)
  assert.doesNotMatch(text, /REFERENCE PHOTO —/)
  assert.match(text, /cropped to ONE whole tile, edge to edge/)
})
