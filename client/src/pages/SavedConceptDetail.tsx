import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, type SavedVisualisation } from '../utils/api'
import { saveImageToDevice } from '../utils/saveImage'
import './Workspace.css'

function formatWhen(timestamp: string): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp
  return `${parsed.toLocaleDateString()} · ${parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/** One row of the record, left out entirely when there is nothing to say. */
function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

/**
 * A saved concept, opened from a client's record.
 *
 * This reads the stored record and shows the stored image. It never asks for a
 * new one: weeks after a customer agreed a concept, the thing they agreed is
 * what has to appear — a regenerated image would be a different room with the
 * same description, which is worse than useless in front of a customer.
 */
function SavedConceptDetail() {
  const { savedId = '' } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()

  const [record, setRecord] = useState<SavedVisualisation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingImage, setSavingImage] = useState(false)
  const [deviceMessage, setDeviceMessage] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const saved = await apiGet<SavedVisualisation>(
          `/api/generations?id=${encodeURIComponent(savedId)}`,
          token,
          controller.signal,
        )
        if (!controller.signal.aborted) setRecord(saved)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not open this saved concept.')
      }
    })()
    return () => controller.abort()
  }, [savedId, token])

  const handleSaveImage = async () => {
    if (!record || savingImage) return
    setSavingImage(true)
    setDeviceMessage(null)
    try {
      const outcome = await saveImageToDevice(
        record.image,
        `${record.customerName ?? 'concept'} ${record.space ?? ''}`.trim(),
      )
      setDeviceMessage(outcome === 'shared' ? 'Sent to your device.' : 'Downloaded to this device.')
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setError('That image could not be saved to this device.')
    } finally {
      setSavingImage(false)
    }
  }

  const application = record?.spacePath?.length
    ? record.spacePath.map((node) => node.name).join(' → ')
    : null
  const joint = record
    ? record.jointName ?? (record.jointWidthMm !== null ? `${record.jointWidthMm} mm` : null)
    : null

  return (
    <AppShell title={record?.space ?? 'Saved concept'}>
      {error && (
        <p className="ws__error" role="alert">
          {error}
        </p>
      )}

      {!error && record === null && <p className="ws__loading">Loading…</p>}

      {record && (
        <>
          <img
            className="ws__hero"
            src={record.image}
            alt={`${record.space ?? 'Saved'} concept for ${record.customerName ?? 'this client'}`}
          />

          {deviceMessage && (
            <p className="ws__note" role="status">
              {deviceMessage}
            </p>
          )}

          <div className="ws__actions">
            <button
              className="ws__action"
              type="button"
              disabled={savingImage}
              onClick={() => void handleSaveImage()}
            >
              <span className="material-symbols-outlined">download</span>
              <span>{savingImage ? 'Saving…' : 'Save Image'}</span>
            </button>
            {record.customerId && (
              <button
                className="ws__action"
                type="button"
                onClick={() => navigate(`/clients/${record.customerId}`)}
              >
                <span className="material-symbols-outlined">person</span>
                <span>Open client</span>
              </button>
            )}
          </div>

          <h2 className="ws__section-title">The tile</h2>
          <div className="ws__thumbs ws__thumbs--large">
            {record.originalTileImage && (
              <img className="ws__thumb" src={record.originalTileImage} alt="Original tile photo" />
            )}
            {record.croppedTileImage && (
              <img className="ws__thumb" src={record.croppedTileImage} alt="Cropped tile" />
            )}
          </div>

          <h2 className="ws__section-title">How this was made</h2>
          <dl className="ws__definition">
            <Row label="Salesperson" value={record.salespersonName} />
            <Row label="Architect/contractor" value={record.architectName} />
            <Row label="Client" value={record.customerName} />
            <Row label="Tile size" value={record.tileSize} />
            <Row label="Space" value={record.space} />
            <Row label="Application" value={application} />
            <Row label="Design style" value={record.styleName} />
            <Row label="Joint" value={joint} />
            <Row label="Laying pattern" value={record.patternName} />
            <Row label="Additional requirement" value={record.additionalRequirement} />
            <Row label="Version" value={`Concept ${record.revision}`} />
            <Row
              label="Asked to change"
              value={record.revisionReasons.length ? record.revisionReasons.join(', ') : null}
            />
            <Row label="In their words" value={record.revisionNote || null} />
            <Row label="Generated" value={formatWhen(record.generatedAt)} />
            <Row label="Saved" value={formatWhen(record.savedAt)} />
          </dl>
        </>
      )}
    </AppShell>
  )
}

export default SavedConceptDetail
