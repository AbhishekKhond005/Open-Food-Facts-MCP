import { useRef, useEffect, type KeyboardEvent, type FormEvent } from 'react'

interface MessageComposerProps {
  value:       string
  onChange:    (v: string) => void
  onSend:      () => void
  disabled?:   boolean
}

export function MessageComposer({
  value,
  onChange,
  onSend,
  disabled = false,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [value])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim()) onSend()
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim()) onSend()
  }

  return (
    <form className="composer-form" onSubmit={handleSubmit} aria-label="Message composer">
      <textarea
        ref={textareaRef}
        id="message-input"
        className="composer-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about chores, add a task, or search your notes…"
        disabled={disabled}
        rows={1}
        aria-label="Type your message"
        aria-multiline="true"
      />
      <button
        id="send-btn"
        type="submit"
        className="composer-send-btn"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        title="Send (Enter)"
      >
        ↑
      </button>
    </form>
  )
}
