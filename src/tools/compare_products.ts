/**
 * Tool: compare_products
 * Compare nutritional values of multiple products.
 */

import { getProductByBarcode } from "../services/off-api.js";
import { compareProducts } from "../services/nutrition.js";
import type { ProductData } from "../services/off-api.js";

export const compareProductsTool = {
  name: "compare_products" as const,
  description:
    "Compare the nutritional values of two or more food products side by side. " +
    "Provide 2 to 5 barcodes and an optional comparison criteria. " +
    "Returns a comparison table and a recommendation based on the chosen criteria. " +
    "Use this when the user asks 'Which is healthier?', wants to compare brands, " +
    "or asks to rank products by a specific nutrient (sugar, fat, protein, calories). " +
    "Criteria options: 'overall' (Nutri-Score), 'sugar', 'fat', 'protein', 'calories'.",
  inputSchema: {
    type: "object" as const,
    properties: {
      barcodes: {
        type: "array" as const,
        items: {
          type: "string" as const,
        },
        description: "Array of 2 to 5 barcode numbers to compare.",
        minItems: 2,
        maxItems: 5,
      },
      criteria: {
        type: "string" as const,
        description: "Comparison criteria: 'overall', 'sugar', 'fat', 'protein', or 'calories'. Default: 'overall'.",
        enum: ["overall", "sugar", "fat", "protein", "calories"],
      },
    },
    required: ["barcodes"] as const,
    additionalProperties: false as const,
  },
  handler: async (args: { barcodes: string[]; criteria?: string }) => {
    const barcodes = args.barcodes;

    if (!barcodes || !Array.isArray(barcodes) || barcodes.length < 2 || barcodes.length > 5) {
      return {
        content: [{ type: "text" as const, text: "Please provide between 2 and 5 barcodes to compare." }],
        isError: true,
      };
    }

    // Validate all barcodes
    for (const bc of barcodes) {
      const clean = bc?.trim().replace(/[\s-]/g, "");
      if (!clean || clean.length < 4 || !/^\d+$/.test(clean)) {
        return {
          content: [
            { type: "text" as const, text: `Invalid barcode: "${bc}". All barcodes must be valid numeric strings.` },
          ],
          isError: true,
        };
      }
    }

    const cleanBarcodes = barcodes.map((bc) => bc.trim().replace(/[\s-]/g, ""));
    const criteria = args.criteria || "overall";

    try {
      // Fetch all products in parallel
      const productPromises = cleanBarcodes.map((bc) => getProductByBarcode(bc));
      const results = await Promise.all(productPromises);

      const notFound: string[] = [];
      const products: ProductData[] = [];

      for (let i = 0; i < results.length; i++) {
        if (results[i]) {
          products.push(results[i]!);
        } else {
          notFound.push(cleanBarcodes[i]);
        }
      }

      if (products.length < 2) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Not enough products found to compare. ${notFound.length > 0 ? `Products not found: ${notFound.join(", ")}` : ""}`,
            },
          ],
          isError: true,
        };
      }

      const comparison = compareProducts(products, criteria);

      // Build text table
      const table = comparison.products
        .map((p, i) => {
          return [
            `${i + 1}. ${p.product_name} (${p.barcode})`,
            `   Nutri-Score: ${p.nutriscore_grade.toUpperCase()} | NOVA: ${p.nova_group ?? "?"}`,
            `   Cal: ${p.calories_per_100g ?? "?"}kcal | Sugar: ${p.sugar_per_100g ?? "?"}g | Fat: ${p.fat_per_100g ?? "?"}g | Protein: ${p.protein_per_100g ?? "?"}g | Salt: ${p.salt_per_100g ?? "?"}g`,
          ].join("\n");
        })
        .join("\n\n");

      const notFoundNote =
        notFound.length > 0 ? `\n\nNote: Products not found (excluded from comparison): ${notFound.join(", ")}` : "";

      const summary = `Product Comparison (by ${criteria}):\n\n${table}\n\n🏆 ${comparison.recommendation}${notFoundNote}`;

      return {
        content: [{ type: "text" as const, text: summary }],
        structuredContent: {
          comparison,
          not_found_barcodes: notFound,
        },
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unable to compare products: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
