/**
 * Prints the exact prompts that would be sent to the image model, without
 * making any API call. Review prompt quality here before spending credits.
 *
 *   npm run print-prompts -- "Bathroom" "Modern" "1200x600"
 */
import { SYSTEM_INSTRUCTION, buildGenerationPrompts } from '../services/buildGenerationPrompt'
import { IMAGE_MODEL } from '../config/imageModel'

const [space = 'Bathroom', style = 'Modern', tileSize = '1200x600'] = process.argv.slice(2)

const prompts = buildGenerationPrompts({ space, style, tileSize })

console.log('='.repeat(78))
console.log(`INPUT  space="${space}"  style="${style}"  tileSize="${tileSize}"`)
if (prompts[0].resolvedStyle !== style) {
  console.log(`RESOLVED STYLE  "${style}" -> "${prompts[0].resolvedStyle}" (Surprise Me picked this randomly)`)
}
console.log(`MODEL  ${IMAGE_MODEL}`)
console.log(`Plus the tile photograph, attached to every call as an image part.`)
console.log('='.repeat(78))

console.log(`\n\n${'─'.repeat(78)}`)
console.log('SYSTEM INSTRUCTION (identical for all three concepts)')
console.log('─'.repeat(78))
console.log(SYSTEM_INSTRUCTION)

for (const prompt of prompts) {
  console.log(`\n\n${'─'.repeat(78)}`)
  console.log(`CONCEPT ${prompt.conceptIndex} OF ${prompts.length}`)
  console.log('─'.repeat(78))
  console.log(prompt.text)
}

console.log(`\n${'='.repeat(78)}`)
console.log(`${prompts.length} prompts built. No API calls were made.`)
console.log('='.repeat(78))
