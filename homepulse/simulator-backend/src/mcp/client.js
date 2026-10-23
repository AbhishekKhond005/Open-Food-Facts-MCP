/**
 * MCP Client — Streamable HTTP transport, protocol version 2025-11-25
 *
 * Responsibilities:
 *  - Initialize the MCP session and send notifications/initialized
 *  - Maintain MCP-Session-Id across requests
 *  - Expose tools/list (with bounded TTL cache)
 *  - Expose tools/call
 *  - Graceful degradation when the server is unavailable
 */

'use strict';

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const MCP_SERVER_URL      = process.env.MCP_SERVER_URL        || 'http://localhost:8081/mcp';
const PROTOCOL_VERSION    = process.env.MCP_PROTOCOL_VERSION  || '2025-11-25';
const CLIENT_NAME         = process.env.MCP_CLIENT_NAME       || 'alexa-plus-simulator';
const CLIENT_VERSION      = process.env.MCP_CLIENT_VERSION    || '0.1.0';
const REQUEST_TIMEOUT_MS  = parseInt(process.env.MCP_REQUEST_TIMEOUT_MS  || '20000', 10);
const TOOL_CACHE_TTL_MS   = parseInt(process.env.MCP_TOOL_CACHE_TTL_MS   || '60000', 10);

// ─── Internal state ───────────────────────────────────────────────────────────

let sessionId         = null;   // MCP-Session-Id returned by the server
let initialized       = false;  // true after successful initialize + initialized notification
let initializingNow   = null;   // Promise while init is in-flight (prevents double-init)

// Tool cache
let toolCache         = null;   // Array of tool definitions
let toolCacheExpiry   = 0;      // Unix ms when the cache expires

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _rpcId = 1;
function nextId() { return _rpcId++; }

function buildRequest(method, params = {}) {
  return {
    jsonrpc: '2.0',
    id:      nextId(),
    method,
    params,
  };
}

function buildNotification(method, params = {}) {
  return { jsonrpc: '2.0', method, params };   // no "id" — MCP notification
}

/**
 * Low-level HTTP POST to the MCP endpoint.
 * Handles session headers and timeouts.
 */
async function postMcp(body, { skipSessionHeader = false } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept:         'application/json, text/event-stream',
    'MCP-Protocol-Version': PROTOCOL_VERSION,
  };
  if (!skipSessionHeader && sessionId) {
    headers['MCP-Session-Id'] = sessionId;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(MCP_SERVER_URL, {
      method:  'POST',
      headers,
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  // Capture a new session ID if the server sends one
  const newSessionId = response.headers.get('MCP-Session-Id');
  if (newSessionId) sessionId = newSessionId;

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new McpTransportError(`MCP HTTP ${response.status}: ${text}`);
  }

  // MCP notifications commonly return 202 Accepted with no response body.
  if (response.status === 202 || response.status === 204) return null;

  // The response may be JSON or SSE (text/event-stream).
  // For Streamable HTTP, a single RPC usually comes back as JSON.
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    return parseSseResponse(response);
  }
  return response.json();
}

/**
 * Parse a text/event-stream body and return the first data event parsed as JSON.
 */
async function parseSseResponse(response) {
  const text = await response.text();
  for (const line of text.split('\n')) {
    if (line.startsWith('data:')) {
      try { return JSON.parse(line.slice(5).trim()); } catch (_) { /* skip */ }
    }
  }
  throw new McpTransportError('SSE response contained no parseable data event');
}

/**
 * Validate that a JSON-RPC response is well-formed and has no error.
 */
function assertRpcSuccess(rpc, expectedId) {
  if (!rpc || typeof rpc !== 'object') throw new McpProtocolError('Non-object RPC response');
  if (rpc.error) throw new McpRpcError(rpc.error.code, rpc.error.message, rpc.error.data);
  if (expectedId !== undefined && rpc.id !== expectedId) {
    throw new McpProtocolError(`RPC id mismatch: sent ${expectedId}, received ${rpc.id}`);
  }
  return rpc.result;
}

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Initialize the MCP session.
 * Safe to call multiple times — only runs once until the session is invalidated.
 */
async function initialize() {
  if (initialized) return;
  if (initializingNow) return initializingNow;

  initializingNow = _doInitialize().finally(() => { initializingNow = null; });
  return initializingNow;
}

async function _doInitialize() {
  const req = buildRequest('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
    capabilities: {},
  });

  let result;
  try {
    const rpc = await postMcp(req, { skipSessionHeader: true });
    result = assertRpcSuccess(rpc, req.id);
  } catch (err) {
    throw new McpTransportError(`MCP initialize failed: ${err.message}`);
  }

  // Validate the server accepted our protocol version
  if (result.protocolVersion && result.protocolVersion !== PROTOCOL_VERSION) {
    console.warn(
      `[MCP] Server negotiated protocol ${result.protocolVersion}; we requested ${PROTOCOL_VERSION}`
    );
  }

  // Send notifications/initialized (no response expected)
  try {
    await postMcp(buildNotification('notifications/initialized'));
  } catch (err) {
    // Non-fatal — some servers don't respond to notifications
    console.warn('[MCP] notifications/initialized delivery issue:', err.message);
  }

  initialized = true;
  console.log('[MCP] Session initialized. Server:', result.serverInfo?.name ?? 'unknown');
}

// ─── Tool discovery ───────────────────────────────────────────────────────────

/**
 * Return cached tool definitions or fetch a fresh list from the server.
 * Handles cursor-based pagination.
 */
async function listTools({ forceRefresh = false } = {}) {
  await initialize();

  const now = Date.now();
  if (!forceRefresh && toolCache && now < toolCacheExpiry) {
    return toolCache;
  }

  const tools = [];
  let cursor   = undefined;

  do {
    const params = cursor ? { cursor } : {};
    const req    = buildRequest('tools/list', params);
    const rpc    = await postMcp(req);
    const result = assertRpcSuccess(rpc, req.id);

    if (Array.isArray(result.tools)) tools.push(...result.tools);
    cursor = result.nextCursor;
  } while (cursor);

  toolCache       = tools;
  toolCacheExpiry = Date.now() + TOOL_CACHE_TTL_MS;

  console.log(`[MCP] Discovered ${tools.length} tool(s):`, tools.map(t => t.name).join(', '));
  return tools;
}

/**
 * Invalidate the tool cache (e.g. after receiving a tool-list-changed notification).
 */
function invalidateToolCache() {
  toolCache       = null;
  toolCacheExpiry = 0;
}

// ─── Tool execution ───────────────────────────────────────────────────────────

/**
 * Call a tool by name with the provided arguments.
 * Returns the MCP tool result: { content, structuredContent?, isError? }
 */
async function callTool(toolName, args = {}) {
  await initialize();

  const req = buildRequest('tools/call', {
    name:      toolName,
    arguments: args,
  });

  const rpc    = await postMcp(req);
  const result = assertRpcSuccess(rpc, req.id);

  // result shape: { content: [...], structuredContent?: {...}, isError?: boolean }
  return result;
}

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * Returns a status object for the /api/v1/status endpoint.
 */
async function getStatus() {
  try {
    await initialize();
    const tools = await listTools();
    return { simulator: 'ready', mcpServer: 'connected', discoveredToolCount: tools.length };
  } catch (err) {
    return {
      simulator:          'ready',
      mcpServer:          'unavailable',
      discoveredToolCount: 0,
      error:              err.message,
    };
  }
}

/**
 * Reset session state (e.g. after a fatal transport error).
 */
function resetSession() {
  sessionId       = null;
  initialized     = false;
  initializingNow = null;
  invalidateToolCache();
  console.log('[MCP] Session reset.');
}

// ─── Error types ─────────────────────────────────────────────────────────────

class McpTransportError extends Error {
  constructor(msg) { super(msg); this.name = 'McpTransportError'; }
}
class McpProtocolError extends Error {
  constructor(msg) { super(msg); this.name = 'McpProtocolError'; }
}
class McpRpcError extends Error {
  constructor(code, msg, data) {
    super(msg);
    this.name = 'McpRpcError';
    this.code = code;
    this.data = data;
  }
}

module.exports = {
  initialize,
  listTools,
  invalidateToolCache,
  callTool,
  getStatus,
  resetSession,
  McpTransportError,
  McpProtocolError,
  McpRpcError,
};
