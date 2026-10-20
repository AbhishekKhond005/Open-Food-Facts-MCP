/**
 * Tool: analyze_ingredients
 * Explain ingredients, additives, and E-numbers in a product.
 */

import { getProductByBarcode } from "../services/off-api.js";
import { analyzeIngredients } from "../services/nutrition.js";

export const analyzeIngredientsTool = {
  name: "analyze_ingredients" as const,
  description:
    "Analyze and explain the ingredients of a food product by barcode. " +
    "Identifies additives (E-numbers, INS numbers), emulsifiers, preservatives, and other " +
    "processing aids. Also detects potential allergens within the ingredient text. " +
    "Use this when the user asks 'What are these ingredients?', 'What is maltodextrin?', " +
    "or wants to understand the ingredient list on a food label.",
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

      const analysis = analyzeIngredients(product);

      const additiveSection = analysis.identified_additives.length > 0
        ? `\nIdentified Additives: ${analysis.identified_additives.join(", ")}`
        : "\nNo common additives or E-numbers detected.";

      const allergenSection = analysis.identified_allergens.length > 0
        ? `\nAllergens in Ingredients: ${analysis.identified_allergens.join(", ")}`
        : "";

      const summary = [
        `Ingredient Analysis for: ${product.product_name}`,
        product.brands ? `Brand: ${product.brands}` : null,
        "",
        analysis.ingredients_text
          ? `Ingredients: ${analysis.ingredients_text}`
          : "No ingredient information available.",
        additiveSection,
        allergenSection,
        "",
        ...analysis.explanation,
      ]
        .filter((l) => l !== null)
        .join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
        structuredContent: {
          barcode: product.barcode,
          product_name: product.product_name,
          brands: product.brands,
          ingredient_analysis: analysis,
        },
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unable to analyze ingredients: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
