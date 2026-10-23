# HomePulse

**HomePulse** is a browser-based Alexa+-style conversational household assistant, built for the Amazon AppDev 2026 hackathon.

It simulates the Alexa+-style interaction through a real MCP (Model Context Protocol) integration. Tool execution and data are **real** — the web experience is simulated, but MCP tool calls go to an actual server.

---

## Architecture

```
Browser (React/Vite)  →  Simulator Backend (Express)  →  MCP Server (teammate)
       :5173                      :3000                          :8081/mcp
```

- **`client/`** — React + TypeScript + Vite UI. Calls only the simulator backend.
- **`simulator-backend/`** — Express REST API + MCP client. Never exposes MCP to the browser.
- **`mcp-server/`** — Your teammate's independent MCP server (not in this repo).

---

## Quick start

### 1. Simulator backend

```bash
cd simulator-backend
cp .env.example .env    # already done — edit MCP_SERVER_URL if needed
npm install
npm run dev
# → http://localhost:3000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev
# → http://localhost:5173
```

### 3. MCP server (teammate)

Point `MCP_SERVER_URL` in `simulator-backend/.env` to wherever your teammate's MCP server is running.

Default: `http://localhost:8081/mcp`

---

## API contract

### `POST /api/v1/chat`
Send a user message and receive an assistant response (or a pending confirmation).

### `POST /api/v1/chat/confirm`
Approve or reject a pending side-effecting tool call.

### `GET /api/v1/status`
Check real-time MCP connection and discovered tool count.

See the [demonstration guide](../AlexaPlus_Simulator_MCP_Demo.md) for full request/response shapes.

---

## V1 workflows

1. **"What chores are due today?"** → `list_tasks`
2. **"Add buying groceries for tomorrow"** → confirmation → `add_chore`
3. **"Mark that as completed"** → confirmation → `complete_task`
4. **"What is the Wi-Fi note?"** → `search_notes`

---

## Environment variables

### `simulator-backend/.env`

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Backend listen port |
| `WEB_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `MCP_SERVER_URL` | `http://localhost:8081/mcp` | MCP server endpoint |
| `MCP_PROTOCOL_VERSION` | `2025-11-25` | MCP protocol version |
| `MCP_REQUEST_TIMEOUT_MS` | `20000` | Tool call timeout |
| `MCP_MAX_TOOL_CALLS_PER_TURN` | `8` | Safety limit |
| `MCP_TOOL_CACHE_TTL_MS` | `60000` | Tool list cache TTL |

### `client/.env`

| Variable | Default | Description |
|---|---|---|
| `VITE_SIMULATOR_API_URL` | `http://localhost:3000` | Simulator backend URL |

---

## Integration notes for the MCP server teammate

The simulator will:
1. `POST /mcp` with `initialize` — handshake and protocol negotiation
2. `POST /mcp` with `notifications/initialized` — confirm ready
3. `POST /mcp` with `tools/list` — discover tools dynamically (cached 60s)
4. `POST /mcp` with `tools/call` — execute selected tool

**Required:** MCP protocol `2025-11-25` over Streamable HTTP.

Proposed tool names: `list_tasks`, `add_chore`, `complete_task`, `search_notes`, `get_household_summary`.

See the full integration plan for tool schemas and output shapes.

---

## No secrets committed

Never commit actual API keys. Use `.env` files locally and `.env.example` as the committed template.
