/** One recognised phrase, as the Web Speech API reports it. */
export interface TranscriptPart {
  isFinal: boolean
  0: { transcript: string }
}

/** For comparing phrases: case, spacing and punctuation aside. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** How many words two phrases share at the start. */
function sharedLeadingWords(a: string, b: string): number {
  const x = a.split(' '), y = b.split(' ')
  let count = 0
  while (count < x.length && count < y.length && x[count] === y[count]) count += 1
  return count
}

/**
 * Everything said so far in one dictation, rebuilt from the full list of
 * results every time.
 *
 * Browsers do not report results the same way. Desktop Chrome sends each new
 * phrase as its own result. Chrome on Android sends every result again with
 * the earlier words repeated in it ("isko", "isko ball", "isko ball per"),
 * sometimes with an earlier word corrected ("isko bol" → "isko ball per"), and
 * can deliver the same result more than once. Adding each one to the end
 * turned three spoken words into lines of repeats. So with `repeats` (a phone's
 * browser) a result that extends or corrects the phrase before it replaces
 * that phrase, a repeat is skipped, and only a genuinely new phrase is added
 * after a space. Without it (a computer's browser, which never repeats), every
 * phrase is simply added, as before.
 */
export function transcriptOf(results: ArrayLike<TranscriptPart>, repeats: boolean): string {
  const phrases: string[] = []
  for (let index = 0; index < results.length; index += 1) {
    const phrase = results[index][0].transcript.replace(/\s+/g, ' ').trim()
    if (!phrase) continue
    if (!repeats) {
      phrases.push(phrase)
      continue
    }
    const next = normalise(phrase)
    if (!next) continue
    const whole = normalise(phrases.join(' '))
    const last = normalise(phrases[phrases.length - 1] ?? '')
    if (!whole || next.startsWith(whole)) {
      // Repeats everything so far, and perhaps more: it is the whole of it.
      phrases.splice(0, phrases.length, phrase)
    } else if (whole.endsWith(next) || last.includes(next)) {
      // Already there.
      continue
    } else if (next.startsWith(last) || sharedLeadingWords(last, next) * 2 >= last.split(' ').length) {
      // The last phrase again, extended or with a word corrected.
      phrases[phrases.length - 1] = phrase
    } else {
      phrases.push(phrase)
    }
  }
  return phrases.join(' ')
}
