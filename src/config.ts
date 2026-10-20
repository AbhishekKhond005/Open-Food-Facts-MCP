import dotenv from "dotenv";
dotenv.config();

export interface Config {
  host: string;
  port: number;
  endpointPath: string;
  allowedOrigins: string[];
  logLevel: string;
  offApiBaseUrl: string;
  offApiTimeoutMs: number;
  serverRequestTimeoutMs: number;
  maxRequestBodyBytes: number;
}

function requireEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key]?.trim() || defaultValue;
}

function parseIntOrDefault(key: string, defaultValue: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid configuration: ${key} must be a positive integer, got "${raw}"`);
  }
  return parsed;
}

export function loadConfig(): Config {
  const port = parseIntOrDefault("MCP_SERVER_PORT", 8081);
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid configuration: MCP_SERVER_PORT must be 1-65535, got ${port}`);
  }

  const endpointPath = requireEnvOrDefault("MCP_ENDPOINT_PATH", "/mcp");
  if (!endpointPath.startsWith("/")) {
    throw new Error(`Invalid configuration: MCP_ENDPOINT_PATH must start with "/", got "${endpointPath}"`);
  }

  const allowedOriginsRaw = process.env.MCP_ALLOWED_ORIGINS?.trim() || "";
  const allowedOrigins = allowedOriginsRaw
    ? allowedOriginsRaw.split(",").map((o) => o.trim()).filter(Boolean)
    : [];

  return {
    host: requireEnvOrDefault("MCP_SERVER_HOST", "127.0.0.1"),
    port,
    endpointPath,
    allowedOrigins,
    logLevel: requireEnvOrDefault("LOG_LEVEL", "info"),
    offApiBaseUrl: requireEnvOrDefault("OFF_API_BASE_URL", "https://world.openfoodfacts.org"),
    offApiTimeoutMs: parseIntOrDefault("OFF_API_TIMEOUT_MS", 10000),
    serverRequestTimeoutMs: parseIntOrDefault("SERVER_REQUEST_TIMEOUT_MS", 15000),
    maxRequestBodyBytes: parseIntOrDefault("MAX_REQUEST_BODY_BYTES", 1048576),
  };
}
