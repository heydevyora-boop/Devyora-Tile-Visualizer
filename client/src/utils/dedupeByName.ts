/**
 * The last line of defence against showing the same option twice.
 *
 * The store now prevents duplicate (kind, name) rows at the source, and
 * heals any that were already there before that existed. This exists for
 * the layer above that: whatever the API returns, the screen that renders
 * it never shows a name more than once, so a future data issue — a bad
 * import, a manual edit, a bug nobody has thought of yet — shows up as a
 * missing option rather than a repeated one, which is the safer failure.
 *
 * Keeps the first occurrence, matching the order the list was already in.
 */
export function dedupeByName<T extends { name: string }>(options: T[]): T[] {
  const seen = new Set<string>()
  return options.filter((option) => {
    const key = option.name.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
