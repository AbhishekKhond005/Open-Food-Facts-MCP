/**
 * HTTP Application layer.
 * Single MCP endpoint with origin validation, body-size limits, and health check.
 * Per contract: POST /mcp for JSON-RPC, GET /mcp -> SSE or 405, GET /health -> 200.
 *
 * Each session gets its own McpServer + StreamableHTTPServerTransport pair
 * because the SDK binds one server to one transport.
 */

import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "../logging.js";
import type { Config } from "../config.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Factory that creates a fresh McpServer (with all tools registered) */
export type McpServerFactory = () => McpServer;

/**
 * Create the Express application with MCP endpoint.
 */
export function createApp(config: Config, mcpServerFactory: McpServerFactory): express.Express {
  const app = express();

  // Trust proxy for correct IP detection behind reverse proxies
  app.set("trust proxy", 1);

  // ---- Global middleware ----

  // Correlation ID middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).correlationId = req.headers["x-correlation-id"] || randomUUID();
    next();
  });

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.info("HTTP request", {
        correlationId: (req as any).correlationId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        contentType: req.headers["content-type"],
      });
    });
    next();
  });

  // Body size limit
  app.use(
    config.endpointPath,
    express.json({ limit: config.maxRequestBodyBytes })
  );

  // Origin validation middleware (R10)
  app.use(config.endpointPath, (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // If no Origin header is present, allow the request (backend clients don't send Origin)
    if (!origin) {
      return next();
    }

    // If allowed origins are configured, check against them
    if (config.allowedOrigins.length > 0) {
      if (!config.allowedOrigins.includes(origin)) {
        logger.warn("Origin rejected", {
          correlationId: (req as any).correlationId,
          origin,
          allowedOrigins: config.allowedOrigins,
        });
        res.status(403).json({ error: "Origin not allowed" });
        return;
      }
    }

    next();
  });

  // ---- Health endpoint (outside MCP path) ----
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      server: "open-food-facts-mcp",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // ---- MCP Endpoint ----

  // Store transports for session management.
  // Each session has its own McpServer + Transport pair.
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // POST /mcp - Main MCP endpoint for JSON-RPC messages
  app.post(config.endpointPath, async (req: Request, res: Response) => {
    const correlationId = (req as any).correlationId;

    try {
      // Check for existing session
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        // Reuse existing transport for this session
        transport = transports.get(sessionId)!;
      } else if (!sessionId) {
        // New session: create a new transport AND a new McpServer
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports.set(newSessionId, transport);
            logger.info("MCP session initialized", {
              correlationId,
              sessionId: newSessionId,
            });
          },
        });

        // Clean up on close
        transport.onclose = () => {
          const sid = (transport as any).sessionId;
          if (sid) {
            transports.delete(sid);
            logger.info("MCP session closed", { correlationId, sessionId: sid });
          }
        };

        // Create a fresh MCP server for this session and connect it
        const sessionServer = mcpServerFactory();
        await sessionServer.connect(transport);
      } else {
        // Session ID provided but not found -> 404 so client re-initializes (R15)
        logger.warn("Unknown session ID", { correlationId, sessionId });
        res.status(404).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Session not found. Please re-initialize.",
          },
          id: null,
        });
        return;
      }

      // Handle the request through the transport
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error("MCP request handling error", {
        correlationId,
        error: (error as Error).message,
      });

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  // GET /mcp - SSE stream for existing sessions, or 405
  app.get(config.endpointPath, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
    } else {
      res.status(405).json({ error: "Method Not Allowed. Use POST for MCP requests." });
    }
  });

  // DELETE /mcp - Session termination
  app.delete(config.endpointPath, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      transports.delete(sessionId);
      logger.info("MCP session terminated via DELETE", {
        correlationId: (req as any).correlationId,
        sessionId,
      });
    } else {
      res.status(404).json({ error: "Session not found" });
    }
  });

  // ---- Error handling ----
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error("Unhandled error", {
      correlationId: (req as any).correlationId,
      error: err.message,
      path: req.path,
    });

    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return app;
}
