/**
 * Context Store — in-memory conversation history and pending confirmation store.
 *
 * In a production system, persist these in Redis or a database.
 * For the hackathon, a simple in-memory Map is sufficient.
 */

'use strict';

const { randomUUID } = require('crypto');

// Map<conversationId, ConversationContext>
const conversations = new Map();

// Map<confirmationId, PendingConfirmation>  (single-use, short-lived)
const pendingConfirmations = new Map();

// Confirmations expire after 5 minutes
const CONFIRMATION_TTL_MS = 5 * 60 * 1000;

// ─── Conversation context ─────────────────────────────────────────────────────

/**
 * Get or create a conversation context.
 * Returns { conversationId, history: [] }
 */
function getOrCreate(conversationId) {
  if (conversationId && conversations.has(conversationId)) {
    return conversations.get(conversationId);
  }
  const id = conversationId || `conv_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const ctx = { conversationId: id, history: [], lastTaskId: null };
  conversations.set(id, ctx);
  return ctx;
}

/**
 * Append a turn to the conversation history.
 */
function appendTurn(conversationId, role, text) {
  const ctx = conversations.get(conversationId);
  if (!ctx) return;
  ctx.history.push({ role, content: text });
}

/**
 * Remember the most recently returned task ID for follow-up operations.
 */
function setLastTaskId(conversationId, taskId) {
  const ctx = conversations.get(conversationId);
  if (ctx) ctx.lastTaskId = taskId;
}

function getLastTaskId(conversationId) {
  return conversations.get(conversationId)?.lastTaskId ?? null;
}

// ─── Pending confirmations ────────────────────────────────────────────────────

/**
 * Store a pending tool call awaiting user confirmation.
 * Returns a new confirmationId.
 */
function storePendingConfirmation({ conversationId, toolName, args }) {
  const confirmationId = `confirm_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  pendingConfirmations.set(confirmationId, {
    conversationId,
    toolName,
    args,
    createdAt: Date.now(),
  });
  return confirmationId;
}

/**
 * Retrieve and consume a pending confirmation (single-use).
 * Returns the stored { conversationId, toolName, args } or null if expired/unknown.
 */
function consumePendingConfirmation(confirmationId) {
  const pending = pendingConfirmations.get(confirmationId);
  if (!pending) return null;

  pendingConfirmations.delete(confirmationId); // single-use

  if (Date.now() - pending.createdAt > CONFIRMATION_TTL_MS) {
    return null; // expired
  }
  return pending;
}

module.exports = {
  getOrCreate,
  appendTurn,
  setLastTaskId,
  getLastTaskId,
  storePendingConfirmation,
  consumePendingConfirmation,
};
