import type { TileFormat } from './api'

/**
 * A tile size, shown the way the showroom named it.
 *
 * The catalogue format's own label wins when the admin set one — "Large
 * Format Slab" reads better than "1200 × 2400 mm" on a selection screen. With
 * no format at all (a custom size the salesperson typed in) or no label set,
 * this falls back to the dimensions themselves, parsed from the flow's own
 * "1200x2400" id rather than a second lookup, so it works identically for a
 * size that never came from the catalogue.
 */
export function formatTileSize(tileSize: string | null, format: TileFormat | null): string | null {
  if (format?.label) return format.label
  if (format) return `${format.lengthMm} × ${format.breadthMm} mm`
  if (!tileSize) return null
  const match = tileSize.match(/^(\d+)x(\d+)$/)
  return match ? `${match[1]} × ${match[2]} mm` : tileSize
}

/**
 * A tile size id such as "1200x600" as the two numbers it stands for.
 *
 * The id is the flow's canonical size (the catalogue and the custom fields both
 * produce it), so this is a reading of structured data rather than a guess at
 * free text. Null for anything that is not exactly two whole numbers, so a
 * malformed size is refused rather than sent as something it is not.
 */
export function parseTileSizeId(
  tileSize: string | null,
): { lengthMm: number; breadthMm: number } | null {
  const match = tileSize?.match(/^(\d+)x(\d+)$/)
  if (!match) return null
  return { lengthMm: Number(match[1]), breadthMm: Number(match[2]) }
}
