// Local-dev copy of the Google Drive uploader used by the Express server.
// KEEP IN SYNC with the deployed Vercel copy in client/api/_lib/googleDrive.ts.
import { google } from 'googleapis'
import { Readable } from 'node:stream'

let cachedDrive: ReturnType<typeof google.drive> | null = null

/**
 * Lazily builds and caches an authenticated Drive client for the lifetime of
 * this serverless instance — a cold start rebuilds it, a warm invocation
 * reuses it. Throws (rather than returning null) so callers get a clear
 * message naming exactly which env var is missing.
 */
function getDriveClient(): ReturnType<typeof google.drive> {
  if (cachedDrive) return cachedDrive

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) {
    throw new Error(
      'Google Drive is not configured (missing GOOGLE_SERVICE_ACCOUNT_EMAIL or ' +
        'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).',
    )
  }

  // A PEM private key stored in a Vercel env var arrives as one line with
  // literal backslash-n two-character sequences in place of real line breaks
  // (env vars cannot contain actual newlines), so the key has to be
  // reconstructed before the auth library can parse it.
  const privateKey = rawKey.replace(/\\n/g, '\n')

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })

  cachedDrive = google.drive({ version: 'v3', auth })
  return cachedDrive
}

/**
 * True once the shared credential env vars are present. Checked before
 * attempting an upload so a not-yet-configured deployment logs one clear line
 * instead of a stack trace, and callers can skip straight to their base64
 * fallback. Does not check either folder id — those are validated per call,
 * in uploadImageToDrive, against whichever one that specific call needs.
 */
export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  )
}

/**
 * Uploads a base64-encoded image to the given Drive folder, sets it shareable
 * by anyone with the link, and returns a URL that renders as an image inline
 * (works directly in an <img src>).
 *
 * Deliberately returns drive.google.com/thumbnail?id=…, not the more commonly
 * pasted drive.google.com/uc?export=view&id=… — the uc/export=view endpoint
 * intermittently serves Drive's "can't scan this file for viruses" HTML
 * interstitial instead of the image bytes, even for small images with public
 * link-sharing already on. /thumbnail is Drive's endpoint built specifically
 * for embedding and does not show that interstitial. sz=w2000 asks for a
 * result no narrower than 2000px so it stays sharp at full-screen lightbox
 * size; Drive caps the maximum it will actually return regardless.
 *
 * Caveat: this URL format is stable in practice but, like the uc/export
 * endpoint, is not part of Drive's documented public API surface — Google
 * could change its behaviour without notice. If that ever happens, the fix is
 * confined to this one return statement.
 */
export async function uploadImageToDrive(
  base64Data: string,
  fileName: string,
  mimeType: string,
  folderId: string,
): Promise<string> {
  if (!folderId) {
    throw new Error('Google Drive is not configured (missing folder id).')
  }
  const drive = getDriveClient()
  const buffer = Buffer.from(base64Data, 'base64')

  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId], mimeType },
    media: { mimeType, body: Readable.from(buffer) },
    // supportsAllDrives is a no-op for a normal My Drive folder and required
    // if the shared folder ever turns out to live in a Shared Drive instead.
    supportsAllDrives: true,
    fields: 'id',
  })

  const fileId = created.data.id
  if (!fileId) {
    throw new Error('Google Drive did not return a file id after upload.')
  }

  // Anyone-with-the-link viewing is what lets the URL below render without
  // the viewer being signed in to a Google account that has been shared with.
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  })

  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`
}
