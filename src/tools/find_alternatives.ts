/**
 * Tool: find_alternatives
 * Find healthier alternatives to a given product.
 */

import { getProductByBarcode, searchByCategory } from "../services/off-api.js";
import type { ProductData } from "../services/off-api.js";

export const findAlternativesTool = {
  name: "find_alternatives" as const,
  description:
    "Find healthier alternatives to a given food product within the same category. " +
    "Looks for products with a better Nutri-Score or lower values for the specified criteria. " +
    "Use this when the user says 'Find a similar cereal with less sugar' or 'What is a healthier " +
    "alternative to this snack?'. Results are from the Open Food Facts database and may not " +
    "represent all products available in the user's market.",
  inputSchema: {
    type: "object" as const,
    properties: {
      barcode: {
        type: "string" as const,
        description: "The barcode of the product to find alternatives for.",
        minLength: 4,
        maxLength: 30,
      },
      criteria: {
        type: "string" as const,
        description: "What to optimize for: 'overall' (better Nutri-Score), 'sugar', 'fat', 'salt', or 'calories'. Default: 'overall'.",
        enum: ["overall", "sugar", "fat", "salt", "calories"],
      },
      max_results: {
        type: "number" as const,
        description: "Maximum number of alternatives to return (default: 5, max: 10).",
        minimum: 1,
        maximum: 10,
      },
    },
    required: ["barcode"] as const,
    additionalProperties: false as const,
  },
  handler: async (args: { barcode: string; criteria?: string; max_results?: number }) => {
    const barcode = args.barcode?.trim().replace(/[\s-]/g, "");

    if (!barcode || barcode.length < 4 || !/^\d+$/.test(barcode)) {
      return {
        content: [{ type: "text" as const, text: "Invalid barcode. Please provide a valid numeric barcode." }],
        isError: true,
      };
    }

    const criteria = args.criteria || "overall";
    const maxResults = Math.min(Math.max(args.max_results || 5, 1), 10);

    try {
      // First, get the original product
      const original = await getProductByBarcode(barcode);

      if (!original) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Product with barcode "${barcode}" was not found. Cannot find alternatives without the original product.`,
            },
          ],
          isError: true,
        };
      }

      // Extract a primary category
      const categories = original.categories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      if (categories.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No category information available for ${original.product_name}. Unable to find alternatives in the same category.`,
            },
          ],
          structuredContent: {
            original_barcode: barcode,
            original_product_name: original.product_name,
            alternatives: [],
            message: "No category data available.",
          },
          isError: false,
        };
      }

      // Use the last (most specific) category
      const category = categories[categories.length - 1];

      // Search for products in the same category
      const searchResult = await searchByCategory(category, 1, 50);

      // Filter and rank alternatives
      const gradeOrder: Record<string, number> = { a: 1, b: 2, c: 3, d: 4, e: 5 };
      const originalGrade = gradeOrder[original.nutrition_grades?.toLowerCase() || ""] ?? 6;

      let alternatives: ProductData[] = searchResult.products
        .filter((p) => p.barcode !== barcode && p.product_name && p.product_name !== "Unknown");

      // Sort by criteria
      if (criteria === "sugar") {
        alternatives.sort(
          (a, b) => (a.nutriments.sugars_100g ?? 999) - (b.nutriments.sugars_100g ?? 999)
        );
      } else if (criteria === "fat") {
        alternatives.sort(
          (a, b) => (a.nutriments.fat_100g ?? 999) - (b.nutriments.fat_100g ?? 999)
        );
      } else if (criteria === "salt") {
        alternatives.sort(
          (a, b) => (a.nutriments.salt_100g ?? 999) - (b.nutriments.salt_100g ?? 999)
        );
      } else if (criteria === "calories") {
        alternatives.sort(
          (a, b) =>
            (a.nutriments.energy_kcal_100g ?? 999) - (b.nutriments.energy_kcal_100g ?? 999)
        );
      } else {
        // Overall: prefer better Nutri-Score
        alternatives.sort(
          (a, b) =>
            (gradeOrder[a.nutrition_grades?.toLowerCase() || ""] ?? 6) -
            (gradeOrder[b.nutrition_grades?.toLowerCase() || ""] ?? 6)
        );
      }

      alternatives = alternatives.slice(0, maxResults);

      if (alternatives.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No alternatives found for ${original.product_name} in the "${category}" category.`,
            },
          ],
          structuredContent: {
            original_barcode: barcode,
            original_product_name: original.product_name,
            category_searched: category,
            alternatives: [],
          },
          isError: false,
        };
      }

      const altList = alternatives
        .map((p, i) => {
          const parts = [
            `${i + 1}. ${p.product_name}`,
            p.brands ? `   Brand: ${p.brands}` : null,
            `   Barcode: ${p.barcode}`,
            p.nutrition_grades ? `   Nutri-Score: ${p.nutrition_grades.toUpperCase()}` : null,
            p.nutriments.sugars_100g !== undefined ? `   Sugar: ${p.nutriments.sugars_100g}g/100g` : null,
            p.nutriments.fat_100g !== undefined ? `   Fat: ${p.nutriments.fat_100g}g/100g` : null,
            p.nutriments.energy_kcal_100g !== undefined ? `   Calories: ${p.nutriments.energy_kcal_100g} kcal/100g` : null,
          ];
          return parts.filter(Boolean).join("\n");
        })
        .join("\n\n");

      const summary = [
        `Alternatives to: ${original.product_name} (${original.nutrition_grades?.toUpperCase() || "?"})`,
        `Category: ${category}`,
        `Sorted by: ${criteria}`,
        "",
        altList,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
        structuredContent: {
          original_barcode: barcode,
          original_product_name: original.product_name,
          original_nutriscore: original.nutrition_grades || "unknown",
          category_searched: category,
          criteria_used: criteria,
          alternatives: alternatives.map((p) => ({
            barcode: p.barcode,
            product_name: p.product_name,
            brands: p.brands,
            nutriscore_grade: p.nutrition_grades || "unknown",
            nova_group: p.nova_group,
            sugar_per_100g: p.nutriments.sugars_100g ?? null,
            fat_per_100g: p.nutriments.fat_100g ?? null,
            salt_per_100g: p.nutriments.salt_100g ?? null,
            calories_per_100g: p.nutriments.energy_kcal_100g ?? null,
            image_front_url: p.image_front_url,
          })),
        },
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unable to find alternatives: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
