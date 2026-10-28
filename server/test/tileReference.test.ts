/**
 * The tile reference on its way to the model: it must arrive as the same
 * photograph the salesperson cropped — not re-encoded for nothing, not
 * stretched, not recoloured — and the request must put each tile's image
 * directly after its own label.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'
import {
  fingerprint,
  prepareTileReference,
  writeDebugArtifacts,
} from '../src/services/generateVisualization'
import { buildModelRequest } from '../src/services/buildGenerationPrompt'
import { buildGenerationBrief } from '../src/services/generationBrief'

/** A photo-like test tile: a colour gradient with fine coloured veins. */
async function tilePhoto(width: number, height: number, options: { orientation?: number } = {}) {
  const raw = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      raw[i] = 90 + ((x * 60) / width) | 0
      raw[i + 1] = 110 + ((y * 40) / height) | 0
      raw[i + 2] = 140
      if (x % 9 === 0) raw.set([190, 60, 50], i)
    }
  }
  let image = sharp(raw, { raw: { width, height, channels: 3 } })
  if (options.orientation) image = image.withMetadata({ orientation: options.orientation })
  const buffer = await image.jpeg({ quality: 100, chromaSubsampling: '4:4:4' }).toBuffer()
  return { data: buffer.toString('base64'), mimeType: 'image/jpeg' }
}

test('a crop the model can use as it is reaches it byte for byte', async () => {
  const crop = await tilePhoto(1400, 1093)
  const reference = await prepareTileReference(crop)
  assert.equal(reference.data, crop.data)
  assert.equal(reference.mimeType, 'image/jpeg')
})

test('a sideways phone photo is turned upright, at full colour resolution', async () => {
  // EXIF orientation 6: stored landscape, meant to be seen portrait.
  const crop = await tilePhoto(800, 400, { orientation: 6 })
  const reference = await prepareTileReference(crop)
  const meta = await sharp(Buffer.from(reference.data, 'base64')).metadata()
  assert.equal(meta.width, 400)
  assert.equal(meta.height, 800)
  assert.ok(!meta.orientation || meta.orientation === 1)
  assert.equal(meta.chromaSubsampling, '4:4:4')
})

test('an oversized photo is reduced without stretching or recolouring it', async () => {
  const crop = await tilePhoto(3000, 1500)
  const reference = await prepareTileReference(crop)
  const buffer = Buffer.from(reference.data, 'base64')
  const meta = await sharp(buffer).metadata()
  assert.equal(meta.width, 1536)
  assert.equal(meta.height, 768)
  assert.equal(meta.chromaSubsampling, '4:4:4')
  // Downscaling softens the 1px veins a little; it must not shift the colour.
  const original = Buffer.from(crop.data, 'base64')
  const [o, r] = await Promise.all([sharp(original).stats(), sharp(buffer).stats()])
  for (let channel = 0; channel < 3; channel++) {
    assert.ok(Math.abs(o.channels[channel].mean - r.channels[channel].mean) < 1.5, `channel ${channel} mean moved`)
  }
})

test('fingerprints name an image exactly', async () => {
  const a = await tilePhoto(64, 64)
  const b = await tilePhoto(65, 64)
  assert.equal(fingerprint(a), fingerprint({ ...a }))
  assert.notEqual(fingerprint(a), fingerprint(b))
  assert.match(fingerprint(a), /^[0-9a-f]{12}$/)
})

test('each tile photograph follows its own label in the request', () => {
  const brief = buildGenerationBrief({
    highlighterDimensions: { lengthMm: 600, breadthMm: 600 },
    plainTileProvided: true,
    plainDimensions: { lengthMm: 600, breadthMm: 600 },
    path: [
      { id: 'b', name: 'Bathroom', description: '', spaceId: 'bathroom' },
      { id: 'bs', name: 'Bathroom with Shower Area', description: '', spaceId: null },
    ],
    highlighterLocation: { id: 'sh', name: 'Shower Area', description: '' },
  })
  const parts = buildModelRequest(brief).parts
  const images = parts.flatMap((part, index) => (part.kind === 'image' ? [{ tile: part.tile, index }] : []))
  assert.deepEqual(images.map((image) => image.tile), ['highlighter', 'plain'])
  for (const { tile, index } of images) {
    const label = parts[index - 1]
    assert.equal(label.kind, 'text')
    assert.match(label.kind === 'text' ? label.text : '', tile === 'highlighter' ? /^REFERENCE IMAGE 1 — HIGHLIGHTER TILE/ : /^REFERENCE IMAGE 2 — PLAIN/)
  }
})

test('debug artifacts are written only when asked for', async () => {
  const image = await tilePhoto(32, 32)
  const root = mkdtempSync(join(tmpdir(), 'tile-debug-'))
  const previous = process.env.TILE_DEBUG_DIR
  try {
    delete process.env.TILE_DEBUG_DIR
    await writeDebugArtifacts('gen', 0, { '01-highlighter-crop': image })
    assert.deepEqual(readdirSync(root), [])

    process.env.TILE_DEBUG_DIR = root
    await writeDebugArtifacts('gen', 0, { '01-highlighter-crop': image, '03-plain-crop': null }, {
      text: 'request',
      parts: [{ type: 'text', text: 'request' }],
    })
    await writeDebugArtifacts('gen', 0, { '06-model-output': image })
    const files = readdirSync(join(root, 'gen-concept-1')).sort()
    assert.deepEqual(files, ['01-highlighter-crop.jpg', '05-provider-input.json', '05-provider-input.txt', '06-model-output.jpg'])
    assert.ok(existsSync(join(root, 'gen-concept-1', '05-provider-input.txt')))
  } finally {
    if (previous === undefined) delete process.env.TILE_DEBUG_DIR
    else process.env.TILE_DEBUG_DIR = previous
    rmSync(root, { recursive: true, force: true })
  }
})
