import { useState, useCallback } from 'react'
import type { Message } from '../types/api'
import { sendMessage, sendConfirmation } from '../api/simulatorApi'

// uuid is only used client-side for message IDs (not confirmation IDs)
function makeId(): string {
  return `msg_${Math.random().toString(36).slice(2, 10)}`
}

export function useChat() {
  const [messages, setMessages]             = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [loading, setLoading]               = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const appendMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const replaceLastAssistantMessage = useCallback((msg: Message) => {
    setMessages(prev => {
      const copy = [...prev]
      // Replace the last assistant placeholder (typing indicator)
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'assistant') { copy[i] = msg; return copy }
      }
      return [...copy, msg]
    })
  }, [])

  const sendUserMessage = useCallback(async (text: string) => {
    if (loading || !text.trim()) return

    // Add user message
    appendMessage({
      id:        makeId(),
      role:      'user',
      content:   text.trim(),
      timestamp: new Date(),
    })

    setLoading(true)

    // Placeholder assistant message (shows typing indicator)
    const placeholderId = makeId()
    appendMessage({
      id:        placeholderId,
      role:      'assistant',
      content:   '',
      timestamp: new Date(),
    })

    try {
      const response = await sendMessage({ message: text.trim(), conversationId })

      if (!conversationId) setConversationId(response.conversationId)

      replaceLastAssistantMessage({
        id:              placeholderId,
        role:            'assistant',
        content:         response.assistantMessage,
        timestamp:       new Date(),
        toolCalls:       response.toolCalls,
        confirmationId:  response.confirmationId,
        pendingAction:   response.pendingAction,
        status:          response.status,
        structuredResult: response.structuredResult,
      })
    } catch (err) {
      replaceLastAssistantMessage({
        id:        placeholderId,
        role:      'assistant',
        content:   `⚠️ Could not reach the simulator backend. Is it running on port 3000?`,
        timestamp: new Date(),
        status:    'failed',
        toolCalls: [],
      })
    } finally {
      setLoading(false)
    }
  }, [loading, conversationId, appendMessage, replaceLastAssistantMessage])

  const handleConfirmation = useCallback(async (
    confirmationId: string,
    decision: 'approve' | 'reject'
  ) => {
    if (!conversationId || confirmLoading) return

    setConfirmLoading(true)

    try {
      const response = await sendConfirmation({ conversationId, confirmationId, decision })

      // Disable the confirmation card in the existing message and append the result
      setMessages(prev => prev.map(m =>
        m.confirmationId === confirmationId
          ? { ...m, confirmationId: undefined, pendingAction: undefined }
          : m
      ))

      appendMessage({
        id:              makeId(),
        role:            'assistant',
        content:         response.assistantMessage,
        timestamp:       new Date(),
        toolCalls:       response.toolCalls,
        status:          response.status,
        structuredResult: response.structuredResult,
      })
    } catch (err) {
      appendMessage({
        id:        makeId(),
        role:      'assistant',
        content:   '⚠️ Failed to process your decision. Please try again.',
        timestamp: new Date(),
        status:    'failed',
        toolCalls: [],
      })
    } finally {
      setConfirmLoading(false)
    }
  }, [conversationId, confirmLoading, appendMessage])

  return {
    messages,
    loading,
    confirmLoading,
    sendUserMessage,
    handleConfirmation,
  }
}
