/**
 * MCP Error types — re-exported for convenient use in other modules.
 */

'use strict';

const { McpTransportError, McpProtocolError, McpRpcError } = require('./client');

module.exports = { McpTransportError, McpProtocolError, McpRpcError };
