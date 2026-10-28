/**
 * Measures how faithfully a render reproduces the tile it was given.
 *
 *   npm run eval:fidelity -- --reference test-output/reference.jpg --render test-output/concept1.png \
 *     --quad "412,610 655,598 702,742 380,760" --tiles 2x1 --out test-output/fidelity
 *
 * --quad   the corners of a block of WHOLE tiles in the render, in render
 *          pixels: top-left, top-right, bottom-right, bottom-left, following
 *          the tile joints. Pick the nearest, largest tiles.
 * --tiles  how many tiles that block spans, columns x rows (default 1x1).
 * --region "x,y,width,height" instead of --quad, where the tile joints cannot
 *          be found: compares colour only, since pattern size needs tile edges.
 * --out    a folder for the report and a side-by-side image (reference tile |
 *          each rendered tile, flattened).
 *
 * The verdicts are a screen for major mismatches (a recoloured tile, a
 * redrawn pattern at another scale, lines lost or thickened), not a proof of
 * fidelity: a PASS still needs a person to look at the side-by-side.
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import sharp from 'sharp'
import { readFlags } from './sampleBrief'
import {
  chromaticity,
  compareTiles,
  lightMask,
  rectify,
  tilePatch,
  type Quad,
  type RgbImage,
} from './fidelityMetrics'

const PATCH = 256

async function load(path: string, width?: number, height?: number): Promise<RgbImage> {
  let image = sharp(resolve(path)).rotate().removeAlpha()
  if (width && height) image = image.resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8Array(data) }
}

const png = (image: RgbImage) =>
  sharp(Buffer.from(image.data), { raw: { width: image.width, height: image.height, channels: 3 } }).png().toBuffer()

function parseQuad(value: string): Quad {
  const points = value.trim().split(/\s+/).map((pair) => pair.split(',').map(Number))
  if (points.length !== 4 || points.some((p) => p.length !== 2 || p.some((n) => !Number.isFinite(n)))) {
    throw new Error('--quad needs four "x,y" corners: top-left top-right bottom-right bottom-left')
  }
  return points as Quad
}

async function main() {
  const flags = readFlags(process.argv.slice(2))
  if (!flags.reference || !flags.render || (!flags.quad && !flags.region)) {
    console.error('Usage: npm run eval:fidelity -- --reference ref.jpg --render concept.png --quad "x,y x,y x,y x,y" [--tiles 2x1] [--out dir]')
    console.error('   or: ... --region "x,y,width,height"   (colour only)')
    process.exit(1)
  }
  const reference = await load(flags.reference, PATCH, PATCH)
  const render = await load(flags.render)
  const out = flags.out ? resolve(flags.out) : null
  if (out) mkdirSync(out, { recursive: true })

  if (!flags.quad) {
    const [x, y, width, height] = (flags.region as string).split(',').map(Number)
    const { data, info } = await sharp(resolve(flags.render)).removeAlpha()
      .extract({ left: x, top: y, width, height }).resize(PATCH, PATCH, { fit: 'fill' }).raw()
      .toBuffer({ resolveWithObject: true })
    const region: RgbImage = { width: info.width, height: info.height, data: new Uint8Array(data) }
    const refMask = lightMask(reference), regionMask = lightMask(region)
    const distance = (a: [number, number], b: [number, number]) => +(Math.hypot(a[0] - b[0], a[1] - b[1]) * 1000).toFixed(1)
    const report = {
      mode: 'colour only (no tile edges given; pattern size not measured)',
      bodyColour: distance(chromaticity(reference, refMask, 0), chromaticity(region, regionMask, 0)),
      lineColour: distance(chromaticity(reference, refMask, 1), chromaticity(region, regionMask, 1)),
      reference: { body: chromaticity(reference, refMask, 0), lines: chromaticity(reference, refMask, 1) },
      render: { body: chromaticity(region, regionMask, 0), lines: chromaticity(region, regionMask, 1) },
      note: 'Distances are linear-light chromaticity x1000: about 8 or less matches, above 15 is a different colour.',
    }
    console.log(JSON.stringify(report, null, 2))
    if (out) {
      writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))
      await sharp({ create: { width: PATCH * 2 + 8, height: PATCH, channels: 3, background: '#ffffff' } })
        .composite([{ input: await png(reference), left: 0, top: 0 }, { input: await png(region), left: PATCH + 8, top: 0 }])
        .png().toFile(join(out, 'side-by-side.png'))
    }
    return
  }

  const [columns, rows] = (flags.tiles ?? '1x1').split(/x/i).map(Number)
  const block = rectify(render, parseQuad(flags.quad), columns * PATCH, rows * PATCH)
  const patches: RgbImage[] = []
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) patches.push(tilePatch(block, column, row, PATCH))
  const report = compareTiles(reference, patches)
  console.log(JSON.stringify(report, null, 2))
  if (out) {
    writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))
    const tiles = [reference, ...patches]
    await sharp({ create: { width: tiles.length * (PATCH + 8) - 8, height: PATCH, channels: 3, background: '#ffffff' } })
      .composite(await Promise.all(tiles.map(async (tile, i) => ({ input: await png(tile), left: i * (PATCH + 8), top: 0 }))))
      .png().toFile(join(out, 'side-by-side.png'))
    console.log(`\nreport and side-by-side written to ${out}`)
  }
  if (report.overall === 'FAIL') process.exitCode = 2
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
