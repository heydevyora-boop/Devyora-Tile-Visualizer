const INVALID_FILE_MESSAGE =
  "That file isn't a photo. Please choose an image of the tile."
const FILE_TOO_LARGE_MESSAGE =
  'That photo is too large. Please choose one under 15 MB, or retake it at a smaller size.'
const FILE_READ_FAILED_MESSAGE =
  "We couldn't load that photo. Please try again, or choose another one."

/**
 * Largest gallery photo accepted. A phone camera photo is typically 2-8MB;
 * well past this the browser stalls holding it in memory as a data URL and
 * the crop step drags, with no gain in visible tile detail.
 */
const MAX_FILE_BYTES = 15 * 1024 * 1024

/**
 * Validates a photo picked from the gallery and reads it as a data URL.
 *
 * Rejects with an Error whose message is already safe to show the user.
 */
export function readTileFile(file: File): Promise<string> {
  // `accept="image/*"` only filters the picker's default view — most
  // platforms still let the user choose any file from it, so the type is
  // checked here rather than trusted.
  if (file.type && !file.type.startsWith('image/')) {
    return Promise.reject(new Error(INVALID_FILE_MESSAGE))
  }
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(new Error(FILE_TOO_LARGE_MESSAGE))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      // Catches a non-image picked on a platform that reported no MIME type
      // above: the data URL names what the file actually is.
      if (typeof result !== 'string' || !result.startsWith('data:image/')) {
        reject(new Error(INVALID_FILE_MESSAGE))
        return
      }
      resolve(result)
    }
    // Distinct from an invalid file: the file is fine, reading it failed.
    reader.onerror = () => reject(new Error(FILE_READ_FAILED_MESSAGE))
    reader.readAsDataURL(file)
  })
}
