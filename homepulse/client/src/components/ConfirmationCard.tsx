import type { PendingAction } from '../types/api'

interface ConfirmationCardProps {
  pendingAction:    PendingAction
  confirmationId:   string
  onApprove:        (confirmationId: string) => void
  onReject:         (confirmationId: string) => void
  loading?:         boolean
}

export function ConfirmationCard({
  pendingAction,
  confirmationId,
  onApprove,
  onReject,
  loading = false,
}: ConfirmationCardProps) {
  return (
    <div
      className="confirmation-card"
      role="alertdialog"
      aria-labelledby={`confirm-title-${confirmationId}`}
      aria-describedby={`confirm-desc-${confirmationId}`}
    >
      <div className="confirmation-title" id={`confirm-title-${confirmationId}`}>
        <span aria-hidden="true">⚠️</span> Confirmation required
      </div>

      <div className="confirmation-summary" id={`confirm-desc-${confirmationId}`}>
        {pendingAction.summary}
      </div>

      <div className="confirmation-tool">
        Tool: <strong>{pendingAction.toolName}</strong>
      </div>

      <div className="confirmation-actions">
        <button
          id={`confirm-approve-${confirmationId}`}
          className="btn btn-approve"
          onClick={() => onApprove(confirmationId)}
          disabled={loading}
          aria-label="Approve this action"
        >
          {loading ? <span className="spin">⏳</span> : '✓'} Approve
        </button>
        <button
          id={`confirm-reject-${confirmationId}`}
          className="btn btn-reject"
          onClick={() => onReject(confirmationId)}
          disabled={loading}
          aria-label="Cancel this action"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  )
}
