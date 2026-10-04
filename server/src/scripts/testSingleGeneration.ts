/**
 * Fires exactly ONE real Gemini image generation call (Concept 1 only) so the
 * integration, image quality and cost can be validated before generating the
 * full set of three.
 *
 *   npm run test:generate
 *   npm run test:generate -- --plain 600x600 --location "Shower Area"
 *
 * Builds the same brief and the same ordered request as a real generation (see
 * sampleBrief.ts for the flags) and sends it once, so the integration, image
 * quality and cost can be validated before a consultation does the same. With
 * --plain, the sample photo is sent as BOTH tiles, as two separate images — a
 * smoke test of the request shape, not of how two different tiles look.
 */
import 'dotenv/config'
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { GoogleGenAI } from '@google/genai'
import { SYSTEM_INSTRUCTION, buildModelRequest } from '../services/buildGenerationPrompt'
import { parseTileImage } from '../services/generateVisualization'
import { IMAGE_ASPECT_RATIO, IMAGE_MODEL as MODEL, IMAGE_SIZE } from '../config/imageModel'
import { readFlags, sampleBrief } from './sampleBrief'

const flags = readFlags(process.argv.slice(2))

const TILE_PATH = resolve(__dirname, '../../../client/public/sample-tile.jpg')
const OUT_DIR = resolve(__dirname, '../../test-output')

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('ABORTED: GEMINI_API_KEY is not set (no server/.env found).')
    console.error('No API call was made, so nothing was charged.')
    process.exit(1)
  }

  const tileBytes = readFileSync(TILE_PATH)
  const tileDataUrl = `data:image/jpeg;base64,${tileBytes.toString('base64')}`
  const tile = parseTileImage(tileDataUrl)

  const brief = sampleBrief(flags)
  const plan = buildModelRequest(brief)
  const modelInput = plan.parts.map((part) =>
    part.kind === 'text'
      ? { type: 'text' as const, text: part.text }
      : { type: 'image' as const, data: tile.data, mime_type: tile.mimeType },
  )

  console.log('='.repeat(72))
  console.log('SINGLE GENERATION TEST - CONCEPT 1 ONLY')
  console.log('='.repeat(72))
  console.log('model      :', MODEL)
  console.log('placement  :', brief.placement.path.join(' > '))
  console.log('tile size  :', `${brief.tiles.highlighter.sizeMm.lengthMm} x ${brief.tiles.highlighter.sizeMm.breadthMm} mm`)
  console.log('plain tile :', brief.tiles.plain.provided ? 'supplied' : 'No Plain Tile')
  console.log('tile photo :', TILE_PATH)
  console.log('photo       :', tileBytes.length, 'bytes ->', tile.data.length, 'base64 chars')
  console.log('focus      :', plan.conceptFocus)
  console.log('parts      :', plan.parts.map((p) => (p.kind === 'text' ? 'text' : `image(${p.tile})`)).join(', '))
  console.log('calls      : 1')
  console.log('='.repeat(72))

  const ai = new GoogleGenAI({ apiKey })

  const started = Date.now()
  let interaction
  try {
    interaction = await ai.interactions.create({
      model: MODEL,
      system_instruction: SYSTEM_INSTRUCTION,
      input: modelInput,
      response_modalities: ['text', 'image'],
      generation_config: {
        image_config: {
          aspect_ratio: IMAGE_ASPECT_RATIO,
          image_size: IMAGE_SIZE,
        },
      },
    })
  } catch (error) {
    const elapsed = Date.now() - started
    console.error(`\nFAILED after ${elapsed} ms`)
    console.error('error name   :', (error as Error)?.name)
    console.error('error message:', (error as Error)?.message)
    const status = (error as { status?: unknown })?.status
    if (status !== undefined) console.error('http status  :', status)
    console.error('\nfull error object:')
    console.error(error)
    process.exit(1)
  }

  const elapsed = Date.now() - started
  console.log(`\nCALL COMPLETED in ${elapsed} ms (${(elapsed / 1000).toFixed(2)}s)`)
  console.log('interaction id  :', interaction.id)
  console.log('model reported  :', (interaction as { model?: string }).model ?? '(not reported)')
  console.log('output_text     :', interaction.output_text ? JSON.stringify(interaction.output_text.slice(0, 300)) : '(none)')

  const usage = (interaction as { usage?: unknown }).usage
  if (usage) console.log('usage           :', JSON.stringify(usage))

  const image = interaction.output_image
  if (!image?.data) {
    console.error('\nNO IMAGE RETURNED. Full interaction object:')
    console.error(JSON.stringify(interaction, null, 2).slice(0, 4000))
    process.exit(1)
  }

  const mime = image.mime_type ?? 'image/png'
  const ext = EXT_BY_MIME[mime] ?? 'png'
  const buffer = Buffer.from(image.data, 'base64')

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, `concept1.${ext}`)
  writeFileSync(outPath, buffer)

  console.log('\nIMAGE SAVED')
  console.log('path      :', outPath)
  console.log('mime type :', mime)
  console.log('size      :', buffer.length, 'bytes', `(${(buffer.length / 1024).toFixed(1)} KB)`)
  console.log('\nConcepts 2 and 3 were NOT generated.')
}

main().catch((error) => {
  console.error('Unexpected failure:', error)
  process.exit(1)
})
