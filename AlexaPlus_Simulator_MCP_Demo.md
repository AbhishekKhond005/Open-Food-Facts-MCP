# HomePulse: Web-Based Alexa+ Simulation — Demonstration Guide

**Version:** 2.0  
**Date:** 2026-10-23  
**Status:** Demo Ready  
**Purpose:** Comprehensive guide, run instructions, and walkthrough for demonstrating the HomePulse web simulator with live Model Context Protocol (MCP) server integration.

> **Demonstration Rule:** The browser talks only to the simulation backend (`:3000`). The simulation backend acts as an MCP client. The MCP server (`:8081/mcp`) owns the real domain operations and tools. The simulator discovers tools dynamically via standard MCP `tools/list` at runtime.

---

## 1. How to Run the Application for Demonstration

Follow these instructions to run all three tiers of the application locally for a live demonstration or video recording.

### Architecture & Port Mapping

| Tier | Component | Directory | Port / URL | Description |
|---|---|---|---|---|
| **Tier 1: MCP Server** | Open Food Facts MCP Server | Root (`./`) | `http://localhost:8081/mcp` | Standard Streamable HTTP MCP server (protocol `2025-11-25`) |
| **Tier 2: Simulator Backend** | HomePulse Simulator Server | `homepulse/simulator-backend` | `http://localhost:3000` | Express REST API (`/api/v1/chat`, `/api/v1/status`) + MCP client |
| **Tier 3: Web UI** | HomePulse Browser Client | `homepulse/client` | `http://localhost:5173` | React + Vite conversational interface with traces and confirmations |

```text
┌────────────────────────┐      HTTP REST      ┌────────────────────────┐    Streamable HTTP    ┌────────────────────────┐
│     HomePulse UI       │ ──────────────────> │   Simulator Backend    │ ────────────────────> │       MCP Server       │
│ http://localhost:5173  │ <────────────────── │  http://localhost:3000 │ <──────────────────── │ http://localhost:8081  │
└────────────────────────┘                     └────────────────────────┘        MCP JSON-RPC   └────────────────────────┘
```

---

### Prerequisites
- **Node.js**: v18.0.0 or higher (`node -v`)
- **npm**: v9.0.0 or higher (`npm -v`)
- 3 terminal windows (or split terminal panes)

---

### Step-by-Step Launch Instructions

#### Step 1: Start the MCP Server (Terminal 1)
1. Open a terminal in the project root:
   ```bash
   cd /home/deku/Desktop/Open-Food-Facts-MCP
   ```
2. Install dependencies (first time only):
   ```bash
   npm install
   ```
3. Start the MCP server:
   ```bash
   npm run dev
   # Or production mode: npm start
   ```
4. **Verification:** Check health endpoint:
   ```bash
   curl http://localhost:8081/health
   # Returns: {"status":"healthy","service":"open-food-facts-mcp"}
   ```

#### Step 2: Start the Simulator Backend (Terminal 2)
1. In a second terminal, enter the simulator backend directory:
   ```bash
   cd /home/deku/Desktop/Open-Food-Facts-MCP/homepulse/simulator-backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Verify or adjust `.env` configuration (pre-configured):
   ```env
   PORT=3000
   WEB_ORIGIN=http://localhost:5173
   MCP_SERVER_URL=http://localhost:8081/mcp
   MCP_PROTOCOL_VERSION=2025-11-25
   ```
4. Start the backend:
   ```bash
   npm run dev
   # Or: npm start
   ```
5. **Verification:** Test the backend status endpoint:
   ```bash
   curl http://localhost:3000/api/v1/status
   ```
   You should see `"connected": true` and `"toolsCount": <number>` with the live tools discovered from the MCP server.

#### Step 3: Start the Web UI (Terminal 3)
1. In a third terminal, enter the client directory:
   ```bash
   cd /home/deku/Desktop/Open-Food-Facts-MCP/homepulse/client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Verify or adjust `.env` configuration (pre-configured):
   ```env
   VITE_SIMULATOR_API_URL=http://localhost:3000
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
5. Open your browser at:
   ```text
   http://localhost:5173
   ```

---

### One-Command Quick Launch (Alternative)
To launch all services concurrently from the root directory:
```bash
# Terminal 1: Start MCP server in background
npm run dev &

# Terminal 2: Start simulator backend in background
(cd homepulse/simulator-backend && npm run dev) &

# Terminal 3: Start frontend UI in foreground
(cd homepulse/client && npm run dev)
```
*(To stop all background processes later: `kill $(jobs -p)` or terminate the respective ports.)*

---

### Live Demonstration Script & Walkthrough (3-Minute Tour)

Follow this structured flow for demo presentations, stakeholder reviews, or video recordings:

#### Phase 1: Architectural Foundation & Connection Status (0:00 – 0:45)
1. **Show the Web Interface:** Open `http://localhost:5173`. Point out the modern Alexa+-inspired dark mode interface.
2. **Highlight the Connection Badge:** In the upper right corner, show the **Connected to MCP** status badge.
   - Explain that the UI never connects directly to MCP; it speaks to the secure Simulator Backend.
   - The backend performs runtime protocol handshake (`2025-11-25`) and dynamically lists tools via `tools/list`.

#### Phase 2: Natural Language Queries & Live Tool Execution (0:45 – 1:30)
1. **Send a Query:** Click one of the **Suggested Prompts** or type a query into the composer.
2. **Inspect the Action Trace:** Click to expand the **Action Trace Panel**:
   - Point out the exact tool called by the backend.
   - Show input arguments extracted dynamically from the user's message.
   - Highlight execution time and raw JSON response returned by the MCP server.
   - Emphasize that the assistant response is grounded in actual tool data, not LLM hallucination.

#### Phase 3: Safety & Human-in-the-Loop Confirmation (1:30 – 2:15)
1. **Trigger a Modifying Action:** Submit an action with side effects (e.g. creating or completing a task/chore).
2. **Show the Pending Confirmation Card:**
   - Point out that the tool **has NOT yet been executed** on the server.
   - Show status in Action Trace: `awaiting_confirmation`.
3. **Approve the Action:** Click **Confirm**:
   - The simulator backend calls `POST /api/v1/chat/confirm`, triggering the MCP `tools/call`.
   - The Action Trace updates to `completed` with the returned stable ID.

#### Phase 4: Resilience & Honest Error Handling (2:15 – 3:00)
1. **Test Unsupported / Edge Cases:** Ask an unsupported question.
2. **Show Transparent Fallback:** The assistant politely explains what tools are currently discovered from the MCP server rather than making up answers.
3. **Closing Value:** Highlight that HomePulse bridges modern conversational AI with robust, standardized enterprise tools via the Model Context Protocol.

---

### Troubleshooting Common Demo Issues

- **Badge Shows "MCP Server Disconnected":**
  1. Confirm the MCP server in Terminal 1 is running: `curl http://localhost:8081/health`.
  2. If the MCP server is on a different port, update `MCP_SERVER_URL` in `homepulse/simulator-backend/.env` and restart the backend.
- **Frontend Fails to Connect to Simulator:**
  1. Ensure the simulator backend is running on port 3000: `curl http://localhost:3000/api/v1/status`.
  2. Verify `VITE_SIMULATOR_API_URL=http://localhost:3000` in `homepulse/client/.env`.
- **Port Conflicts (`EADDRINUSE`):**
  - Port 8081: `fuser -k 8081/tcp` or `lsof -i :8081`
  - Port 3000: `fuser -k 3000/tcp` or `lsof -i :3000`
  - Port 5173: `fuser -k 5173/tcp` or `lsof -i :5173`

---


## 2. Project Goal and Scope

Build **HomePulse**, a browser-based Alexa+-style conversational household assistant. The user can ask about chores and saved notes, add a chore, and complete a chore through follow-up conversation.

The project simulates the Alexa+-style interaction; it does **not** connect to a physical Echo device or Amazon's proprietary Alexa+ backend. The web experience is simulated, but tool execution and returned data should be real.

### V1 workflows

1. **Read household information:** “What chores are due today?”
2. **Create a chore:** “Add buying groceries for tomorrow.”
3. **Follow-up:** “Mark that as completed.”
4. **Search a saved note:** “What is the Wi-Fi note?”
5. **Show the work performed:** visible tool name, status, and a safe summary for each tool call.

Keep the first version small and reliable. Voice input, multi-agent architecture, smart-home hardware, and advanced integrations are optional and should not delay the three end-to-end workflows.

## 3. The Updated Architecture

The original plan's generic “conversation engine → action/tool layer → database” now needs a precise boundary: the action/tool layer is the teammate's independent MCP server, and the simulator calls it through the standard MCP protocol.

```text
┌─────────────────────────────────────────────────────────┐
│ Browser: Web UI (YOU)                                   │
│ React + Vite + TypeScript + Tailwind                    │
│ Chat, suggested prompts, task cards, confirmation UI,   │
│ action trace                                            │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP application API
                           │ POST /api/v1/chat
                           │ POST /api/v1/chat/confirm
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Simulation backend (YOU)                                │
│ Node.js + Express                                       │
│ Conversation/session context                            │
│ Intent understanding / optional LLM planner             │
│ MCP client: initialize, tools/list, tools/call           │
│ Schema-aware argument validation, confirmations, traces │
└──────────────────────────┬──────────────────────────────┘
                           │ MCP Streamable HTTP
                           │ JSON-RPC 2.0
                           │ MCP protocol version 2025-11-25
                           ▼
┌─────────────────────────────────────────────────────────┐
│ MCP server (TEAMMATE)                                   │
│ Independent MCP endpoint: POST /mcp                    │
│ Publishes tools and JSON Schemas                        │
│ Validates arguments and runs business logic             │
│ Owns task/note data operations and persistence          │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
                 Database / external services
```

### Ownership boundaries

| Area | Owner | Responsibility |
|---|---|---|
| Browser UI | You | Chat UX, task cards, prompts, pending confirmation screen, action trace |
| Simulation REST API | You | Stable UI-facing API, conversation IDs, response formatting |
| Conversation engine | You | Understand the user request, choose a discovered tool, manage follow-ups |
| MCP client | You | MCP handshake, dynamic tool discovery, tool calls, session and error handling |
| MCP server | Teammate | MCP endpoint, tool definitions/schemas, server-side validation and operations |
| Data/persistence for MCP tools | Teammate | Store/read tasks and notes, return stable IDs and structured results |
| End-to-end integration | Both | Agree tool catalogue, test real tool calls, verify errors and confirmations |

The MCP server must not depend on the web UI, the simulator's REST routes, its LLM, or its conversation history. The simulator must not bypass MCP by calling the teammate's database or business functions directly.

## 4. Decisions to Lock Together Before Coding

Have a short kickoff and agree to these items in writing:

1. **Product scope:** HomePulse household chores and notes for V1.
2. **Protocol:** MCP `2025-11-25` over Streamable HTTP, using an MCP SDK where practical.
3. **Endpoint:** Local default `http://localhost:8081/mcp`; configurable through `MCP_SERVER_URL`.
4. **Simulator API:** `POST /api/v1/chat` and `POST /api/v1/chat/confirm`.
5. **Tool catalogue:** Confirm the proposed tools in Section 6. These are a team agreement target, not a catalogue the simulator hard-codes.
6. **Confirmation policy:** The simulator asks the user before calling tools that create or modify data. In V1, this includes adding or completing a chore.
7. **Response shape:** Follow Section 7 so the frontend can be built before MCP integration is finished.
8. **Runtime and language:** Your side uses Node.js/Express unless you already chose another runtime. The teammate can use the language/framework they prefer as long as it implements the agreed MCP protocol.
9. **Test fixture:** Decide whether to use a temporary MCP-compatible test server or wait for the teammate's first runnable server. Do not substitute a custom REST API and call it MCP.

Do not wait for the full server to be complete before starting the UI. Freeze the interfaces first, then develop each component independently.

## 5. Web UI and Simulation Backend Specifications

You own **both** the browser UI and the backend that sits between the UI and the MCP server. This middle backend is essential; do not put MCP connection logic or secrets in browser code.

### 4.1 Web UI

Recommended stack: React, Vite, TypeScript, Tailwind CSS.

Suggested components:

| Component | Responsibility |
|---|---|
| `AppLayout` | Main responsive layout |
| `ChatPanel` | Conversation history |
| `ChatMessage` | User and assistant message display |
| `MessageComposer` | Text input, send button, loading state |
| `SuggestedPrompts` | One-click demo commands |
| `TaskCard` | Render task data returned by tools |
| `ConfirmationCard` | Confirm/reject pending operation |
| `ActionTracePanel` | Tool name, status and safe result summary |
| `ConnectionStatus` | Show whether simulator backend and MCP server are available |
| `TaskSidebar` | Optional view of tasks returned by the backend |

The UI should distinguish:
- the assistant's natural-language response;
- the actual action/result returned by the MCP tool;
- a pending confirmation that has **not** executed yet;
- a failed tool call.

The browser should call only the simulation API. It must never call `/mcp` directly.

### 4.2 Simulation backend

Recommended stack: Node.js + Express, plus an MCP client SDK compatible with the target protocol.

Suggested modules:

```text
simulator-backend/
└── src/
    ├── routes/
    │   ├── chat.js
    │   ├── confirmation.js
    │   └── status.js
    ├── conversation/
    │   ├── orchestrator.js
    │   ├── contextStore.js
    │   └── planner.js
    ├── mcp/
    │   ├── client.js
    │   ├── toolRegistry.js
    │   ├── schemaValidation.js
    │   └── errors.js
    ├── traces/
    │   └── traceFormatter.js
    └── index.js
```

Keep the module boundaries simple. The names are suggestions, not required filenames.

### 4.3 Request lifecycle

For every chat turn, the simulation backend should:

1. Accept the user's message and optional `conversationId`.
2. Create a conversation ID if none was supplied.
3. Ensure the MCP connection has been initialized.
4. Obtain the current tool list using MCP `tools/list`, using a bounded cache (for example, 60 seconds).
5. Provide the discovered tool names, descriptions, and input schemas to the planner.
6. Select a tool, or ask a clarifying question if no safe selection can be made.
7. Validate the arguments against the discovered schema. Do not invent fields.
8. If the operation has a side effect, return `awaiting_confirmation` without calling the tool yet.
9. After user confirmation, call the tool using MCP `tools/call`.
10. Use the actual MCP result to form the final assistant response.
11. Return the response and safe action trace to the UI.

The MCP server does not need to parse the user's original natural-language message. It only receives structured tool calls.

## 6. MCP Client Implementation Requirements

Use the MCP SDK where practical rather than implementing an incompatible protocol manually.

### Connection and initialization

- Connect to the configured `MCP_SERVER_URL`.
- Initialize using protocol version `2025-11-25`.
- Send `notifications/initialized` after successful initialization.
- Send the negotiated `MCP-Protocol-Version` header on subsequent requests.
- If the server returns `MCP-Session-Id`, retain it and send it on later requests in that session.
- Do not assume every server uses session IDs.
- Recover from a lost session by initializing a new session where appropriate. Do not blindly replay a side-effecting tool call.

### Dynamic tool discovery

The simulator must call `tools/list` and use the tool definitions returned by the server at runtime.

- Do not duplicate each tool's schema in a simulator-side constant or frontend file.
- Do not assume tools are available before discovery.
- Handle `nextCursor` pagination if present.
- Cache definitions for a short period, such as 60 seconds, and refresh after a relevant tool-list-change notification or an unknown-tool response.
- If the chosen planner uses an LLM, provide the discovered names, descriptions, and schemas to it.
- If the first version uses deterministic intent matching, match the request to the **currently discovered** tool names and descriptions, then validate arguments against that tool's current schema.

The team may agree on stable tool names for the HomePulse domain, but the live MCP catalogue remains the source of truth.

### Calling tools

Use `tools/call` with the exact discovered tool name and arguments that conform to its `inputSchema`.

- Capture `content`, `structuredContent` when supplied, and `isError`.
- Prefer structured results for rendering task cards and passing stable IDs to later calls.
- Treat `isError: true` as tool failure even if the request was transported successfully.
- Never state an operation succeeded if the tool failed, timed out, or returned an uncertain outcome.
- Bound a turn to a configurable maximum of 8 tool calls.
- Use a request timeout of about 20 seconds initially.

## 7. Proposed HomePulse Tool Catalogue

The integration contract says the final domain/tool names are to be agreed separately. Use this section as the **proposal to review with your teammate**, not as an already-finalized server contract.

| Proposed tool | Purpose | Inputs to agree | Side effect? |
|---|---|---|---|
| `list_tasks` | Find household tasks | Optional date range and completion filter | No |
| `add_chore` | Create a chore | Title, due date, optional assignee | Yes — confirm first |
| `complete_task` | Mark a chore complete | Stable task ID | Yes — confirm first |
| `search_notes` | Find saved household notes | Search query | No |
| `get_household_summary` | Return a concise summary for a date range | Optional date/date range | No; optional for V1 |

The original idea's `add_chore`, `list_tasks`, and `search_notes` are the core proposed tools. `complete_task` supports the follow-up demo. `get_household_summary` is optional.

### Tool-definition expectations

For every tool, the MCP server should publish:
- a unique stable `snake_case` name;
- a clear description explaining when it should be used and any side effects;
- an accurate JSON Schema `inputSchema`;
- an `outputSchema` when the output is predictable and structured;
- stable IDs for tasks referenced by later calls.

The teammate must validate arguments on the server. Simulator-side validation improves user experience but is not a substitute for server validation.

### Example `list_tasks` output shape

The exact structure should be agreed before implementation, but predictable task results should include stable IDs. For example:

```json
{
  "tasks": [
    {
      "id": "task_123",
      "title": "Water the plants",
      "dueDate": "2026-10-20",
      "completed": false
    }
  ]
}
```

For success, MCP tool results should include a useful text block in `content`; where appropriate, also return machine-readable `structuredContent`. For a business/tool error, return a valid tool result with `isError: true` and a safe explanation. Reserve JSON-RPC errors for protocol-level issues such as an invalid request or unknown method.

## 8. Contract Between Frontend and Simulation Backend

This is an application-level API separate from MCP. Keep it stable so the frontend and simulator backend can be developed in parallel.

### `POST /api/v1/chat`

Request:

```json
{
  "conversationId": "optional-existing-conversation-id",
  "message": "Add buying groceries for tomorrow."
}
```

Response when complete:

```json
{
  "conversationId": "conv_abc123",
  "status": "completed",
  "assistantMessage": "The task has been added.",
  "toolCalls": [
    {
      "toolName": "add_chore",
      "status": "success",
      "summary": "Added a chore due tomorrow."
    }
  ]
}
```

Response when confirmation is required:

```json
{
  "conversationId": "conv_abc123",
  "status": "awaiting_confirmation",
  "assistantMessage": "I can add “Buy groceries” for tomorrow. Should I proceed?",
  "confirmationId": "confirm_xyz789",
  "pendingAction": {
    "toolName": "add_chore",
    "summary": "Create the chore “Buy groceries” with tomorrow's due date."
  },
  "toolCalls": [
    {
      "toolName": "add_chore",
      "status": "awaiting_confirmation",
      "summary": "Waiting for user confirmation; the tool has not been called."
    }
  ]
}
```

Response when the request fails:

```json
{
  "conversationId": "conv_abc123",
  "status": "failed",
  "assistantMessage": "I could not reach the household service. No change was made.",
  "toolCalls": [
    {
      "toolName": "list_tasks",
      "status": "error",
      "summary": "The household service is unavailable."
    }
  ]
}
```

Required meanings:
- `conversationId`: created by the backend if omitted; reused for follow-ups.
- `status`: one of `completed`, `awaiting_confirmation`, or `failed`.
- `assistantMessage`: safe user-facing response.
- `toolCalls`: concise activity trace; each entry includes `toolName`, `status`, and `summary`.
- `confirmationId` and `pendingAction`: returned when confirmation is needed.
- Never return secrets, raw credentials, stack traces, or large unnecessary payloads.

### `POST /api/v1/chat/confirm`

Proposed confirmation endpoint (agree to this path before coding):

Request:

```json
{
  "conversationId": "conv_abc123",
  "confirmationId": "confirm_xyz789",
  "decision": "approve"
}
```

`decision` is `approve` or `reject`.

- If rejected, do not call the MCP tool. Return a completed response explaining that no change was made.
- If approved, retrieve the server-held pending action and invoke the tool with the previously validated arguments.
- Do not trust new tool arguments supplied by the browser during confirmation.
- A confirmation ID must be stable, short-lived, and single-use.
- Return the final tool result and action trace using the same response conventions as `/api/v1/chat`.
- If a confirmation has expired or has already been consumed, return a clear error and do not execute the action.

The simulator backend should hold the pending tool name and validated arguments server-side. Do not put secrets or unrestricted arguments in a client-controlled confirmation payload.

### Optional `GET /api/v1/status`

Useful for development and the demo UI:

```json
{
  "simulator": "ready",
  "mcpServer": "connected",
  "discoveredToolCount": 4
}
```

This endpoint is optional and must report actual connection status, not a fixed mock status.

## 9. Error Handling and Safe Retries

Distinguish an MCP transport/protocol failure from a valid tool result that reports a business error.

| Situation | Required behavior |
|---|---|
| MCP server cannot be reached | Show a clear unavailable message; do not fabricate a result |
| Initialization fails or version is unsupported | Stop calls and show an actionable setup/protocol error |
| `tools/list` fails | Do not guess the available tool list |
| Tool name is unknown | Refresh `tools/list` once; do not retry indefinitely |
| Arguments fail schema validation | Ask for missing information or correct the plan; do not blindly retry |
| Tool returns `isError: true` | Explain the failure and do not claim success |
| Transient HTTP `429` / `5xx` | Use a small bounded retry only when safe |
| Timeout during a side-effecting call | Check the outcome or report uncertainty; do not blindly repeat |
| Malformed JSON / mismatched JSON-RPC ID | Treat as protocol failure and ignore the invalid result |
| Confirmation rejected | Do not call the tool |
| Confirmation expires or is replayed | Do not execute the pending action |

Use safe server-side logging for timestamps, request/correlation IDs, MCP method, tool name, duration, and outcome. Redact sensitive values. The UI trace should show a concise summary rather than dumping raw arguments or personal data.

## 10. Environment Configuration and Local Run Setup

Suggested local ports:

| Service | Port | Local URL |
|---|---:|---|
| Web UI | 5173 | `http://localhost:5173` |
| Simulation backend | 3000 | `http://localhost:3000` |
| MCP server | 8081 | `http://localhost:8081/mcp` |

### Your simulator backend `.env`

```dotenv
PORT=3000
WEB_ORIGIN=http://localhost:5173

MCP_SERVER_URL=http://localhost:8081/mcp
MCP_PROTOCOL_VERSION=2025-11-25
MCP_CLIENT_NAME=alexa-plus-simulator
MCP_CLIENT_VERSION=0.1.0
MCP_REQUEST_TIMEOUT_MS=20000
MCP_MAX_TOOL_CALLS_PER_TURN=8
MCP_TOOL_CACHE_TTL_MS=60000
```

### Frontend configuration

```dotenv
VITE_SIMULATOR_API_URL=http://localhost:3000
```

This frontend variable is a public base URL, not a secret. Do not place MCP credentials or server-only configuration in `VITE_*` variables.

### Teammate's MCP server configuration

At minimum, agree on:
- listen port `8081` for local development;
- endpoint path `/mcp`;
- protocol version target `2025-11-25`;
- allowed local `Origin` values;
- persistence configuration and seed/reset instructions.

Use `.env.example` files with placeholders; never commit actual API keys, tokens, or private credentials.

### Docker networking

If all services run in Docker Compose, `localhost` inside the simulator container refers to the simulator container, not the MCP server container. In that case use:

```dotenv
MCP_SERVER_URL=http://mcp-server:8081/mcp
```

Use the actual Compose service name. For a remote MCP endpoint, use HTTPS.

## 11. Repository and Development Workflow

Recommended monorepo layout:

```text
homepulse/
├── client/                    # You: React/Vite UI
├── simulator-backend/         # You: REST API + MCP client
├── mcp-server/                # Teammate: independent MCP server
├── docs/
│   ├── integration-contract.md
│   ├── architecture.md
│   └── demo-script.md
├── .env.example
└── README.md
```

If you and your teammate use separate repositories, keep the same folder responsibilities and commit the integration contract to both repositories or link to one shared version. The important point is that both sides work from the same contract version.

### Parallel workflow

**You**
1. Build the UI against the agreed frontend API response types.
2. Build `POST /api/v1/chat` and the MCP client.
3. For early UI work, use frontend fixtures or an MCP-compatible test server.
4. Replace fixtures with the real MCP endpoint as soon as the teammate's server is runnable.

**Teammate**
1. Implement the MCP server and the proposed agreed tool catalogue.
2. Test initialization, `tools/list`, and `tools/call` independently.
3. Provide a runnable command, `.env.example`, seed data, and at least one sample success and failure.
4. Notify you whenever a tool name or schema changes.

**Together**
1. Review and freeze tool names/schemas before full integration.
2. Run all three MCP protocol steps against the actual server.
3. Test the chat API and confirmation flow from the UI.
4. Keep contract changes explicit in a shared commit or message; do not silently change response fields or tool schema.

## 12. Integration Milestones and Acceptance Tests

### Milestone A — Contract locked

- [ ] Confirm domain and tool list.
- [ ] Agree `POST /api/v1/chat` response shape.
- [ ] Agree `POST /api/v1/chat/confirm`.
- [ ] Agree server port, `/mcp` path, protocol version, and auth needs.
- [ ] Commit this updated plan and the integration contract.

### Milestone B — Components work independently

**Your side**
- [ ] Frontend can render a completed, failed, and awaiting-confirmation response.
- [ ] Simulator backend can start without the MCP server and return a truthful unavailable status.
- [ ] MCP client supports initialization, session headers, dynamic `tools/list`, and `tools/call`.

**Teammate's side**
- [ ] MCP server runs at the agreed URL.
- [ ] MCP Inspector or another compatible client can initialize and discover tools.
- [ ] At least one read-only and one side-effecting tool work.
- [ ] Invalid inputs return safe errors without crashing the server.

### Milestone C — End-to-end integration

- [ ] Simulator initializes with protocol version `2025-11-25`.
- [ ] Simulator sends `notifications/initialized`.
- [ ] Simulator discovers the actual server tools dynamically.
- [ ] The UI does not call the MCP server directly.
- [ ] A read-only task query returns real server data.
- [ ] Adding a chore first returns `awaiting_confirmation`, without calling the tool.
- [ ] Rejecting the confirmation makes no change.
- [ ] Approving the confirmation calls the actual MCP tool once and displays its result.
- [ ] A later query shows the new task using a stable ID.
- [ ] The follow-up completion flow targets the correct task.
- [ ] A tool's `isError: true` appears as a failure, not success.
- [ ] An unavailable MCP server yields a useful error and no fabricated data.
- [ ] Unknown-tool handling refreshes the tool list once.
- [ ] Tool calls are bounded by `MCP_MAX_TOOL_CALLS_PER_TURN`.
- [ ] The app works with local URLs and, if used, Docker service names.

### Milestone D — Demo ready

- [ ] Seed data and reset flow make the demo repeatable.
- [ ] Action trace shows tool name, result status, and safe summary.
- [ ] Loading states and errors are polished.
- [ ] README explains running the UI, simulator backend, and MCP server.
- [ ] No secrets are committed.
- [ ] Demo video shows actual tool calls/results, not mocked success.
- [ ] Submission language accurately describes a web-based simulation and its MCP integration.

## 13. Recommended Demo Sequence

Aim for a repeatable two-to-three-minute walkthrough.

1. **Show the HomePulse UI.** Mention that it is an Alexa+-style web simulation, not a physical Alexa device.
2. **Ask a read-only question:** “What chores are due today?” Show the real `list_tasks` result and action trace.
3. **Request a change:** “Add buying groceries for tomorrow.” Show the confirmation card. Before approval, make it clear the MCP tool has not executed yet.
4. **Confirm the action.** Show the successful `add_chore` result and the new stable task ID.
5. **Ask a follow-up:** “Mark that as completed.” Confirm if required, execute the tool, then query or refresh to show the updated state.
6. **Show the engineering trace:** tool names and statuses, plus a quick view of the MCP server tool list if helpful.
7. **Close with the value:** the assistant can perform real, stateful operations through tools rather than merely generating chat text.

Always distinguish the simulated Alexa+-style UI from the actual MCP protocol and server operations.

## 14. Time-Boxed Build Plan

Use these as work phases and adjust the calendar to the confirmed hackathon deadline.

### Phase 1 — Interface freeze (first working session)

- Agree tool names, schema expectations, API fields, confirmation flow, ports, and environment variables.
- Create shared repo/folders and `.env.example`.
- Define TypeScript types for the frontend API response.

**Exit condition:** Both teammates can implement independently without guessing the interface.

### Phase 2 — Parallel implementation

**You**
- Build UI shell and suggested prompts.
- Implement Express chat API and MCP client lifecycle.
- Render traces and confirmation responses using fixtures.

**Teammate**
- Implement MCP server endpoint.
- Publish tool descriptions and schemas.
- Implement business logic, persistence, validation, and safe errors.

**Exit condition:** Each component starts independently and has a minimal smoke test.

### Phase 3 — First integration

- Point `MCP_SERVER_URL` to the real server.
- Verify `initialize` → `notifications/initialized` → `tools/list`.
- Execute one read-only tool before testing mutations.
- Connect tool results to UI cards and traces.

**Exit condition:** One real task query works from browser to MCP server and back.

### Phase 4 — Stateful workflow and confirmation

- Add a chore with confirmation.
- Test approve and reject.
- Test follow-up using the stable ID.
- Confirm persistence and correct status after a refresh.

**Exit condition:** All three core workflows work without mocked success.

### Phase 5 — Stabilization and submission

- Test unavailable server, invalid arguments, tool errors, timeouts, and ambiguous requests.
- Polish loading/error/empty states.
- Write setup docs and record the demo.
- Freeze features before the final rehearsal.

**Exit condition:** A clean checkout can run using the README and complete the demo script.

## 15. Important Implementation & Demonstration Rules

1. **Standard MCP is the simulator-to-server boundary.** Do not replace it with a custom REST tool API.
2. **The browser never talks directly to MCP.** All MCP sessions and server-only configuration stay in the simulation backend.
3. **Discover tools at runtime.** `tools/list` is the source of truth; do not hard-code the catalogue or schemas in the simulator.
4. **The server validates everything.** Client-side/schema validation is helpful but does not replace server validation.
5. **Confirm side effects first.** A pending confirmation must not call the tool until the user approves.
6. **Use real results.** Never report success for an action the MCP server did not confirm.
7. **Keep errors honest.** Do not invent results when MCP is down or a tool returns an error.
8. **Keep calls bounded.** Use the agreed timeout, call limit, and safe retry policy.
9. **Use stable IDs.** Follow-up operations must refer to the exact record returned by a prior tool.
10. **Protect secrets and personal data.** Redact logs, avoid committing credentials, and minimize what is stored.

## 16. Source Contract and References

This plan aligns to the team's `alexa_plus_simulator_mcp_contract.md`, which specifies:
- MCP `2025-11-25` over Streamable HTTP;
- initialization, `notifications/initialized`, dynamic `tools/list`, and `tools/call`;
- the simulator-to-UI API at `POST /api/v1/chat`;
- bounded tool execution, schema validation, confirmation for side effects, and safe error handling.

Official references listed in the integration contract:
- MCP Streamable HTTP transport: <https://modelcontextprotocol.io/specification/2025-11-25/basic/transports>
- MCP server tools: <https://modelcontextprotocol.io/specification/2025-11-25/server/tools>
- Alexa+ MCP Toolkit overview: <https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview>
- Alexa+ MCP QuickStart: <https://www.developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart>
- Amazon AppDev 2026 hackathon rules: <https://amazonappdev2026.devpost.com/rules>
- Amazon AppDev 2026 FAQ: <https://amazonappdev2026.devpost.com/details/faqs>
