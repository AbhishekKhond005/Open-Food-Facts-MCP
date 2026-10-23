/**
 * API client — all calls to the simulator backend.
 * The browser NEVER calls the MCP server directly.
 */

import type { ChatRequest, ChatResponse, ConfirmRequest, StatusResponse } from '../types/api'

const BASE = import.meta.env.VITE_SIMULATOR_API_URL ?? ''

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

export async function sendMessage(req: ChatRequest): Promise<ChatResponse> {
  return post('/api/v1/chat', req)
}

export async function sendConfirmation(req: ConfirmRequest): Promise<ChatResponse> {
  return post('/api/v1/chat/confirm', req)
}

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch(`${BASE}/api/v1/status`)
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`)
  return res.json()
}
