import { useState, useEffect, useRef } from 'react'
import type { StatusResponse } from '../types/api'
import { fetchStatus } from '../api/simulatorApi'

interface ConnectionStatusProps {
  onRefresh?: () => void
}

export function ConnectionStatus({ onRefresh }: ConnectionStatusProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [checking, setChecking] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const check = async () => {
    setChecking(true)
    try {
      const s = await fetchStatus()
      setStatus(s)
    } catch {
      setStatus({ simulator: 'error', mcpServer: 'unavailable', discoveredToolCount: 0, error: 'Backend unreachable' })
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    check()
    intervalRef.current = setInterval(check, 15_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  // Notify parent when status changes
  useEffect(() => { onRefresh?.() }, [status])

  const cls = checking
    ? 'checking'
    : status?.mcpServer === 'connected'
    ? 'connected'
    : 'unavailable'

  const label = checking
    ? 'Checking…'
    : status?.mcpServer === 'connected'
    ? `MCP connected · ${status.discoveredToolCount} tool${status.discoveredToolCount !== 1 ? 's' : ''}`
    : 'MCP unavailable'

  return (
    <button
      id="connection-status-btn"
      className={`connection-status ${cls}`}
      onClick={check}
      title={status?.error ?? 'Click to refresh status'}
      aria-label={`Connection status: ${label}`}
    >
      <span className="status-dot" aria-hidden="true" />
      {label}
    </button>
  )
}
