export function TypingIndicator() {
  return (
    <div className="message-row assistant" aria-live="polite" aria-label="HomePulse is thinking">
      <div className="message-avatar" aria-hidden="true">🏠</div>
      <div className="typing-indicator">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  )
}
