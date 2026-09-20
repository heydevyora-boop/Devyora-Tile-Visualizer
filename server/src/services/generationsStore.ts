import { promises as fs } from 'fs'
import path from 'path'

export interface GenerationRecord {
  generationId: string
  userName: string
  /** Data URL of the cropped tile photo the user supplied. */
  croppedImage: string
  /** Data URLs of the generated concept images. */
  generatedImages: string[]
  /** ISO 8601 timestamp. */
  timestamp: string
}

/**
 * Where the history JSON lives. Overridable so the same code can run on a
 * read-only serverless filesystem, where only /tmp is writable.
 */
const DATA_FILE =
  process.env.GENERATIONS_FILE ?? path.join(process.cwd(), 'data', 'generations.json')

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
