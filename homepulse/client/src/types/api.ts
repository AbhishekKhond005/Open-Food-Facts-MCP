/**
 * Shared TypeScript types for the HomePulse frontend ↔ simulator API contract.
 *
 * Keep these in sync with the spec in Section 7 of the implementation plan.
 * These types should NEVER include MCP-internal fields.
 */

// ─── Tool trace ───────────────────────────────────────────────────────────────

export interface ToolCallEntry {
  toolName: string
  status: 'success' | 'error' | 'awaiting_confirmation' | 'cancelled'
  summary: string
}

// ─── Pending action (shown in confirmation card) ──────────────────────────────

export interface PendingAction {
  toolName: string
  summary:  string
}

// ─── Chat response ────────────────────────────────────────────────────────────

export interface ChatResponse {
  conversationId:   string
  status:           'completed' | 'awaiting_confirmation' | 'failed'
  assistantMessage: string
  toolCalls:        ToolCallEntry[]

  // Present only when status === 'awaiting_confirmation'
  confirmationId?:  string
  pendingAction?:   PendingAction

  // Present for structured task data (optional enrichment)
  structuredResult?: unknown
}

// ─── Confirmation request / response ─────────────────────────────────────────

export interface ConfirmRequest {
  conversationId: string
  confirmationId: string
  decision:       'approve' | 'reject'
}

// Confirmation response reuses ChatResponse shape

// ─── Chat request ─────────────────────────────────────────────────────────────

export interface ChatRequest {
  message:          string
  conversationId?:  string
}

// ─── Status ───────────────────────────────────────────────────────────────────

export interface StatusResponse {
  simulator:           'ready' | 'error'
  mcpServer:           'connected' | 'unavailable'
  discoveredToolCount: number
  error?:              string
}

// ─── Message model (UI-local, not from API) ──────────────────────────────────

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id:               string
  role:             MessageRole
  content:          string
  timestamp:        Date
  toolCalls?:       ToolCallEntry[]
  confirmationId?:  string
  pendingAction?:   PendingAction
  status?:          ChatResponse['status']
  structuredResult?: unknown
}
