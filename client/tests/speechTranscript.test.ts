/**
 * Dictation must show what was said once, whichever way the browser reports
 * it — the Android repeats turned three words into lines of text.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transcriptOf } from '../src/utils/speechTranscript.ts'

const results = (...phrases: string[]) => phrases.map((transcript) => ({ isFinal: true, 0: { transcript } }))

test('Android, each result repeating the words before it (the reported case)', () => {
  assert.equal(
    transcriptOf(results('isko', 'isko ball', 'isko ball per', 'isko ball per lagao', 'isko ball per lagao entrance', 'isko ball per lagao entrance call per'), true),
    'isko ball per lagao entrance call per',
  )
})

test('Android, the same result delivered twice', () => {
  assert.equal(transcriptOf(results('isko ball per', 'isko ball per'), true), 'isko ball per')
})

test('Android, an earlier word corrected as more is heard', () => {
  assert.equal(transcriptOf(results('isko bol', 'isko ball per lagao'), true), 'isko ball per lagao')
})

test('Android, capitals and punctuation differing between repeats', () => {
  assert.equal(transcriptOf(results('Isko ball.', 'isko ball per lagao'), true), 'isko ball per lagao')
})

test('desktop Chrome: separate phrases, each its own result, all kept — even two starting alike', () => {
  assert.equal(transcriptOf(results('warm lighting rakhna hai', ' vanity floating honi chahiye'), false), 'warm lighting rakhna hai vanity floating honi chahiye')
  assert.equal(transcriptOf(results('isko ball', 'isko wall pe'), false), 'isko ball isko wall pe')
})

test('the same separate phrases on a phone are also kept', () => {
  assert.equal(transcriptOf(results('warm lighting rakhna hai', ' vanity floating honi chahiye'), true), 'warm lighting rakhna hai vanity floating honi chahiye')
})

test('a new phrase after a pause is added, not swallowed', () => {
  assert.equal(transcriptOf(results('isko ball per lagao', 'entrance wall pe bhi'), true), 'isko ball per lagao entrance wall pe bhi')
})

test('empty results add nothing', () => {
  assert.equal(transcriptOf(results('', '  ', 'isko'), true), 'isko')
})
