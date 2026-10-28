# Open Food Facts MCP Server

Java implementation of the Open Food Facts MCP server. It exposes the same eight tools over MCP `2025-11-25` Streamable HTTP at `http://localhost:8081/mcp` and provides `GET /health`. The existing TypeScript implementation and its tests remain in `src/` and `tests/` as the JavaScript implementation.

## Requirements

- Java 21 or later
- Maven 3.9+
- Node.js/npm only when running the browser client

## Build and run

```bash
mvn test
mvn spring-boot:run
```

Or build and run the executable jar:

```bash
mvn package
java -jar target/open-food-facts-mcp-1.0.0.jar
```

Run the complete simulator stack from this directory with `./run.sh`. It starts the Java MCP server, Java simulator backend, and existing browser client.

## Configuration

Configuration uses environment variables; defaults work for local development.

| Variable | Default | Description |
| --- | --- | --- |
| `MCP_SERVER_HOST` | `127.0.0.1` | Bind address; Docker sets `0.0.0.0` |
| `MCP_SERVER_PORT` | `8081` | HTTP port |
| `MCP_ENDPOINT_PATH` | `/mcp` | Streamable HTTP endpoint |
| `MCP_ALLOWED_ORIGINS` | empty | Comma-separated allowed origins; absent Origin is allowed |
| `LOG_LEVEL` | `INFO` | Root logging level |
| `OFF_API_BASE_URL` | `https://world.openfoodfacts.org` | Open Food Facts API base URL |
| `OFF_API_TIMEOUT_MS` | `10000` | Upstream API timeout |
| `SERVER_REQUEST_TIMEOUT_MS` | `15000` | MCP request timeout |
| `MAX_REQUEST_BODY_BYTES` | `1048576` | Maximum MCP request size |

## Docker

```bash
docker compose up --build
```

The simulator API is available at `http://localhost:3001`. The MCP service is available at `http://localhost:8081/mcp`, or at `http://mcp-server:8081/mcp` from another Compose service.

## Tool catalogue

`get_product_by_barcode`, `search_products`, `get_nutrition_info`, `check_dietary_preferences`, `check_allergens`, `analyze_ingredients`, `compare_products`, and `find_alternatives`.

The Java implementation is under `src/main/java/com/openfoodfacts/mcp`; JUnit tests are under `src/test/java`. The retained TypeScript implementation can still be run with `npm start` and its existing Vitest checks with `npm test`.

The Java simulator backend is in `homepulse/simulator-java`. Its API remains compatible with the browser client. The original TypeScript MCP server and JavaScript simulator backend are retained in this checkout for comparison and are also available on the `integrated` branch.
