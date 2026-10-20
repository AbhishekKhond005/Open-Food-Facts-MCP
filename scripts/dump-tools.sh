#!/usr/bin/env bash
# Dump the current tools/list from the running MCP server.
# Usage: bash scripts/dump-tools.sh [MCP_URL]

set -euo pipefail

MCP_URL="${1:-http://localhost:8081/mcp}"
echo "Fetching tools from: $MCP_URL"
echo ""

# Initialize first
INIT_RESP=$(curl -s -D /tmp/mcp_headers.txt -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": { "name": "dump-tools", "version": "1.0.0" }
    }
  }')

SESSION_ID=$(grep -i "mcp-session-id" /tmp/mcp_headers.txt 2>/dev/null | tr -d '\r' | awk '{print $2}' || echo "")

# Send initialized notification
curl -s -o /dev/null -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  ${SESSION_ID:+-H "Mcp-Session-Id: $SESSION_ID"} \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# Fetch tools/list
TOOLS=$(curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  ${SESSION_ID:+-H "Mcp-Session-Id: $SESSION_ID"} \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }')

echo "$TOOLS" | python3 -m json.tool 2>/dev/null || echo "$TOOLS"

rm -f /tmp/mcp_headers.txt
