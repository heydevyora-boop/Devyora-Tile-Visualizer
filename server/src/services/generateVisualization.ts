import { randomUUID } from 'crypto'

export interface GenerateVisualizationInput {
  tileImage: string
  space: string
  style: string
  tileSize?: string
}

export interface GenerateVisualizationResult {
  generationId: string
  images: string[]
  space: string
  style: string
  tileSize: string
}

// Same stock placeholder images currently used in the frontend's Results.tsx,
// reused here so the mock response looks like a real generation result.
const PLACEHOLDER_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDP5oA3AvnTsObA-oOr4trg44RxFMMyW1m2E5Wj_q9lD8zAQpMucUrLBk1i1LS3-0QMe5H1M9vIcaNV7UZer4PYV8q16dhpMVMIWdKyqidxgMR1C40tcJKfupQba_dFnRvQyL9_ZbtHz2N5OfsvGA__l8k4ov_w-LRcpxFLSl06yQWvUZ1yQZy9E1HM8OdDMZC1QbbLRXfpckIN3-C89gipLFBzNYdi0iCqSJYptKIrO6cqG7S7utJooQ',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDEpIiiTMWE3tlqPgacanwBWvrlqlG6yioPf75-SOnp0uAf0O8cNzvnaO_1Toqhj7hHHiF4gXu-W-auEGwIJhM3ydoh1__OhYTjgizqJbYzmWcaw58wxITXm3jtZm2xfURG3ahEkSWTZwMrVpu5B8Ft2kEWlOyzU1xcW1nX_jbw5v1u64B9pkwoNH9O9GHqfq7KmbLVw6SzRU8Bzq5bc-NRnbM7FdIOtlDbEmwzzkNrZH9AZqqF7uIg3w',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB00wtIuZZffbITcFtmcFsbTCdn_bhuz-jF0VLOqT77jqOnOpV6LFOH6AloZZVAl4HlC-YeZDpywkX1PQcE2T87vfmpgcqLRM8kDsl3ovTJTN6hP4TutpbLN9O6lgXofAVjw4LXYm9Ouaa2Ba_sZ7T6-OE78YIB-N5kIqjI6sx8tWWEMEmHTtt7znsHib_w4XqSX3C1i2uJ3NlEssWvq3EoaxkyeIxr5WV_KUfgHVSkiyzXdhryU5hFNA',
]

const MOCK_DELAY_MS = 1500

/**
 * Generates an architectural tile visualization for the given input.
 *
 * This is currently a MOCK implementation: it simulates the latency of a
 * real AI provider call and returns placeholder images. The route calling
 * this function does not need to change when this is swapped for a real
 * AI provider call later.
 */
export function generateVisualization(
  input: GenerateVisualizationInput,
): Promise<GenerateVisualizationResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        generationId: randomUUID(),
        images: PLACEHOLDER_IMAGES,
        space: input.space,
        style: input.style,
        tileSize: input.tileSize ?? '',
      })
    }, MOCK_DELAY_MS)
  })
}
