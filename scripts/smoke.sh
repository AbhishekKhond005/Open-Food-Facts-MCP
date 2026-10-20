#!/usr/bin/env bash
# Smoke test: initialize -> tools/list -> tools/call (search_products)
# Usage: bash scripts/smoke.sh [MCP_URL]

set -euo pipefail

MCP_URL="${1:-http://localhost:8081/mcp}"
echo "=== Open Food Facts MCP Server Smoke Test ==="
echo "Endpoint: $MCP_URL"
echo ""

# Step 1: Initialize
echo "--- Step 1: Initialize ---"
INIT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": {
        "name": "smoke-test-client",
        "version": "1.0.0"
      }
    }
  }')

HTTP_CODE=$(echo "$INIT_RESPONSE" | tail -1)
BODY=$(echo "$INIT_RESPONSE" | sed '$d')

echo "HTTP $HTTP_CODE"
echo "$BODY" | head -c 500
echo ""

# Extract session ID from response headers if available
SESSION_ID=$(curl -s -D - -o /dev/null -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": {
        "name": "smoke-test-client",
        "version": "1.0.0"
      }
    }
  }' 2>/dev/null | grep -i "mcp-session-id" | tr -d '\r' | awk '{print $2}' || echo "")

SESSION_HEADER=""
if [ -n "$SESSION_ID" ]; then
  SESSION_HEADER="-H \"Mcp-Session-Id: $SESSION_ID\""
  echo "Session ID: $SESSION_ID"
fi

echo ""

# Step 2: Send initialized notification
echo "--- Step 2: notifications/initialized ---"
NOTIF_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  ${SESSION_ID:+-H "Mcp-Session-Id: $SESSION_ID"} \
  -d '{
    "jsonrpc": "2.0",
    "method": "notifications/initialized"
  }')
echo "HTTP $NOTIF_CODE"
echo ""

# Step 3: tools/list
echo "--- Step 3: tools/list ---"
TOOLS_RESPONSE=$(curl -s -X POST "$MCP_URL" \
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
echo "$TOOLS_RESPONSE" | head -c 2000
echo ""
echo ""

# Step 4: Call search_products
echo "--- Step 4: tools/call (search_products) ---"
CALL_RESPONSE=$(curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  ${SESSION_ID:+-H "Mcp-Session-Id: $SESSION_ID"} \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search_products",
      "arguments": {
        "query": "nutella",
        "page_size": 3
      }
    }
  }')
echo "$CALL_RESPONSE" | head -c 2000
echo ""
echo ""

# Step 5: Call get_product_by_barcode (Nutella barcode)
echo "--- Step 5: tools/call (get_product_by_barcode) ---"
BARCODE_RESPONSE=$(curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  ${SESSION_ID:+-H "Mcp-Session-Id: $SESSION_ID"} \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_product_by_barcode",
      "arguments": {
        "barcode": "3017624010701"
      }
    }
  }')
echo "$BARCODE_RESPONSE" | head -c 2000
echo ""
echo ""

echo "=== Smoke test complete ==="
