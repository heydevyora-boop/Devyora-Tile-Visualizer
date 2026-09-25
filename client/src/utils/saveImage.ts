/**
 * Saving a concept image to the device.
 *
 * This is the "Save Image" half of the two actions on a concept, and it is
 * deliberately nothing to do with the client's record: it puts a copy in the
 * salesperson's hands — to WhatsApp to the customer, to keep on the phone —
 * and the showroom's permanent record is untouched by it.
 *
 * Phones and desktops disagree about what saving means, so this tries the one
 * that actually reaches the gallery first:
 *
 *   1. The share sheet, where the browser supports sharing a file. On iOS and
 *      Android that sheet is where "Save Image" / "Save to Photos" lives, and
 *      it is the only route into the gallery a web page has.
 *   2. A download, which is what a desktop browser does with it.
 *
 * A cross-origin image cannot be downloaded by simply setting `download` on a
 * link — the attribute is ignored and the browser navigates instead — so the
 * bytes are fetched first and handed over as a blob.
 */

/** A filename a salesperson can find again, rather than a random id. */
function fileNameFor(label: string, type: string): string {
  const extension = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `devyora-${slug || 'concept'}.${extension}`
}

/** Turns any image reference — data URL or remote — into bytes we can hand over. */
async function toBlob(src: string): Promise<Blob> {
  const response = await fetch(src)
  if (!response.ok) throw new Error(`Could not read the image (${response.status}).`)
  return response.blob()
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** How the image was saved, so the screen can say something true about it. */
export type SaveImageOutcome = 'shared' | 'downloaded'

export async function saveImageToDevice(src: string, label: string): Promise<SaveImageOutcome> {
  const blob = await toBlob(src)
  const fileName = fileNameFor(label, blob.type)

  const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })
  const share = navigator.share
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await share.call(navigator, { files: [file], title: label })
      return 'shared'
    } catch (error) {
      // Dismissing the share sheet is a choice, not a failure: fall through to
      // a download only when the sheet itself could not be used.
      if (error instanceof DOMException && error.name === 'AbortError') throw error
    }
  }

  triggerDownload(blob, fileName)
  return 'downloaded'
}
