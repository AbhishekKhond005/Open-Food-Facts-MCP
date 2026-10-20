/**
 * Structured logger with correlation ID support and sensitive-data redaction.
 * Per contract R31: timestamp, correlation ID, MCP method, tool name, duration, status.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: string): void {
  if (level in LOG_LEVELS) {
    currentLevel = level as LogLevel;
  }
}

/** Fields to redact in log output */
const REDACT_FIELDS = new Set([
  "password",
  "token",
  "secret",
  "api_key",
  "apiKey",
  "authorization",
]);

function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (REDACT_FIELDS.has(key.toLowerCase())) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redact(value);
      }
    }
    return result;
  }
  return obj;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redact(context || {}),
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("debug")) console.debug(formatMessage("debug", message, context));
  },
  info(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("info")) console.info(formatMessage("info", message, context));
  },
  warn(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("warn")) console.warn(formatMessage("warn", message, context));
  },
  error(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("error")) console.error(formatMessage("error", message, context));
  },
};
