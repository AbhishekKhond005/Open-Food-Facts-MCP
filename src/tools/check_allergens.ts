/**
 * Tool: check_allergens
 * Identify allergens and potential traces in a product.
 */

import { getProductByBarcode } from "../services/off-api.js";
import { checkAllergens } from "../services/nutrition.js";

export const checkAllergensTool = {
  name: "check_allergens" as const,
  description:
    "Check a food product for allergens and potential allergen traces. " +
    "Returns a list of detected allergens, potential traces (may contain), and a confidence level. " +
    "Use this when the user asks about allergens, such as 'Does this contain peanuts?' or " +
    "'Is this safe for someone with a milk allergy?'. " +
    "IMPORTANT: This tool flags uncertainty and always directs users to verify the actual packaging. " +
    "The analysis is based on Open Food Facts data and ingredient text parsing.",
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

      const report = checkAllergens(product);

      const allergenList = report.detected_allergens.length > 0
        ? `Detected Allergens: ${report.detected_allergens.join(", ")}`
        : "No allergens explicitly listed.";

      const tracesList = report.potential_traces.length > 0
        ? `Potential Traces (May Contain): ${report.potential_traces.join(", ")}`
        : "No traces listed.";

      const summary = [
        `Allergen Report for: ${product.product_name}`,
        product.brands ? `Brand: ${product.brands}` : null,
        "",
        allergenList,
        tracesList,
        `Confidence: ${report.confidence}`,
        "",
        `⚠️ ${report.disclaimer}`,
      ]
        .filter((l) => l !== null)
        .join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
        structuredContent: {
          barcode: product.barcode,
          product_name: product.product_name,
          brands: product.brands,
          allergen_report: report,
        },
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unable to check allergens: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
