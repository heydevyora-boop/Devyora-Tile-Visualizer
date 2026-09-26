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
