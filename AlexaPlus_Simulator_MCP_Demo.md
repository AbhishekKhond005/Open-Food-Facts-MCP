# HomePulse: Alexa+ Simulation — Demo Guide

Instructions on how to run the application for demonstration purposes.

---

## Architecture & Ports Overview

| Component | Directory | Port / URL | Purpose |
|---|---|---|---|
| **MCP Server** | `./` (Project root) | `http://localhost:8081/mcp` | Open Food Facts MCP Server (Streamable HTTP, protocol `2025-11-25`) |
| **Simulator Backend** | `homepulse/simulator-backend` | `http://localhost:3000` | Express REST API (`/api/v1/chat`, `/api/v1/status`) + MCP Client |
| **Web UI** | `homepulse/client` | `http://localhost:5173` | React + Vite UI with chat, confirmation cards, and action traces |

```text
Browser UI (5173) ──HTTP REST──> Simulator Backend (3000) ──MCP Protocol──> MCP Server (8081)
```

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (`node -v`)
- **npm**: v9.0.0 or higher (`npm -v`)
- Git (`git --version`)

---

## How to Run the Application

Follow these steps to run all three services using 3 separate terminals.

### Step 1: Start the MCP Server (Terminal 1)

1. Open a terminal in the root directory of the cloned repository:
   ```bash
   cd Open-Food-Facts-MCP
   ```
2. Set up environment variables (if `.env` does not already exist):
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm run dev
   # Or for production: npm start
   ```
5. **Verify it is running**:
   ```bash
   curl http://localhost:8081/health
   # Expected output: {"status":"healthy","service":"open-food-facts-mcp"}
   ```

---

### Step 2: Start the Simulator Backend (Terminal 2)

1. Open a second terminal and navigate to the simulator backend directory:
   ```bash
   cd homepulse/simulator-backend
   ```
2. Set up environment variables (if `.env` does not already exist):
   ```bash
   cp .env.example .env
   ```
   *Default `.env` configuration:*
   ```env
   PORT=3000
   WEB_ORIGIN=http://localhost:5173
   MCP_SERVER_URL=http://localhost:8081/mcp
   MCP_PROTOCOL_VERSION=2025-11-25
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the backend:
   ```bash
   npm run dev
   ```
5. **Verify connection to the MCP server**:
   ```bash
   curl http://localhost:3000/api/v1/status
   # Expected output: {"connected":true,"toolsCount":...}
   ```

---

### Step 3: Start the Web UI (Terminal 3)

1. Open a third terminal and navigate to the frontend directory:
   ```bash
   cd homepulse/client
   ```
2. Set up environment variables (if `.env` does not already exist):
   ```bash
   cp .env.example .env
   ```
   *Default `.env` configuration:*
   ```env
   VITE_SIMULATOR_API_URL=http://localhost:3000
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to:
   ```text
   http://localhost:5173
   ```

---

## Alternative: One-Command Quick Launch

From the project root directory, you can run all three services concurrently in the background:

```bash
# Start MCP server in background
npm run dev &

# Start simulator backend in background
(cd homepulse/simulator-backend && npm run dev) &

# Start frontend UI in foreground
(cd homepulse/client && npm run dev)
```

To stop all background processes:
```bash
kill $(jobs -p)
```

---

## Demonstration Walkthrough

1. **Verify Connection**:
   - Check the top-right header badge in the browser (`http://localhost:5173`). It should display **Connected to MCP**.
2. **Execute Queries**:
   - Choose one of the suggested prompts or type a query in the chat box.
   - Inspect the **Action Trace Panel** to see the tool call, parameters, server execution latency, and returned structured result.
3. **Safety & Human-in-the-Loop Confirmation**:
   - Trigger an operation with side effects (e.g. creating/scheduling or completing a task/chore).
   - The UI displays a **Pending Confirmation Card** with status `awaiting_confirmation`. The MCP tool is *not* called until approved.
   - Click **Confirm** to execute the action via MCP `tools/call`.
4. **Transparent Error Handling**:
   - Test an unsupported or ambiguous query to observe the graceful fallback showing discovered tools.

---

## Troubleshooting

- **"MCP Server Disconnected" warning**:
  Check that the MCP server is running on `http://localhost:8081/mcp`. Verify with `curl http://localhost:8081/health`.
- **CORS Error in Browser**:
  Ensure `WEB_ORIGIN=http://localhost:5173` is set in `homepulse/simulator-backend/.env`.
- **Port Conflict (`EADDRINUSE`)**:
  If port 8081, 3000, or 5173 is already in use, terminate the process running on that port:
  - Using npx: `npx kill-port 8081 3000 5173`
  - Linux/macOS: `lsof -ti :8081,:3000,:5173 | xargs kill -9`
  - Windows PowerShell: `Get-Process -Id (Get-NetTCPConnection -LocalPort 8081,3000,5173).OwningProcess | Stop-Process -Force`
