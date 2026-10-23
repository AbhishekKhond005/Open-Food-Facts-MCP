# 🍎 Open Food Facts MCP Server

> **MCP server for the [Amazon AppDev 2026 Hackathon](https://amazonappdev2026.devpost.com/) — Alexa+ Track**

An MCP (Model Context Protocol) server that provides food product information from the [Open Food Facts](https://world.openfoodfacts.org/) database. Built to integrate with an Alexa+-style simulation frontend via the standard MCP protocol (spec `2025-11-25`, Streamable HTTP transport).

## 🎯 What It Does

This server exposes **8 MCP tools** that enable an AI assistant to help users understand packaged food products:

| Tool | Description |
|------|-------------|
| `get_product_by_barcode` | Look up a food product by barcode (EAN/UPC) — name, brand, ingredients, nutrition, allergens |
| `search_products` | Search products by name, brand, or description with pagination |
| `get_nutrition_info` | Get detailed nutritional breakdown — Nutri-Score, NOVA, calories, nutrient levels |
| `check_dietary_preferences` | Check if a product is vegetarian, vegan, gluten-free, or dairy-free |
| `check_allergens` | Identify allergens and traces with safety disclaimers |
| `analyze_ingredients` | Explain ingredients, additives, E-numbers, and emulsifiers |
| `compare_products` | Compare 2-5 products side by side by sugar, fat, protein, calories, or overall |
| `find_alternatives` | Find healthier alternatives in the same category |

### Example Use Cases

- **"Is this packet of chips high in sodium?"** → `get_product_by_barcode` + `get_nutrition_info`
- **"Which of these two peanut butters is healthier?"** → `compare_products`
- **"What are maltodextrin and INS 621?"** → `analyze_ingredients`
- **"Is this suitable for a vegetarian diet?"** → `check_dietary_preferences`
- **"Does this contain peanuts?"** → `check_allergens`
- **"Find a similar cereal with less sugar"** → `find_alternatives`
- **"Identify this product and summarize it"** → `get_product_by_barcode`

## 🏗️ Architecture

```
Alexa+ Simulation Frontend (MCP Client)
  │  POST /mcp  (JSON-RPC 2.0, Streamable HTTP)
  ▼
┌──────────────────────────────────────┐
│  Open Food Facts MCP Server          │
│  ├─ Express HTTP layer               │
│  │   └─ Origin guard, body limits    │
│  ├─ MCP SDK (protocol handling)      │
│  │   └─ initialize, tools/list,     │
│  │      tools/call                   │
│  ├─ Tool Registry (8 tools)         │
│  │   └─ Input validation per tool    │
│  └─ Services                        │
│      ├─ Open Food Facts API client   │
│      └─ Nutrition analysis engine    │
└──────────────────────────────────────┘
  │
  ▼
Open Food Facts Public API (v2)
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### Install & Run

```bash
# Clone the repository
git clone https://github.com/AbhishekKhond005/Open-Food-Facts-MCP.git
cd Open-Food-Facts-MCP

# Install dependencies
npm install

# Copy environment config (optional — defaults work out of the box)
cp .env.example .env

# Start the server
npm start
```

The server will start at:
- **MCP endpoint:** `http://localhost:8081/mcp`
- **Health check:** `http://localhost:8081/health`

## 🖥️ Run the Alexa+ Simulator

The `homepulse/` directory contains the browser frontend and simulator backend. To run the full demo, start all three services in separate terminals:

1. Start the MCP server using the commands above.
2. Start the simulator backend:

   ```bash
   cd homepulse/simulator-backend
   cp .env.example .env
   npm install
   npm run dev
   ```

3. Start the browser frontend:

   ```bash
   cd homepulse/client
   npm install
   npm run dev
   ```

Open `http://localhost:5173`. The simulator backend connects to `http://localhost:8081/mcp` by default. See [`homepulse/README.md`](homepulse/README.md) for details.

### Development Mode (auto-reload)

```bash
npm run dev
```

### Run Smoke Test

```bash
# With the server running in another terminal:
bash scripts/smoke.sh
```

### Dump Live Tool Catalogue

```bash
bash scripts/dump-tools.sh
```

## 🔧 Configuration

All configuration is via environment variables. See [`.env.example`](.env.example) for the full list.

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_SERVER_HOST` | `127.0.0.1` | Bind address (`0.0.0.0` for Docker) |
| `MCP_SERVER_PORT` | `8081` | Listen port |
| `MCP_ENDPOINT_PATH` | `/mcp` | MCP endpoint path |
| `MCP_ALLOWED_ORIGINS` | *(empty)* | Comma-separated allowed origins |
| `LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warn`, `error`) |
| `OFF_API_BASE_URL` | `https://world.openfoodfacts.org` | Open Food Facts API base URL |
| `OFF_API_TIMEOUT_MS` | `10000` | API request timeout |
| `SERVER_REQUEST_TIMEOUT_MS` | `15000` | Inbound request timeout |

## 🐳 Docker

```bash
# Build and run
docker compose up --build

# The server is available at:
#   http://localhost:8081/mcp       (from host)
#   http://mcp-server:8081/mcp     (from other containers in the same network)
```

## 🔌 Connecting the Simulator

The simulation frontend should set:

```dotenv
MCP_SERVER_URL=http://localhost:8081/mcp
MCP_PROTOCOL_VERSION=2025-11-25
MCP_CLIENT_NAME=alexa-plus-simulator
MCP_CLIENT_VERSION=0.1.0
MCP_REQUEST_TIMEOUT_MS=20000
MCP_MAX_TOOL_CALLS_PER_TURN=8
```

For Docker Compose, use `http://mcp-server:8081/mcp` instead.

### MCP Lifecycle

1. **Initialize** — `POST /mcp` with `initialize` method
2. **Send `notifications/initialized`** — confirms readiness
3. **Discover tools** — `POST /mcp` with `tools/list`
4. **Call tools** — `POST /mcp` with `tools/call`

See the [integration contract](../alexa_plus_simulator_mcp_contract.md) for full protocol details.

## 📁 Project Structure

```
src/
├── main.ts                    # Entry point
├── config.ts                  # Environment configuration
├── logging.ts                 # Structured JSON logger
├── http/
│   └── app.ts                 # Express app with MCP endpoint
├── mcp/
│   └── server.ts              # MCP server setup & tool registration
├── tools/                     # Tool definitions (one file per tool)
│   ├── index.ts               # Tool registry
│   ├── get_product_by_barcode.ts
│   ├── search_products.ts
│   ├── get_nutrition_info.ts
│   ├── check_dietary_preferences.ts
│   ├── check_allergens.ts
│   ├── analyze_ingredients.ts
│   ├── compare_products.ts
│   └── find_alternatives.ts
└── services/                  # Business logic (no MCP types)
    ├── off-api.ts             # Open Food Facts API client
    └── nutrition.ts           # Nutrition analysis engine
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Smoke test (requires running server)
bash scripts/smoke.sh
```

## 📋 MCP Protocol Compliance

| Requirement | Status |
|-------------|--------|
| MCP `2025-11-25` protocol | ✅ |
| Streamable HTTP transport | ✅ |
| Single endpoint (`POST /mcp`) | ✅ |
| `initialize` / `notifications/initialized` | ✅ |
| `tools/list` from registry | ✅ |
| `tools/call` with validation | ✅ |
| `isError: true` for business errors | ✅ |
| JSON-RPC errors for protocol failures | ✅ |
| No stack traces in responses | ✅ |
| Session management (`Mcp-Session-Id`) | ✅ |
| Origin validation | ✅ |
| Structured logging with correlation IDs | ✅ |
| Health endpoint | ✅ |
| Configurable port/path | ✅ |
| Docker support (`mcp-server` service name) | ✅ |

## 📜 License

MIT

## 🏆 Hackathon

Built for the **Amazon AppDev 2026 Hackathon** — **Alexa+ Track**

- [Hackathon Page](https://amazonappdev2026.devpost.com/)
- [Open Food Facts](https://world.openfoodfacts.org/)
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
