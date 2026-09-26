import { Navigate } from 'react-router-dom'
import { useFlow } from '../state/FlowContext'
import type { ReactNode } from 'react'

/**
 * Keeps the consultation flow behind a chosen client.
 *
 * Generated concepts are filed against a customer, so a run started without
 * one produces work that cannot be found again. Rather than discovering that
 * at the generate step — after the images have been paid for — the flow is
 * gated at its entrance and sends the salesperson to pick a client first.
 */
function RequireClient({ children }: { children: ReactNode }) {
  const { customer } = useFlow()
  if (!customer) return <Navigate to="/start" replace />
  return <>{children}</>
}

export default RequireClient
