/**
 * Per-style application rules.
 *
 * Describes the aesthetic direction for each design style. Consumed by
 * buildGenerationPrompt.ts to build style-aware prompts.
 */

export interface StyleConfig {
  /** Stable identifier, matching the values the client sends. */
  id: string
  /** Human-readable label. */
  label: string
  /** Short descriptor shown alongside the style in the client. */
  description: string
  /** Keywords to feed into the eventual generation prompt. */
  keywords: string[]
}

export const STYLES: Record<string, StyleConfig> = {
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    description: 'Monolithic silence & stone',
    keywords: ['monolithic', 'uncluttered', 'muted palette', 'clean lines'],
  },
  modern: {
    id: 'modern',
    label: 'Modern',
    description: 'Crisp geometry & steel',
    keywords: ['crisp geometry', 'steel accents', 'high contrast'],
  },
  luxury: {
    id: 'luxury',
    label: 'Luxury',
    description: 'Rich bookmatched veining',
    keywords: ['bookmatched veining', 'polished finish', 'brass detailing'],
  },
  warm: {
    id: 'warm',
    label: 'Warm',
    description: 'Sunlit terracotta & timber',
    keywords: ['terracotta', 'timber joinery', 'warm daylight'],
  },
  contemporary: {
    id: 'contemporary',
    label: 'Contemporary',
    description: 'Curved forms & fluidity',
    keywords: ['fluid sculptural forms', 'curved plaster walls', 'brushed brass framing', 'soft architectural shadows'],
  },
  earthy: {
    id: 'earthy',
    label: 'Earthy',
    description: 'Raw slate & fired clay',
    keywords: ['raw slate', 'fired clay', 'natural texture'],
  },
  indian: {
    id: 'indian',
    label: 'Indian',
    description: 'Sandstone jaali & brass',
    keywords: ['hand-carved sandstone jaali fretwork', 'heritage teak accents', 'brushed copper details', 'moody atmospheric lighting'],
  },
  elegant: {
    id: 'elegant',
    label: 'Elegant',
    description: 'Quiet symmetry & poise',
    keywords: ['neoclassical mouldings', 'herringbone parquet', 'honed marble', 'diffused daylight'],
  },
}

/** Looks up a style config by the id or label the client sends (case-insensitive). */
export function getStyleConfig(value: string): StyleConfig | undefined {
  const needle = value.trim().toLowerCase()
  return Object.values(STYLES).find(
    (style) => style.id === needle || style.label.toLowerCase() === needle,
  )
}

/** The value the client sends when the salesperson picks "Surprise Me". */
const SURPRISE_VALUE = 'surprise'

/** True when the raw style value from the client means "let the system choose". */
export function isSurpriseStyle(value: string): boolean {
  return value.trim().toLowerCase() === SURPRISE_VALUE
}

/**
 * Picks a random style from the full list. Any style is a valid surprise —
 * nothing is excluded.
 */
export function pickRandomStyle(): StyleConfig {
  const all = Object.values(STYLES)
  return all[Math.floor(Math.random() * all.length)]
}

/**
 * Resolves the style value to use for generation: if the client sent
 * "surprise", picks a random real style; otherwise returns the value
 * unchanged. This is the single place "Surprise Me" is triggered from, so
 * both prompt building and the API response stay consistent.
 */
export function resolveStyleValue(rawStyle: string): string {
  return isSurpriseStyle(rawStyle) ? pickRandomStyle().id : rawStyle
}
