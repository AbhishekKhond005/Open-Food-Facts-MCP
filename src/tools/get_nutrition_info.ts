/**
 * Tool: get_nutrition_info
 * Get detailed nutritional analysis for a product by barcode.
 */

import { getProductByBarcode } from "../services/off-api.js";
import { summarizeNutrition } from "../services/nutrition.js";

export const getNutritionInfoTool = {
  name: "get_nutrition_info" as const,
  description:
    "Get a detailed nutritional breakdown and health analysis for a food product by barcode. " +
    "Returns Nutri-Score, NOVA group, Eco-Score, calories, key nutrient levels (fat, sugar, salt, protein, fiber), " +
    "and health highlights. Use this when the user asks about nutritional content, calorie count, " +
    "or wants to understand the nutrition label of a specific product.",
  inputSchema: {
    type: "object" as const,
    properties: {
      barcode: {
        type: "string" as const,
        description: "The barcode number of the product.",
        minLength: 4,
        maxLength: 30,
      },
    },
    required: ["barcode"] as const,
    additionalProperties: false as const,
  },
  handler: async (args: { barcode: string }) => {
    const barcode = args.barcode?.trim().replace(/[\s-]/g, "");

    if (!barcode || barcode.length < 4 || !/^\d+$/.test(barcode)) {
      return {
        content: [{ type: "text" as const, text: "Invalid barcode. Please provide a valid numeric barcode." }],
        isError: true,
      };
    }

    try {
      const product = await getProductByBarcode(barcode);

      if (!product) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Product with barcode "${barcode}" was not found. The product may not be in the Open Food Facts database.`,
            },
          ],
          isError: true,
        };
      }

      const nutrition = summarizeNutrition(product);

      const nutrientLines = nutrition.key_nutrients
        .filter((n) => n.value_per_100g !== null)
        .map((n) => `  • ${n.name}: ${n.value_per_100g}${n.unit}/100g (${n.level})`)
        .join("\n");

      const highlights = nutrition.health_highlights.length > 0
        ? `\nHealth Highlights:\n${nutrition.health_highlights.map((h) => `  ⚡ ${h}`).join("\n")}`
        : "";

      const summary = [
        `Nutrition Info for: ${product.product_name}`,
        product.brands ? `Brand: ${product.brands}` : null,
        `Nutri-Score: ${nutrition.nutriscore_grade.toUpperCase()}`,
        nutrition.nova_group !== null ? `NOVA Group: ${nutrition.nova_group}` : null,
        `Eco-Score: ${nutrition.ecoscore_grade.toUpperCase()}`,
        nutrition.calories_per_100g !== null ? `Calories: ${nutrition.calories_per_100g} kcal per 100g` : null,
        nutrientLines ? `\nNutrients per 100g:\n${nutrientLines}` : null,
        highlights,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
        structuredContent: {
          barcode: product.barcode,
          product_name: product.product_name,
          brands: product.brands,
          quantity: product.quantity,
          ...nutrition,
        },
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unable to retrieve nutrition information: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
