#!/usr/bin/env bash
# Comprehensive integration test for the Open Food Facts MCP Server.
# Tests the full MCP lifecycle: initialize → initialized → tools/list → tools/call for all tools.
# Usage: bash scripts/integration-test.sh [MCP_URL]

set -uo pipefail

MCP_URL="${1:-http://localhost:8081/mcp}"
PASS=0
FAIL=0

green() { echo -e "\033[32m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }

check() {
  local name="$1"
  local condition="$2"
  if [ "$condition" = "true" ]; then
    green "  ✅ PASS: $name"
    PASS=$((PASS + 1))
  else
    red "  ❌ FAIL: $name"
    FAIL=$((FAIL + 1))
  fi
}

# Accept either JSON or an SSE data event (both are valid Streamable HTTP responses).
extract_data() {
  python3 -c 'import sys; s=sys.stdin.read().strip(); rows=[line[5:].strip() for line in s.splitlines() if line.startswith("data:")]; print(rows[0] if rows else s)'
}

echo "╔══════════════════════════════════════════════════════╗"
echo "║   Open Food Facts MCP Server Integration Tests      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Target: $MCP_URL"
echo ""

# ─── Health Check ───
echo "━━━ Health Check ━━━"
HEALTH=$(curl -s http://localhost:8081/health 2>/dev/null || echo "FAIL")
check "Health endpoint returns OK" "$(echo "$HEALTH" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("true" if d.get("status")=="ok" else "false")' 2>/dev/null || echo false)"
echo ""

# ─── Step 1: Initialize ───
echo "━━━ Step 1: Initialize ━━━"
INIT_RESP=$(curl -s -D /dev/stderr -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"integration-test","version":"1.0.0"}}}' 2>/tmp/mcp_test_headers)

SESSION_ID=$(grep -i "mcp-session-id" /tmp/mcp_test_headers 2>/dev/null | tr -d '\r\n' | awk '{print $2}')
INIT_DATA=$(echo "$INIT_RESP" | extract_data)

check "Session ID returned" "$([ -n "$SESSION_ID" ] && echo true || echo false)"
check "Protocol version is 2025-11-25" "$(echo "$INIT_DATA" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("true" if d.get("result",{}).get("protocolVersion")=="2025-11-25" else "false")' 2>/dev/null || echo false)"
check "Server info present" "$(echo "$INIT_DATA" | python3 -c 'import json,sys; d=json.load(sys.stdin); si=d.get("result",{}).get("serverInfo",{}); print("true" if si.get("name") and si.get("version") else "false")' 2>/dev/null || echo false)"
check "Tools capability declared" "$(echo "$INIT_DATA" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("true" if "tools" in d.get("result",{}).get("capabilities",{}) else "false")' 2>/dev/null || echo false)"
check "Instructions present" "$(echo "$INIT_DATA" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("true" if d.get("result",{}).get("instructions") else "false")' 2>/dev/null || echo false)"
echo "  Session ID: $SESSION_ID"
echo ""

# ─── Step 2: notifications/initialized ───
echo "━━━ Step 2: notifications/initialized ━━━"
NOTIF_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}')
check "Returns HTTP 202 Accepted" "$([ "$NOTIF_CODE" = "202" ] && echo true || echo false)"
echo ""

# ─── Step 3: tools/list ───
echo "━━━ Step 3: tools/list ━━━"
TOOLS_RESP=$(curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')
TOOLS_DATA=$(echo "$TOOLS_RESP" | extract_data)

TOOL_COUNT=$(echo "$TOOLS_DATA" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d.get("result",{}).get("tools",[])))' 2>/dev/null || echo 0)
check "Returns 8 tools" "$([ "$TOOL_COUNT" = "8" ] && echo true || echo false)"

# Check each tool has required fields
TOOLS_VALID=$(echo "$TOOLS_DATA" | python3 -c '
import json, sys, re
data = json.load(sys.stdin)
tools = data.get("result",{}).get("tools",[])
all_ok = True
for t in tools:
    name = t.get("name","")
    if not re.match(r"^[a-z][a-z0-9_]*$", name):
        print(f"  Bad name: {name}")
        all_ok = False
    if not t.get("description"):
        print(f"  Missing description: {name}")
        all_ok = False
    schema = t.get("inputSchema", {})
    if schema.get("type") != "object":
        print(f"  Bad schema type: {name}")
        all_ok = False
print("true" if all_ok else "false")
' 2>/dev/null || echo false)
check "All tools have valid name/description/inputSchema" "$TOOLS_VALID"

# Print tool names
echo "$TOOLS_DATA" | python3 -c '
import json, sys
data = json.load(sys.stdin)
for t in data.get("result",{}).get("tools",[]):
    print(f"    📦 {t[\"name\"]}")
' 2>/dev/null
echo ""

# ─── Step 4: Tool calls ───
echo "━━━ Step 4: Tool calls ━━━"

# Helper to call a tool
call_tool() {
  local id="$1"
  local name="$2"
  local args="$3"
  
  curl -s -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: $SESSION_ID" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$id,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}" 2>/dev/null | extract_data
}

# 4a: get_product_by_barcode
echo "  ── get_product_by_barcode (Nutella: 3017624010701) ──"
RESP=$(call_tool 10 "get_product_by_barcode" '{"barcode":"3017624010701"}')
IS_ERR=$(echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("result",{}).get("isError",True))' 2>/dev/null || echo True)
check "Barcode lookup succeeds" "$([ "$IS_ERR" = "False" ] && echo true || echo false)"
HAS_TEXT=$(echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); c=d.get("result",{}).get("content",[]); print("true" if c and c[0].get("text") else "false")' 2>/dev/null || echo false)
check "Has text content" "$HAS_TEXT"
HAS_SC=$(echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); sc=d.get("result",{}).get("structuredContent",{}); print("true" if sc.get("barcode") and sc.get("product_name") else "false")' 2>/dev/null || echo false)
check "Has structuredContent with barcode+product_name" "$HAS_SC"

sleep 1

# 4b: get_nutrition_info
echo "  ── get_nutrition_info (Nutella) ──"
RESP=$(call_tool 11 "get_nutrition_info" '{"barcode":"3017624010701"}')
IS_ERR=$(echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("result",{}).get("isError",True))' 2>/dev/null || echo True)
check "Nutrition info succeeds" "$([ "$IS_ERR" = "False" ] && echo true || echo false)"

sleep 1

# 4c: check_allergens
echo "  ── check_allergens (Nutella) ──"
RESP=$(call_tool 12 "check_allergens" '{"barcode":"3017624010701"}')
IS_ERR=$(echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("result",{}).get("isError",True))' 2>/dev/null || echo True)
check "Allergen check succeeds" "$([ "$IS_ERR" = "False" ] && echo true || echo false)"
HAS_DISCLAIMER=$(echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); t=d.get("result",{}).get("content",[{}])[0].get("text",""); print("true" if "verify" in t.lower() or "packaging" in t.lower() else "false")' 2>/dev/null || echo false)
check "Allergen report includes disclaimer" "$HAS_DISCLAIMER"

sleep 1

# 4d: check_dietary_preferences
echo "  ── check_dietary_preferences (Nutella) ──"
RESP=$(call_tool 13 "check_dietary_preferences" '{"barcode":"3017624010701"}')
IS_ERR=$(echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("result",{}).get("isError",True))' 2>/dev/null || echo True)
check "Dietary preferences check succeeds" "$([ "$IS_ERR" = "False" ] && echo true || echo false)"

sleep 1

# 4e: analyze_ingredients
echo "  ── analyze_ingredients (Nutella) ──"
RESP=$(call_tool 14 "analyze_ingredients" '{"barcode":"3017624010701"}')
IS_ERR=$(echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("result",{}).get("isError",True))' 2>/dev/null || echo True)
check "Ingredient analysis succeeds" "$([ "$IS_ERR" = "False" ] && echo true || echo false)"

sleep 1

# 4f: search_products (may 503 due to rate limiting — not a server error)
echo "  ── search_products (nutella, page_size=3) ──"
RESP=$(call_tool 15 "search_products" '{"query":"nutella","page_size":3}')
HAS_RESULT=$(echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("true" if d.get("result") else "false")' 2>/dev/null || echo false)
check "Search returns a result (even if isError due to API rate-limit)" "$HAS_RESULT"

sleep 1

# 4g: Invalid barcode (should return isError true)
echo "  ── get_product_by_barcode (invalid: 'abc') ──"
RESP=$(call_tool 16 "get_product_by_barcode" '{"barcode":"abc"}')
IS_ERR=$(echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("result",{}).get("isError",True))' 2>/dev/null || echo True)
check "Invalid barcode returns isError:true" "$([ "$IS_ERR" = "True" ] && echo true || echo false)"

# ─── Step 5: Protocol error tests ───
echo ""
echo "━━━ Step 5: Protocol errors ━━━"

# GET /mcp without session → 405
GET_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/mcp)
check "GET /mcp returns 405" "$([ "$GET_CODE" = "405" ] && echo true || echo false)"

# Unknown session ID → 404
UNK_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: nonexistent-session-id" \
  -d '{"jsonrpc":"2.0","id":99,"method":"tools/list","params":{}}')
check "Unknown session ID returns 404" "$([ "$UNK_CODE" = "404" ] && echo true || echo false)"

# Origin validation: request with disallowed origin (if server has no allowed origins, all should pass)
ORIGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}')
check "Request without Origin header succeeds" "$([ "$ORIGIN_CODE" = "200" ] && echo true || echo false)"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                    RESULTS                          ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║   Passed: $PASS                                       ║"
echo "║   Failed: $FAIL                                       ║"
echo "╚══════════════════════════════════════════════════════╝"

rm -f /tmp/mcp_test_headers

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
