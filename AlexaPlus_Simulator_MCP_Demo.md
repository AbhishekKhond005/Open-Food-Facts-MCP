# FoodPulse Alexa+ Simulator Demo

## Start the full application

From the repository root, run:

```bash
./run.sh
```

The launcher installs dependencies when they are missing, starts or reuses the MCP server, simulator backend, and web UI, and waits for the MCP connection to become healthy. Open `http://localhost:5173`. Press Ctrl+C to stop services started by the launcher.

Default ports:

| Service | Port |
|---|---:|
| MCP server | 8081 |
| Simulator backend | 3001 |
| Web UI | 5173 |

Override a port when needed by setting `MCP_SERVER_PORT`, `SIMULATOR_PORT`, or `VITE_PORT` before running the launcher.

## Start services manually

Use three terminals from the repository root.

### MCP server

```bash
npm ci
npm start
```

Check `http://localhost:8081/health` for server health.

### Simulator backend

```bash
cd homepulse/simulator-backend
npm ci
npm run dev
```

Check `http://localhost:3001/api/v1/status`. A healthy response reports `"mcpServer":"connected"` and the discovered tool count.

### Web UI

```bash
cd homepulse/client
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Demo prompts

- Search products for peanut butter.
- Check nutrition for barcode `3017624010701`.
- Check allergens or dietary suitability for a product barcode.
- Compare two product barcodes.
- Find healthier alternatives to a product barcode.
