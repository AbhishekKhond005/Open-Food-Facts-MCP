/**
 * Tool Registry
 * Single source of truth for all tools exposed by the MCP server.
 * tools/list is generated from this registry.
 */

import { getProductByBarcodeTool } from "./get_product_by_barcode.js";
import { searchProductsTool } from "./search_products.js";
import { getNutritionInfoTool } from "./get_nutrition_info.js";
import { checkDietaryPreferencesTool } from "./check_dietary_preferences.js";
import { checkAllergensTool } from "./check_allergens.js";
import { analyzeIngredientsTool } from "./analyze_ingredients.js";
import { compareProductsTool } from "./compare_products.js";
import { findAlternativesTool } from "./find_alternatives.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<{
    content: { type: string; text: string }[];
    structuredContent?: Record<string, unknown>;
    isError: boolean;
  }>;
}

/**
 * The complete tool catalogue.
 * Order matters for display; put the most commonly used tools first.
 */
export const toolRegistry: ToolDefinition[] = [
  getProductByBarcodeTool as unknown as ToolDefinition,
  searchProductsTool as unknown as ToolDefinition,
  getNutritionInfoTool as unknown as ToolDefinition,
  checkDietaryPreferencesTool as unknown as ToolDefinition,
  checkAllergensTool as unknown as ToolDefinition,
  analyzeIngredientsTool as unknown as ToolDefinition,
  compareProductsTool as unknown as ToolDefinition,
  findAlternativesTool as unknown as ToolDefinition,
];

/**
 * Validate the registry at startup.
 * Checks for duplicate names, missing descriptions, invalid schemas, etc.
 */
export function validateRegistry(): void {
  const names = new Set<string>();

  for (const tool of toolRegistry) {
    // Unique name check
    if (names.has(tool.name)) {
      throw new Error(`Duplicate tool name in registry: "${tool.name}"`);
    }
    names.add(tool.name);

    // snake_case check
    if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
      throw new Error(`Tool name "${tool.name}" is not valid snake_case`);
    }

    // Description check
    if (!tool.description || tool.description.trim().length === 0) {
      throw new Error(`Tool "${tool.name}" has an empty description`);
    }

    // Schema check
    if (!tool.inputSchema || tool.inputSchema.type !== "object") {
      throw new Error(`Tool "${tool.name}" must have an inputSchema with type "object"`);
    }

    // Handler check
    if (typeof tool.handler !== "function") {
      throw new Error(`Tool "${tool.name}" must have a handler function`);
    }
  }
}
