import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext'
import { ApiError, apiGet, type DesignOption, type DesignOptionKind } from './api'
import { dedupeByName } from './dedupeByName'

/**
 * One of the showroom's own option lists — joint widths, laying patterns,
 * highlighter locations — read from the server so the showroom can change a
 * list without a redeploy.
 *
 * `options` stays null until the list has arrived, which is how a screen tells
 * "still loading" from "loaded and empty".
 */
export function useDesignOptions(kind: DesignOptionKind): {
  options: DesignOption[] | null
  error: string | null
} {
  const { token } = useAuth()
  const [options, setOptions] = useState<DesignOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const data = await apiGet<DesignOption[]>(
          `/api/design-options?kind=${kind}`,
          token,
          controller.signal,
        )
        // The store prevents duplicate names at the source; the screen also
        // defends itself, because it is the one place a duplicate would be seen.
        if (!controller.signal.aborted) setOptions(dedupeByName(data))
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load the options.')
      }
    })()
    return () => controller.abort()
  }, [kind, token])

  return { options, error }
}
