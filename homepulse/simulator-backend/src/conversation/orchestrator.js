/**
 * Orchestrator — the main business logic for a single chat turn.
 *
 * Ties together:
 *  - contextStore (conversation & confirmation state)
 *  - planner (intent → tool selection)
 *  - toolRegistry (live MCP tool catalogue)
 *  - mcpClient (tools/call)
 *  - schemaValidation (pre-flight argument check)
 *  - traceFormatter (safe result → UI)
 */

'use strict';

const contextStore      = require('./contextStore');
const { plan }          = require('./planner');
const toolRegistry      = require('../mcp/toolRegistry');
const mcpClient         = require('../mcp/client');
const { validateArgs }  = require('../mcp/schemaValidation');
const {
  formatTraceEntry,
  buildAssistantMessage,
  extractTaskId,
}                       = require('../traces/traceFormatter');
const { McpTransportError, McpProtocolError } = require('../mcp/errors');

const MAX_TOOL_CALLS = parseInt(process.env.MCP_MAX_TOOL_CALLS_PER_TURN || '8', 10);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Process a user chat message.
 *
 * @param {string} message
 * @param {string|undefined} conversationId
 * @returns {object}  Application-level response (see spec §7)
 */
async function handleChat(message, conversationId) {
  const ctx = contextStore.getOrCreate(conversationId);
  contextStore.appendTurn(ctx.conversationId, 'user', message);

  // Ensure MCP is initialized before proceeding
  let tools;
  try {
    tools = await toolRegistry.getTools();
  } catch (err) {
    return mcpUnavailableResponse(ctx.conversationId, err);
  }

  // Plan the action
  const p = await plan(message, ctx, tools);

  switch (p.action) {
    case 'clarify':
    case 'conversational': {
      contextStore.appendTurn(ctx.conversationId, 'assistant', p.message);
      return {
        conversationId:  ctx.conversationId,
        status:          'completed',
        assistantMessage: p.message,
        toolCalls:       [],
      };
    }

    case 'tool_call':
      return executePlannedToolCall(ctx, p, tools);

    default:
      return fallbackResponse(ctx.conversationId);
  }
}

/**
 * Process a user's confirmation decision (approve or reject).
 */
async function handleConfirmation(conversationId, confirmationId, decision) {
  const ctx = contextStore.getOrCreate(conversationId);

  const pending = contextStore.consumePendingConfirmation(confirmationId);

  if (!pending) {
    return {
      conversationId,
      status:          'failed',
      assistantMessage: 'This confirmation has expired or has already been used. No action was taken.',
      toolCalls:       [],
    };
  }

  if (pending.conversationId !== conversationId) {
    return {
      conversationId,
      status:          'failed',
      assistantMessage: 'Confirmation mismatch. No action was taken.',
      toolCalls:       [],
    };
  }

  if (decision === 'reject') {
    const msg = `No problem — I've cancelled the operation. No changes were made.`;
    contextStore.appendTurn(conversationId, 'assistant', msg);
    return {
      conversationId,
      status:          'completed',
      assistantMessage: msg,
      toolCalls:       [formatTraceEntry(pending.toolName, 'cancelled', null)],
    };
  }

  // Approved — call the tool with the server-held, pre-validated arguments
  return executeToolCall(ctx, pending.toolName, pending.args);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function executePlannedToolCall(ctx, plannedAction, tools) {
  const { toolName, args, requiresConfirmation } = plannedAction;

  // Validate args against the live schema
  const toolDef = tools.find(t => t.name === toolName);
  if (!toolDef) {
    // Tool disappeared — refresh cache and inform user
    await toolRegistry.getTools({ forceRefresh: true });
    return {
      conversationId:  ctx.conversationId,
      status:          'failed',
      assistantMessage: `The requested capability is no longer available. Please try again.`,
      toolCalls:       [formatTraceEntry(toolName, 'error', null)],
    };
  }

  const validation = validateArgs(toolDef.inputSchema, args);
  if (!validation.valid) {
    const msg = `I'm missing some details: ${validation.errors.join('; ')}. Could you provide them?`;
    contextStore.appendTurn(ctx.conversationId, 'assistant', msg);
    return {
      conversationId:  ctx.conversationId,
      status:          'completed',
      assistantMessage: msg,
      toolCalls:       [],
    };
  }

  // If this tool has a side effect, request confirmation first
  if (requiresConfirmation) {
    const confirmationId = contextStore.storePendingConfirmation({
      conversationId: ctx.conversationId,
      toolName,
      args,
    });

    const pendingSummary = buildPendingSummary(toolName, args);
    const assistantMsg   = `${pendingSummary} Should I go ahead?`;
    contextStore.appendTurn(ctx.conversationId, 'assistant', assistantMsg);

    return {
      conversationId:  ctx.conversationId,
      status:          'awaiting_confirmation',
      assistantMessage: assistantMsg,
      confirmationId,
      pendingAction:   { toolName, summary: pendingSummary },
      toolCalls:       [formatTraceEntry(toolName, 'awaiting_confirmation', null)],
    };
  }

  // No side effect — execute directly
  return executeToolCall(ctx, toolName, args);
}

async function executeToolCall(ctx, toolName, args, callCount = 0) {
  if (callCount >= MAX_TOOL_CALLS) {
    return {
      conversationId:  ctx.conversationId,
      status:          'failed',
      assistantMessage: 'Too many tool calls in a single turn. Please try again.',
      toolCalls:       [],
    };
  }

  let mcpResult;
  try {
    mcpResult = await mcpClient.callTool(toolName, args);
  } catch (err) {
    const isTransport = err instanceof McpTransportError || err instanceof McpProtocolError;
    const msg = isTransport
      ? `I couldn't reach the household service. No changes were made.`
      : `Something went wrong: ${err.message}`;
    return {
      conversationId:  ctx.conversationId,
      status:          'failed',
      assistantMessage: msg,
      toolCalls:       [formatTraceEntry(toolName, 'error', null)],
    };
  }

  const isError = mcpResult.isError === true;

  if (isError) {
    const msg = buildAssistantMessage(toolName, mcpResult);
    contextStore.appendTurn(ctx.conversationId, 'assistant', msg);
    return {
      conversationId:  ctx.conversationId,
      status:          'failed',
      assistantMessage: msg,
      toolCalls:       [formatTraceEntry(toolName, 'error', mcpResult)],
    };
  }

  // Success — extract stable task ID for follow-up operations
  const taskId = extractTaskId(mcpResult);
  if (taskId) {
    contextStore.setLastTaskId(ctx.conversationId, taskId);
  }

  const assistantMsg = buildAssistantMessage(toolName, mcpResult);
  contextStore.appendTurn(ctx.conversationId, 'assistant', assistantMsg);

  return {
    conversationId:  ctx.conversationId,
    status:          'completed',
    assistantMessage: assistantMsg,
    toolCalls:       [formatTraceEntry(toolName, 'success', mcpResult)],
    // Include structured content if present, for task card rendering
    structuredResult: mcpResult.structuredContent ?? null,
  };
}

function buildPendingSummary(toolName, args) {
  switch (toolName) {
    case 'add_chore':
      return `I'll create a chore "${args.title}"${args.dueDate ? ` due on ${args.dueDate}` : ''}.`;
    case 'complete_task':
      return `I'll mark task ${args.id} as completed.`;
    default:
      return `I'll run the "${toolName}" operation.`;
  }
}

function mcpUnavailableResponse(conversationId, err) {
  console.error('[Orchestrator] MCP unavailable:', err.message);
  return {
    conversationId,
    status:          'failed',
    assistantMessage: 'The household service is currently unavailable. Please try again in a moment.',
    toolCalls:       [{ toolName: 'mcp', status: 'error', summary: 'MCP server is unreachable.' }],
  };
}

function fallbackResponse(conversationId) {
  return {
    conversationId,
    status:          'completed',
    assistantMessage: "I'm not sure how to help with that. Try asking about your chores or notes.",
    toolCalls:       [],
  };
}

module.exports = { handleChat, handleConfirmation };
