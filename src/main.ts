/**
 * Main entry point for the Open Food Facts MCP Server.
 * Loads configuration, initializes services, creates the server, and starts listening.
 * Implements graceful shutdown.
 */

import { loadConfig } from "./config.js";
import { setLogLevel, logger } from "./logging.js";
import { initOffApi } from "./services/off-api.js";
import { createMcpServer } from "./mcp/server.js";
import { createApp } from "./http/app.js";

async function main(): Promise<void> {
  // 1. Load and validate configuration (fail fast)
  const config = loadConfig();
  setLogLevel(config.logLevel);

  logger.info("Configuration loaded", {
    host: config.host,
    port: config.port,
    endpointPath: config.endpointPath,
    logLevel: config.logLevel,
    offApiBaseUrl: config.offApiBaseUrl,
  });

  // 2. Initialize external service clients
  initOffApi({
    baseUrl: config.offApiBaseUrl,
    timeoutMs: config.offApiTimeoutMs,
  });
  logger.info("Open Food Facts API client initialized");

  // 3. Create the MCP server with all tools
  const mcpServer = createMcpServer();

  // 4. Create the HTTP app
  const app = createApp(config, mcpServer);

  // 5. Start listening
  const server = app.listen(config.port, config.host, () => {
    const mcpUrl = `http://${config.host}:${config.port}${config.endpointPath}`;
    logger.info("🚀 Open Food Facts MCP Server is running", {
      url: mcpUrl,
      healthUrl: `http://${config.host}:${config.port}/health`,
    });
    console.log(`\n🚀 Open Food Facts MCP Server is running!`);
    console.log(`   MCP endpoint: ${mcpUrl}`);
    console.log(`   Health check: http://${config.host}:${config.port}/health`);
    console.log(`   Protocol:     MCP 2025-11-25 over Streamable HTTP\n`);
  });

  // 6. Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error: error.message });
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason: String(reason) });
  });
}

main().catch((error) => {
  console.error("Fatal startup error:", error.message);
  process.exit(1);
});
