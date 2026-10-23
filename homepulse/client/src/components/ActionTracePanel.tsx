import type { ToolCallEntry } from '../types/api'

const STATUS_ICON: Record<string, string> = {
  success:               '✓',
  error:                 '✗',
  awaiting_confirmation: '⏸',
  cancelled:             '—',
}

interface ActionTracePanelProps {
  toolCalls: ToolCallEntry[]
}

export function ActionTracePanel({ toolCalls }: ActionTracePanelProps) {
  if (toolCalls.length === 0) return null

  return (
    <div className="action-trace" role="log" aria-label="Action trace">
      {toolCalls.map((tc, i) => (
        <div key={i} className={`trace-entry ${tc.status}`}>
          <span className="trace-icon" aria-hidden="true">
            {STATUS_ICON[tc.status] ?? '·'}
          </span>
          <div>
            <span className="trace-tool">{tc.toolName}</span>
            {' '}
            <span className="trace-summary">{tc.summary}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
