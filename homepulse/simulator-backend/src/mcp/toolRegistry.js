/**
 * Tool Registry — wraps the MCP client's tool list with lookup helpers
 * and schema validation utilities.
 */

'use strict';

const mcpClient = require('./client');

/**
 * Return all discovered tools.
 */
async function getTools(opts = {}) {
  return mcpClient.listTools(opts);
}

/**
 * Find a tool definition by name. Returns undefined if not found.
 */
async function findTool(name) {
  const tools = await getTools();
  return tools.find(t => t.name === name);
}

/**
 * Find a tool by name; if not found, refresh the cache once and try again.
 * Returns undefined if still not found after refresh.
 */
async function findToolWithRefresh(name) {
  let tool = await findTool(name);
  if (!tool) {
    console.log(`[ToolRegistry] Tool "${name}" not found — refreshing cache`);
    await mcpClient.listTools({ forceRefresh: true });
    tool = await findTool(name);
  }
  return tool;
}

/**
 * Return a tool summary suitable for use in the planner prompt.
 * Shape: { name, description, inputSchema }
 */
async function getToolsForPlanner() {
  const tools = await getTools();
  return tools.map(t => ({
    name:        t.name,
    description: t.description ?? '',
    inputSchema: t.inputSchema ?? {},
  }));
}

module.exports = { getTools, findTool, findToolWithRefresh, getToolsForPlanner };
