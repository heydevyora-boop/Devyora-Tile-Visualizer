import type { Area } from 'react-easy-crop'

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
 * the image model while keeping the payload well under 1 MB.
 */
const MAX_EXPORT_EDGE = 1400

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

  const croppedCanvas = document.createElement('canvas')
  const croppedCtx = croppedCanvas.getContext('2d')
  if (!croppedCtx) {
    throw new Error('Canvas 2D context is not available')
  }

  // Downscale only when the crop is larger than the export cap; never upscale.
  const scale = Math.min(1, MAX_EXPORT_EDGE / Math.max(pixelCrop.width, pixelCrop.height))
  const outputWidth = Math.max(1, Math.round(pixelCrop.width * scale))
  const outputHeight = Math.max(1, Math.round(pixelCrop.height * scale))

  croppedCanvas.width = outputWidth
  croppedCanvas.height = outputHeight
  croppedCtx.imageSmoothingEnabled = true
  croppedCtx.imageSmoothingQuality = 'high'
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  )

  return croppedCanvas.toDataURL('image/jpeg', 0.9)
}
