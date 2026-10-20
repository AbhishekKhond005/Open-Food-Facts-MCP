import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

describe("Config", () => {
  it("loads default config successfully", () => {
    const config = loadConfig();
    expect(config.port).toBe(8081);
    expect(config.host).toBe("127.0.0.1");
    expect(config.endpointPath).toBe("/mcp");
    expect(config.logLevel).toBe("info");
    expect(config.offApiBaseUrl).toBe("https://world.openfoodfacts.org");
  });

  it("returns positive timeout values", () => {
    const config = loadConfig();
    expect(config.offApiTimeoutMs).toBeGreaterThan(0);
    expect(config.serverRequestTimeoutMs).toBeGreaterThan(0);
    expect(config.maxRequestBodyBytes).toBeGreaterThan(0);
  });

  it("endpoint path starts with /", () => {
    const config = loadConfig();
    expect(config.endpointPath.startsWith("/")).toBe(true);
  });

  it("allowed origins is an array", () => {
    const config = loadConfig();
    expect(Array.isArray(config.allowedOrigins)).toBe(true);
  });
});
