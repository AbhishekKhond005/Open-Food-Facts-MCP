import { describe, it, expect } from "vitest";
import { toolRegistry, validateRegistry } from "../src/tools/index.js";

describe("Tool Registry", () => {
  it("validates successfully", () => {
    expect(() => validateRegistry()).not.toThrow();
  });

  it("contains 8 tools", () => {
    expect(toolRegistry).toHaveLength(8);
  });

  it("has unique tool names", () => {
    const names = toolRegistry.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("all tool names are snake_case", () => {
    for (const tool of toolRegistry) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("all tools have non-empty descriptions", () => {
    for (const tool of toolRegistry) {
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("all tools have object inputSchema", () => {
    for (const tool of toolRegistry) {
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("all tools have handler functions", () => {
    for (const tool of toolRegistry) {
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("includes expected tool names", () => {
    const names = toolRegistry.map((t) => t.name);
    expect(names).toContain("get_product_by_barcode");
    expect(names).toContain("search_products");
    expect(names).toContain("get_nutrition_info");
    expect(names).toContain("check_dietary_preferences");
    expect(names).toContain("check_allergens");
    expect(names).toContain("analyze_ingredients");
    expect(names).toContain("compare_products");
    expect(names).toContain("find_alternatives");
  });
});

describe("Tool input validation", () => {
  const getToolByName = (name: string) =>
    toolRegistry.find((t) => t.name === name)!;

  it("get_product_by_barcode rejects invalid barcode", async () => {
    const tool = getToolByName("get_product_by_barcode");
    const result = await tool.handler({ barcode: "abc" } as any);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid barcode");
  });

  it("get_product_by_barcode rejects empty barcode", async () => {
    const tool = getToolByName("get_product_by_barcode");
    const result = await tool.handler({ barcode: "" } as any);
    expect(result.isError).toBe(true);
  });

  it("search_products rejects empty query", async () => {
    const tool = getToolByName("search_products");
    const result = await tool.handler({ query: "" } as any);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid search query");
  });

  it("compare_products rejects fewer than 2 barcodes", async () => {
    const tool = getToolByName("compare_products");
    const result = await tool.handler({ barcodes: ["123"] } as any);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("2 and 5");
  });

  it("compare_products rejects more than 5 barcodes", async () => {
    const tool = getToolByName("compare_products");
    const result = await tool.handler({
      barcodes: ["1", "2", "3", "4", "5", "6"],
    } as any);
    expect(result.isError).toBe(true);
  });

  it("compare_products rejects invalid barcodes", async () => {
    const tool = getToolByName("compare_products");
    const result = await tool.handler({
      barcodes: ["valid123", "abc!"],
    } as any);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid barcode");
  });
});

describe("Tool result shape", () => {
  it("all error results have at least one text content block", async () => {
    const tool = toolRegistry.find((t) => t.name === "get_product_by_barcode")!;
    const result = await tool.handler({ barcode: "invalid!" } as any);
    expect(result.content).toBeInstanceOf(Array);
    expect(result.content.length).toBeGreaterThanOrEqual(1);
    expect(result.content[0].type).toBe("text");
    expect(typeof result.content[0].text).toBe("string");
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });

  it("error results never contain stack traces", async () => {
    const tool = toolRegistry.find((t) => t.name === "get_product_by_barcode")!;
    const result = await tool.handler({ barcode: "invalid!" } as any);
    const text = result.content.map((c: any) => c.text).join(" ");
    expect(text).not.toContain("at ");
    expect(text).not.toContain("Error:");
    expect(text).not.toContain("node_modules");
  });
});
