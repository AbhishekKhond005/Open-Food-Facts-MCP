import { useState, useRef, useEffect, useCallback } from 'react'
import { ConnectionStatus } from './components/ConnectionStatus'
import { ChatMessage } from './components/ChatMessage'
import { MessageComposer } from './components/MessageComposer'
import { SuggestedPrompts } from './components/SuggestedPrompts'
import { TypingIndicator } from './components/TypingIndicator'
import { useChat } from './hooks/useChat'

export default function App() {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    loading,
    confirmLoading,
    sendUserMessage,
    handleConfirmation,
  } = useChat()

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    await sendUserMessage(text)
  }, [input, loading, sendUserMessage])

  const handlePromptSelect = useCallback((prompt: string) => {
    setInput(prompt)
    // Auto-send immediately
    sendUserMessage(prompt)
  }, [sendUserMessage])

  const hasMessages = messages.some(m => m.content !== '')

  return (
    <div className="app-layout">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo" aria-hidden="true">🥗</div>
          <div>
            <div className="header-title">FoodPulse</div>
            <div className="header-subtitle">Alexa+ Food Simulator · MCP Powered</div>
          </div>
        </div>
        <ConnectionStatus />
      </header>

      {/* ── Main ───────────────────────────────────────────── */}
      <main className="main-area">
        <section className="chat-panel" aria-label="Conversation">
          {/* ── Messages ─────────────────────────────────── */}
          <div className="chat-messages" role="log" aria-live="polite" aria-label="Chat messages">
            {!hasMessages && (
              <div className="empty-state">
                <div className="empty-state-icon" aria-hidden="true">🥗</div>
                <h1>Welcome to FoodPulse</h1>
                <p>
                  Your Alexa+-style food assistant. Search products, check nutrition and allergens,
                  compare foods, or find alternatives — powered by real MCP tool calls.
                </p>
              </div>
            )}

            {messages.map((msg) => {
              // Show typing indicator for empty assistant placeholders
              if (msg.role === 'assistant' && msg.content === '' && loading) {
                return <TypingIndicator key={msg.id} />
              }
              if (msg.content === '' && msg.role === 'assistant') return null

              return (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onApprove={id => handleConfirmation(id, 'approve')}
                  onReject={id => handleConfirmation(id, 'reject')}
                  confirmationLoading={confirmLoading}
                />
              )
            })}

            <div ref={bottomRef} aria-hidden="true" />
          </div>

          {/* ── Composer + Suggested prompts ─────────────── */}
          <div className="composer-area">
            <SuggestedPrompts onSelect={handlePromptSelect} disabled={loading} />
            <MessageComposer
              value={input}
              onChange={setInput}
              onSend={handleSend}
              disabled={loading}
            />
          </div>
        </section>
      </main>
    </div>
  )
}
