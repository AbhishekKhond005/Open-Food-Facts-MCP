/**
 * Planner — maps user natural-language messages to MCP tool calls.
 *
 * Strategy: deterministic keyword/intent matching against the live tool catalogue
 * discovered via MCP tools/list. This keeps the simulator simple and dependency-free
 * while still respecting the "discover at runtime" rule.
 *
 * The planner returns one of:
 *   { action: 'tool_call',   toolName, args, requiresConfirmation }
 *   { action: 'clarify',     message }
 *   { action: 'conversational', message }
 *
 * To upgrade to an LLM planner, replace _selectTool() — everything else stays the same.
 */

'use strict';

const toolRegistry = require('../mcp/toolRegistry');

// ─── Intent patterns ──────────────────────────────────────────────────────────

// Ordered: more-specific patterns first.
const INTENT_PATTERNS = [
  // complete / mark done
  {
    pattern: /\b(complete|mark|done|finish|finished)\b.*(task|chore|it|that)/i,
    tool:    'complete_task',
    extract: extractCompleteArgs,
    sideEffect: true,
  },
  // list / show chores
  {
    pattern: /\b(list|show|what|get|any|check)\b.*(chore|task|todo|due)/i,
    tool:    'list_tasks',
    extract: extractListArgs,
    sideEffect: false,
  },
  // add / create chore
  {
    pattern: /\b(add|create|new|schedule|remind)\b.*(chore|task|todo|grocery|grocer|clean|wash|buy|cook|water|fix|repair)/i,
    tool:    'add_chore',
    extract: extractAddChoreArgs,
    sideEffect: true,
  },
  // search notes
  {
    pattern: /\b(note|notes|find|search|look up|what is|what's)\b.*(note|wifi|password|info|detail)/i,
    tool:    'search_notes',
    extract: extractSearchNotesArgs,
    sideEffect: false,
  },
  // household summary
  {
    pattern: /\b(summary|overview|status|how|household)\b/i,
    tool:    'get_household_summary',
    extract: () => ({}),
    sideEffect: false,
  },
];

// ─── Argument extractors ──────────────────────────────────────────────────────

function extractListArgs(message) {
  const args = {};
  if (/today/i.test(message)) args.date = todayIso();
  if (/tomorrow/i.test(message)) args.date = tomorrowIso();
  if (/\b(pending|incomplete|not done)\b/i.test(message)) args.completed = false;
  if (/\b(complete|done|finished)\b/i.test(message)) args.completed = true;
  return args;
}

function extractAddChoreArgs(message) {
  const args = {};

  // Try to pull a title out: text after "add"/"create"/etc. up to a date keyword
  const titleMatch = message.match(
    /(?:add|create|new|schedule|remind\s+me\s+to|remind\s+to)\s+(.+?)(?:\s+(?:for|by|on|due)\s+|$)/i
  );
  if (titleMatch) {
    args.title = titleMatch[1].replace(/^\s*a\s+/i, '').trim();
  } else {
    // Fallback: everything after the first verb
    args.title = message.replace(/^(add|create|new)\s+/i, '').trim();
  }

  if (/tomorrow/i.test(message)) args.dueDate = tomorrowIso();
  else if (/today/i.test(message)) args.dueDate = todayIso();
  else if (/\bnext week\b/i.test(message)) args.dueDate = nextWeekIso();

  return args;
}

function extractCompleteArgs(message, context) {
  const args = {};
  // Prefer the stable task ID stored from the previous turn
  if (context?.lastTaskId) {
    args.id = context.lastTaskId;
  }
  return args;
}

function extractSearchNotesArgs(message) {
  const args = {};
  // Use the whole message as a query (server will handle relevance)
  const queryMatch = message.match(/(?:note|notes|find|search|look up|what is|what's)\s+(?:the\s+)?(.+)/i);
  if (queryMatch) {
    args.query = queryMatch[1].replace(/\?$/, '').trim();
  } else {
    args.query = message.trim();
  }
  return args;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function nextWeekIso() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

// ─── Core planner ─────────────────────────────────────────────────────────────

/**
 * Plan a tool call for the user's message.
 *
 * @param {string} message  The user's raw message
 * @param {object} context  Conversation context (may have lastTaskId)
 * @param {object[]} tools  Live tool definitions from MCP tools/list
 * @returns {object}        Plan object
 */
async function plan(message, context, tools) {
  // Build a set of available tool names for quick lookup
  const availableNames = new Set(tools.map(t => t.name));

  for (const intent of INTENT_PATTERNS) {
    if (!intent.pattern.test(message)) continue;

    const toolName = intent.tool;

    // Only proceed if the tool was actually discovered by MCP
    if (!availableNames.has(toolName)) continue;

    const args = intent.extract(message, context);

    // For complete_task: if we don't have an ID, ask for clarification
    if (toolName === 'complete_task' && !args.id) {
      return {
        action:  'clarify',
        message: "Which task would you like to mark as completed? Please tell me its name or ask me to list your tasks first.",
      };
    }

    // For add_chore: if no title extracted, ask
    if (toolName === 'add_chore' && !args.title) {
      return {
        action:  'clarify',
        message: "What would you like to name this chore?",
      };
    }

    return {
      action:             'tool_call',
      toolName,
      args,
      requiresConfirmation: intent.sideEffect,
    };
  }

  // Fallback: friendly conversational response
  return {
    action:  'conversational',
    message: buildFallbackResponse(message, tools),
  };
}

function buildFallbackResponse(message, tools) {
  const toolList = tools.map(t => `• **${t.name}**: ${t.description ?? ''}`).join('\n');
  return (
    `I'm not sure how to help with "${message}". ` +
    `Here's what I can do:\n${toolList || 'No tools are currently available.'}`
  );
}

module.exports = { plan };
