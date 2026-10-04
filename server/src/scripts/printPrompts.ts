/**
 * Prints exactly what the image model would be sent, without making any API
 * call and without a database: the permanent system instruction, the structured
 * brief, and the ordered request rendered from it.
 *
 *   npm run print-prompts
 *   npm run print-prompts -- --plain 600x600 --location "Shower Area" --joint 3
 *
 * Review quality here before spending credits. See sampleBrief.ts for the flags.
 */
import { SYSTEM_INSTRUCTION, buildModelRequest, describeModelRequest } from '../services/buildGenerationPrompt'
import { IMAGE_MODEL } from '../config/imageModel'
import { USAGE, readFlags, sampleBrief } from './sampleBrief'

const flags = readFlags(process.argv.slice(2))
if (flags.help !== undefined) {
  console.log(USAGE)
  process.exit(0)
}
const brief = sampleBrief(flags)
const plan = buildModelRequest(brief)
const rule = (c: string) => c.repeat(78)

console.log(rule('='))
console.log(`MODEL  ${IMAGE_MODEL}`)
console.log(`PLAIN TILE  ${brief.tiles.plain.provided ? 'supplied (a second image is sent)' : 'No Plain Tile (no second image)'}`)
console.log('IMAGES  ' + plan.parts.filter((p) => p.kind === 'image').length + ' separate image part(s), each after its own label')
console.log(rule('='))

console.log(`\n${rule('─')}\nSYSTEM INSTRUCTION — permanent, identical for every request, never sent to the browser\n${rule('─')}`)
console.log(SYSTEM_INSTRUCTION)

console.log(`\n\n${rule('─')}\nTHE BRIEF — what was selected, as separate structured values (this is what is logged and stored)\n${rule('─')}`)
console.log(JSON.stringify(brief, null, 2))

console.log(`\n\n${rule('─')}\nTHE REQUEST — what the model receives as input, in order\n${rule('─')}`)
console.log(describeModelRequest(plan))

console.log(`\n${rule('=')}\n1 request built. No API calls were made.\n${rule('=')}`)
