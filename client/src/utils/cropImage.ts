/**
 * A crop rectangle in the source photo's own pixels, which is what FreeCrop
 * produces. Declared here rather than imported from the component so this
 * utility stays independent of whatever draws the selection.
 */
export interface Area {
  x: number
  y: number
  width: number
  height: number
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.crossOrigin = 'anonymous'
    image.src = url
  })
}

function toRadian(degree: number) {
  return (degree * Math.PI) / 180
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = toRadian(rotation)
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

/**
 * Longest edge of the exported crop, in pixels.
 *
 * A phone camera crop can be 3000px+, which encodes to a multi-megabyte data
 * URL — slow to upload on showroom wifi and large enough to exceed the API's
 * request body limit. 1400px keeps the tile's grain and veining legible for
 * the image model; EXPORT_STEPS below keeps the payload within the upload.
 */
const MAX_EXPORT_EDGE = 1400

/**
 * Largest data URL one tile crop may become. The generate request carries up
 * to two crops and refuses more than 4 MB of photos (api/generate.ts), so each
 * stays under half of that with room for the rest of the body.
 */
const MAX_EXPORT_DATA_URL_CHARS = 1_900_000

/**
 * Export attempts, best first: the longest edge and the JPEG quality.
 *
 * At quality 1.0 the browser keeps full colour resolution (4:4:4); below it
 * the colour is stored at half resolution (4:2:0), which smears fine coloured
 * veins and speckles into the stone around them. A phone photo at 1400px and
 * 1.0 is usually too large for the upload, so a slightly smaller crop at full
 * colour comes before a full-size one at half colour; the last steps only
 * catch a crop too detailed for any of the others.
 */
const EXPORT_STEPS = [
  { edge: MAX_EXPORT_EDGE, quality: 1 },
  { edge: 1200, quality: 1 },
  { edge: 1024, quality: 1 },
  { edge: MAX_EXPORT_EDGE, quality: 0.95 },
  { edge: MAX_EXPORT_EDGE, quality: 0.9 },
]

/**
 * The crop in whole source pixels, entirely inside the photo.
 *
 * The selection arrives in fractional pixels. Rounding its position and its
 * size separately can push it one pixel past the photo's edge, and that pixel
 * exports as a black line along the crop, which reads as a dark joint on the
 * tile. Rounding the edges instead keeps it inside.
 */
export function normaliseCropRect(crop: Area, imageWidth: number, imageHeight: number): Area {
  const left = Math.min(Math.max(Math.round(crop.x), 0), imageWidth - 1)
  const top = Math.min(Math.max(Math.round(crop.y), 0), imageHeight - 1)
  const right = Math.min(Math.max(Math.round(crop.x + crop.width), left + 1), imageWidth)
  const bottom = Math.min(Math.max(Math.round(crop.y + crop.height), top + 1), imageHeight)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * The crop as a JPEG at the given longest edge — never enlarged, aspect ratio
 * kept — on white, since JPEG has no transparency and a transparent pixel
 * exports as black: a cut-out tile (a PNG on a transparent background) would
 * otherwise reach the model with black corners that read as part of the tile.
 */
function exportCrop(source: HTMLCanvasElement, crop: Area, edge: number, quality: number): string {
  const scale = Math.min(1, edge / Math.max(crop.width, crop.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(crop.width * scale))
  canvas.height = Math.max(1, Math.round(crop.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context is not available')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  canvas.width = 0
  canvas.height = 0
  return dataUrl
}

export async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
): Promise<string> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context is not available')
  }

  const rotRad = toRadian(rotation)
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation)

  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.translate(-image.width / 2, -image.height / 2)
  ctx.drawImage(image, 0, 0)

  const crop = normaliseCropRect(pixelCrop, canvas.width, canvas.height)

  // The best export that still fits the upload.
  let dataUrl = ''
  for (const { edge, quality } of EXPORT_STEPS) {
    dataUrl = exportCrop(canvas, crop, edge, quality)
    if (dataUrl.length <= MAX_EXPORT_DATA_URL_CHARS) break
  }

  // Release the backing store rather than waiting for a collection. This
  // canvas is sized to the whole source photo — a 12MP phone shot is ~48MB of
  // pixels — and a showroom device runs this once per consultation all day
  // without reloading the page. (Each export canvas releases its own.)
  canvas.width = 0
  canvas.height = 0

  return dataUrl
}
