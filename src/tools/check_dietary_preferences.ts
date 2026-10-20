/**
 * Tool: check_dietary_preferences
 * Analyze whether a product is suitable for specific diets.
 */

import { getProductByBarcode } from "../services/off-api.js";
import { analyzeDietary } from "../services/nutrition.js";

export const checkDietaryPreferencesTool = {
  name: "check_dietary_preferences" as const,
  description:
    "Analyze whether a food product is suitable for specific dietary preferences. " +
    "Checks if the product appears to be vegetarian, vegan, gluten-free, or dairy-free " +
    "based on its ingredient list and labels. Use this when the user asks about dietary " +
    "suitability, such as 'Is this product vegetarian?' or 'Can I eat this on a vegan diet?'. " +
    "Note: Analysis is based on ingredient text parsing and may not be fully accurate. " +
    "Users should always verify the actual product packaging.",
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
              text: `Product with barcode "${barcode}" was not found in the database.`,
            },
          ],
          isError: true,
        };
      }

      const analysis = analyzeDietary(product);

      const formatBool = (val: boolean | null): string => {
        if (val === null) return "Unknown";
        return val ? "Yes" : "No";
      };

      const summary = [
        `Dietary Analysis for: ${product.product_name}`,
        product.brands ? `Brand: ${product.brands}` : null,
        "",
        `Vegetarian: ${formatBool(analysis.is_vegetarian)}`,
        `Vegan: ${formatBool(analysis.is_vegan)}`,
        `Gluten-Free: ${formatBool(analysis.is_gluten_free)}`,
        `Dairy-Free: ${formatBool(analysis.is_dairy_free)}`,
        `Confidence: ${analysis.confidence}`,
        "",
        ...analysis.notes.map((n) => `Note: ${n}`),
      ]
        .filter((l) => l !== null)
        .join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
        structuredContent: {
          barcode: product.barcode,
          product_name: product.product_name,
          brands: product.brands,
          dietary_analysis: analysis,
        },
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unable to analyze dietary preferences: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
