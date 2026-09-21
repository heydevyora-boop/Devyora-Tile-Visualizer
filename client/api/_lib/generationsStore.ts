// Deployed copy of the generation-history store used by the Vercel serverless
// function in client/api/. Vercel only uploads files under the project Root
// Directory (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/services/.
import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface GenerationRecord {
  generationId: string
  userName: string
  /**
   * The cropped tile photo: normally a Google Drive URL, uploaded by
   * generateVisualization.ts. Falls back to a base64 data URL when Drive is
   * not configured or an upload failed, so either can show up here — this
   * store just persists whatever string the client sent.
   */
  croppedImage: string
  /** The three generated concepts, in the same Drive-URL-or-base64 shape. */
  generatedImages: string[]
  /** ISO 8601 timestamp. */
  timestamp: string
}

/**
 * Where the history JSON lives.
 *
 * IMPORTANT — Vercel deployment caveat: a serverless function's filesystem is
 * read-only apart from /tmp, and /tmp is per-instance and wiped on cold start.
 * So on Vercel this file persists only for the life of one warm instance:
 * history written by one request may not be visible to the next, and is lost
 * entirely when the instance recycles. Locally (Express, server/), it is a
 * normal durable file at server/data/generations.json exactly as intended.
 *
 * To make history durable on the deployed site, point this at a real store
 * (Vercel Blob/KV, S3, a database). The route code above it does not change.
 */
const DEFAULT_FILE = process.env.VERCEL
  ? '/tmp/devyora-generations.json'
  : path.join(process.cwd(), 'data', 'generations.json')

const DATA_FILE = process.env.GENERATIONS_FILE ?? DEFAULT_FILE

/** Thrown for a malformed request body; carries the HTTP status to return. */
export class GenerationsStoreError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'GenerationsStoreError'
    this.status = status
  }
}

/**
 * Reads the stored records. A missing file is not an error — it just means
 * nothing has been saved yet. A corrupted file is treated as empty rather than
 * crashing the route, so one bad write can never take the history page down.
 */
export async function readGenerations(): Promise<GenerationRecord[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as GenerationRecord[]) : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return []
    console.error('[generationsStore] could not read store, treating as empty:', error)
    return []
  }
}

/** Validates the incoming payload and returns a clean record. */
export function toGenerationRecord(body: unknown): GenerationRecord {
  const { generationId, userName, croppedImage, generatedImages, timestamp } =
    (body ?? {}) as Partial<GenerationRecord>

  const missing: string[] = []
  if (!generationId) missing.push('generationId')
  if (!userName) missing.push('userName')
  if (!croppedImage) missing.push('croppedImage')
  if (!Array.isArray(generatedImages) || generatedImages.length === 0) {
    missing.push('generatedImages')
  }
  if (missing.length > 0) {
    throw new GenerationsStoreError(`Missing required field(s): ${missing.join(', ')}`)
  }

  return {
    generationId: String(generationId),
    userName: String(userName),
    croppedImage: String(croppedImage),
    generatedImages: (generatedImages as string[]).map(String),
    // Accept a client timestamp, but fall back to server time if absent.
    timestamp: timestamp ? String(timestamp) : new Date().toISOString(),
  }
}

/**
 * Appends a record and persists the file, creating the directory on first use.
 * Re-saving the same generationId replaces the earlier entry so a retry cannot
 * produce duplicates.
 */
export async function appendGeneration(record: GenerationRecord): Promise<GenerationRecord> {
  const existing = await readGenerations()
  const deduped = existing.filter((entry) => entry.generationId !== record.generationId)
  deduped.push(record)

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(deduped, null, 2), 'utf8')

  return record
}

/** All records, newest first. */
export async function listGenerations(): Promise<GenerationRecord[]> {
  const records = await readGenerations()
  return [...records].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}
