/**
 * Per-style application rules.
 *
 * Describes the aesthetic direction for each design style. Not wired into
 * the generate flow yet — scaffolding for when the real AI generation needs
 * to build style-aware prompts.
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
  earthy: {
    id: 'earthy',
    label: 'Earthy',
    description: 'Raw slate & fired clay',
    keywords: ['raw slate', 'fired clay', 'natural texture'],
  },
}

/** Looks up a style config by the id or label the client sends (case-insensitive). */
export function getStyleConfig(value: string): StyleConfig | undefined {
  const needle = value.trim().toLowerCase()
  return Object.values(STYLES).find(
    (style) => style.id === needle || style.label.toLowerCase() === needle,
  )
}
