/**
 * Tool: get_product_by_barcode
 * Looks up a single food product by its barcode (EAN/UPC) using the Open Food Facts database.
 */

import { z } from "zod";
import { getProductByBarcode } from "../services/off-api.js";
import { summarizeNutrition } from "../services/nutrition.js";

export const getProductByBarcodeTool = {
  name: "get_product_by_barcode" as const,
  description:
    "Look up a food product by its barcode (EAN-13, UPC-A, or other standard barcode). " +
    "Returns the product name, brand, ingredients, nutritional values, Nutri-Score, NOVA group, " +
    "allergens, and other key information. Use this when the user has a specific barcode to identify.",
  inputSchema: {
    type: "object" as const,
    properties: {
      barcode: {
        type: "string" as const,
        description: "The barcode number of the product (e.g., '3017624010701' for Nutella).",
        minLength: 4,
        maxLength: 30,
      },
    },
    required: ["barcode"] as const,
    additionalProperties: false as const,
  },
  handler: async (args: { barcode: string }) => {
    const barcode = args.barcode.trim();

    if (!barcode || barcode.length < 4 || barcode.length > 30) {
      return {
        content: [{ type: "text" as const, text: "Invalid barcode. Please provide a valid barcode (4-30 characters)." }],
        isError: true,
      };
    }

    if (!/^[\d\s-]+$/.test(barcode)) {
      return {
        content: [{ type: "text" as const, text: "Invalid barcode format. Barcodes should contain only digits." }],
        isError: true,
      };
    }

    const cleanBarcode = barcode.replace(/[\s-]/g, "");

    try {
      const product = await getProductByBarcode(cleanBarcode);

      if (!product) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Product with barcode "${cleanBarcode}" was not found in the Open Food Facts database. The product may not be cataloged yet.`,
            },
          ],
          isError: true,
        };
      }

      const nutrition = summarizeNutrition(product);

      const summary = [
        `Product: ${product.product_name}`,
        product.brands ? `Brand: ${product.brands}` : null,
        product.quantity ? `Quantity: ${product.quantity}` : null,
        product.categories ? `Categories: ${product.categories}` : null,
        nutrition.nutriscore_grade !== "unknown" ? `Nutri-Score: ${nutrition.nutriscore_grade.toUpperCase()}` : null,
        nutrition.nova_group ? `NOVA Group: ${nutrition.nova_group}` : null,
        nutrition.calories_per_100g !== null ? `Calories: ${nutrition.calories_per_100g} kcal/100g` : null,
        product.allergens ? `Allergens: ${product.allergens}` : null,
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
          categories: product.categories,
          labels: product.labels,
          ingredients_text: product.ingredients_text,
          allergens: product.allergens,
          traces: product.traces,
          nutrition_summary: nutrition,
          image_url: product.image_url,
          image_front_url: product.image_front_url,
          countries: product.countries,
          stores: product.stores,
        },
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unable to retrieve product information: ${(error as Error).message}. Please try again later.`,
          },
        ],
        isError: true,
      };
    }
  },
};
