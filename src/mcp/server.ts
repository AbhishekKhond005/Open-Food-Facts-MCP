/**
 * MCP Server setup using the official @modelcontextprotocol/sdk.
 * Creates the server instance, registers tools from the registry,
 * and configures capabilities per contract section 5.2.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toolRegistry, validateRegistry } from "../tools/index.js";
import { logger } from "../logging.js";
import { z } from "zod";

/**
 * Create and configure the MCP server with all tools registered.
 */
export function createMcpServer(): McpServer {
  // Validate the tool registry at startup (fail fast)
  validateRegistry();
  logger.info("Tool registry validated", { toolCount: toolRegistry.length });

  const server = new McpServer(
    {
      name: "open-food-facts-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      instructions:
        "This MCP server provides food product information from the Open Food Facts database. " +
        "You can look up products by barcode, search by name/brand, get detailed nutrition info, " +
        "check dietary suitability (vegetarian, vegan, gluten-free), identify allergens, " +
        "analyze ingredients and additives, compare products, and find healthier alternatives. " +
        "All data comes from the community-driven Open Food Facts project.",
    }
  );

  // Register each tool from the registry with the SDK
  for (const tool of toolRegistry) {
    // Build a zod schema from the inputSchema properties for SDK registration
    const zodShape: Record<string, z.ZodTypeAny> = {};
    const properties = (tool.inputSchema.properties || {}) as Record<string, Record<string, unknown>>;
    const required = (tool.inputSchema.required || []) as string[];

    for (const [propName, propDef] of Object.entries(properties)) {
      let zodField: z.ZodTypeAny;

      if (propDef.type === "string") {
        zodField = z.string().describe(String(propDef.description || ""));
      } else if (propDef.type === "number") {
        zodField = z.number().describe(String(propDef.description || ""));
      } else if (propDef.type === "array") {
        const itemType = (propDef.items as Record<string, unknown>)?.type;
        if (itemType === "string") {
          zodField = z.array(z.string()).describe(String(propDef.description || ""));
        } else {
          zodField = z.array(z.any()).describe(String(propDef.description || ""));
        }
      } else {
        zodField = z.any().describe(String(propDef.description || ""));
      }

      if (!required.includes(propName)) {
        zodField = zodField.optional();
      }

      zodShape[propName] = zodField;
    }

    const toolName = tool.name;
    const toolHandler = tool.handler;

    server.tool(
      toolName,
      tool.description,
      zodShape,
      async (args: Record<string, unknown>) => {
        const startTime = Date.now();
        const correlationId = `tool-${toolName}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        logger.info("Tool call started", {
          correlationId,
          method: "tools/call",
          toolName,
        });

        try {
          const result = await toolHandler(args);
          const duration = Date.now() - startTime;

          logger.info("Tool call completed", {
            correlationId,
            method: "tools/call",
            toolName,
            duration,
            isError: result.isError,
          });

          return {
            content: result.content,
            structuredContent: result.structuredContent,
            isError: result.isError,
          };
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error("Tool call unexpected error", {
            correlationId,
            method: "tools/call",
            toolName,
            duration,
            error: (error as Error).message,
          });

          // Never expose stack traces or internals (R21)
          return {
            content: [
              {
                type: "text" as const,
                text: "An unexpected error occurred while processing your request. Please try again.",
              },
            ],
            isError: true,
          };
        }
      }
    );

    logger.info("Tool registered", { toolName, description: tool.description.substring(0, 80) + "..." });
  }

  logger.info("MCP server created", {
    serverName: "open-food-facts-mcp",
    serverVersion: "1.0.0",
    toolCount: toolRegistry.length,
    toolNames: toolRegistry.map((t) => t.name),
  });

  return server;
}
