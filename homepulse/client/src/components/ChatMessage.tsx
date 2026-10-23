import type { Message } from '../types/api'
import { ActionTracePanel } from './ActionTracePanel'
import { ConfirmationCard } from './ConfirmationCard'

interface ChatMessageProps {
  message:             Message
  onApprove:           (confirmationId: string) => void
  onReject:            (confirmationId: string) => void
  confirmationLoading?: boolean
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const AVATAR: Record<string, string> = {
  user:      '👤',
  assistant: '🥗',
}

export function ChatMessage({
  message,
  onApprove,
  onReject,
  confirmationLoading = false,
}: ChatMessageProps) {
  const isUser = message.role === 'user'
  const failedClass = message.status === 'failed' ? 'failed' : ''

  return (
    <div
      className={`message-row ${message.role} ${failedClass}`}
      aria-label={`${message.role === 'user' ? 'You' : 'HomePulse'}: ${message.content}`}
    >
      <div className="message-avatar" aria-hidden="true">
        {AVATAR[message.role]}
      </div>

      <div className="message-body">
        {/* Bubble */}
        {message.content && (
          <div className="message-bubble">
            {message.content}
          </div>
        )}

        {/* Confirmation card (before tool executes) */}
        {!isUser &&
          message.status === 'awaiting_confirmation' &&
          message.confirmationId &&
          message.pendingAction && (
            <ConfirmationCard
              pendingAction={message.pendingAction}
              confirmationId={message.confirmationId}
              onApprove={onApprove}
              onReject={onReject}
              loading={confirmationLoading}
            />
          )}

        {/* Action trace */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <ActionTracePanel toolCalls={message.toolCalls} />
        )}

        {/* Timestamp */}
        <span className="message-timestamp">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}
