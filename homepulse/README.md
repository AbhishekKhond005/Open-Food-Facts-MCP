# FoodPulse Alexa+ Simulator

FoodPulse is a browser chat interface and backend that demonstrate the Open Food Facts MCP server through real MCP tool calls.

## Architecture

```text
Browser (React/Vite :5173) → Simulator backend (Java :3001) → MCP server (:8081/mcp)
```

The browser calls only the simulator API. The simulator discovers tools from the MCP server and calls them over Streamable HTTP.

## Run the full application

From the repository root, run all three services together with:

```bash
./run.sh
```

The script installs dependencies when needed, checks service health, and prints the frontend URL. Press Ctrl+C to stop services it started. By default it uses ports `8081` (MCP), `3001` (simulator backend), and `5173` (frontend); override these with `MCP_SERVER_PORT`, `SIMULATOR_PORT`, and `VITE_PORT`.

To start each service manually, use separate terminals:

### 1. MCP server

```bash
mvn spring-boot:run
```

The MCP endpoint is `http://localhost:8081/mcp`.

### 2. Simulator backend

```bash
mvn -f homepulse/simulator-java/pom.xml spring-boot:run
```

The simulator API is at `http://localhost:3001`; its health endpoint is `/health` and MCP status is `/api/v1/status`.

### 3. Browser client

```bash
cd homepulse/client
npm install
npm run dev
```

Open `http://localhost:5173`.

## Try it

- Search products by name.
- Look up a product using a barcode.
- Check nutrition, ingredients, allergens, and dietary suitability.
- Compare products or find healthier alternatives by barcode.

The backend uses simple intent matching and requires a barcode for product-specific analysis. Product search returns matching barcodes to use in follow-up prompts.

## Configuration

Set the `MCP_SERVER_URL` environment variable if the MCP server is not at `http://localhost:8081/mcp`. The browser client still requires Node.js and npm.

## MCP API contract

The simulator uses MCP protocol `2025-11-25` over Streamable HTTP. It initializes a session, discovers tools with `tools/list`, and invokes them with `tools/call`. The available tool catalogue is read from the running MCP server at runtime.
