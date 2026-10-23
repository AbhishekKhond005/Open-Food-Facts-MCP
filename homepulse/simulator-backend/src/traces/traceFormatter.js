/**
 * Trace Formatter — produces safe, user-facing tool call summaries.
 *
 * Raw MCP results should never be forwarded to the UI directly.
 * This module redacts sensitive data and produces concise summaries.
 */

'use strict';

/**
 * Build a toolCalls trace entry.
 *
 * @param {string}  toolName
 * @param {string}  status     'success' | 'error' | 'awaiting_confirmation'
 * @param {object}  mcpResult  Raw MCP tool result (may be null)
 * @returns {object}
 */
function formatTraceEntry(toolName, status, mcpResult) {
  return {
    toolName,
    status,
    summary: buildSummary(toolName, status, mcpResult),
  };
}

function buildSummary(toolName, status, result) {
  if (status === 'awaiting_confirmation') {
    return `Waiting for user confirmation; the tool has not been called.`;
  }
  if (status === 'error') {
    const msg = extractTextContent(result);
    return msg || `The tool "${toolName}" returned an error.`;
  }

  // success — build a friendly summary from the result content
  const text = extractTextContent(result);
  if (text) return text;

  // Fallback summaries per known tool
  const fallbacks = {
    list_tasks:            'Retrieved household tasks.',
    add_chore:             'Chore added successfully.',
    complete_task:         'Task marked as completed.',
    search_notes:          'Note search completed.',
    get_household_summary: 'Household summary retrieved.',
  };
  return fallbacks[toolName] ?? `Tool "${toolName}" completed.`;
}

/**
 * Extract the first text content block from an MCP tool result.
 * Limits to 300 characters to avoid dumping large payloads.
 */
function extractTextContent(result) {
  if (!result) return '';
  const content = result.content;
  if (!Array.isArray(content)) return '';
  const textBlock = content.find(c => c.type === 'text');
  if (!textBlock?.text) return '';
  const text = String(textBlock.text).trim();
  return text.length > 300 ? text.slice(0, 297) + '...' : text;
}

/**
 * Build a friendly assistant message from an MCP result for read-only tools.
 */
function buildAssistantMessage(toolName, mcpResult) {
  if (!mcpResult) return `I encountered an issue calling ${toolName}.`;

  if (mcpResult.isError) {
    const msg = extractTextContent(mcpResult);
    return msg || `Sorry, I couldn't complete that operation.`;
  }

  // Try structured content for known tools
  if (mcpResult.structuredContent) {
    const message = buildStructuredMessage(toolName, mcpResult.structuredContent);
    const foodTools = new Set([
      'get_product_by_barcode', 'search_products', 'get_nutrition_info',
      'check_dietary_preferences', 'check_allergens', 'analyze_ingredients',
      'compare_products', 'find_alternatives',
    ]);
    if (foodTools.has(toolName)) {
      const text = mcpResult.content?.find(item => item.type === 'text')?.text?.trim();
      if (text) return text;
    }
    return message;
  }

  const text = extractTextContent(mcpResult);
  return text || `Done! The operation completed successfully.`;
}

function buildStructuredMessage(toolName, structured) {
  switch (toolName) {
    case 'list_tasks': {
      const tasks = structured.tasks ?? [];
      if (tasks.length === 0) return `You have no tasks matching that filter.`;
      const lines = tasks.map(
        t => `• ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ''}${t.completed ? ' ✓' : ''}`
      );
      return `Here are your tasks:\n${lines.join('\n')}`;
    }
    case 'add_chore': {
      const task = structured.task ?? structured;
      return `Got it! I've added "${task.title ?? 'the chore'}"${task.dueDate ? ` due on ${task.dueDate}` : ''}.`;
    }
    case 'complete_task':
      return `Done! The task has been marked as completed.`;
    case 'search_notes': {
      const notes = structured.notes ?? [];
      if (notes.length === 0) return `I couldn't find any notes matching that query.`;
      return notes.map(n => `📝 ${n.title ?? ''}: ${n.content ?? ''}`).join('\n');
    }
    case 'get_household_summary': {
      return structured.summary ?? 'Here is your household summary.';
    }
    default:
      return JSON.stringify(structured).slice(0, 300);
  }
}

/**
 * Extract the first stable task ID from a structured result.
 * Returns null if none found.
 */
function extractTaskId(mcpResult) {
  if (!mcpResult?.structuredContent) return null;
  const s = mcpResult.structuredContent;
  // add_chore returns { task: { id, ... } }
  return s?.task?.id ?? s?.id ?? null;
}

module.exports = {
  formatTraceEntry,
  buildAssistantMessage,
  extractTaskId,
  extractTextContent,
};
