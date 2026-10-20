/**
 * Tool: search_products
 * Search the Open Food Facts database by text query.
 */

import { searchProducts } from "../services/off-api.js";

export const searchProductsTool = {
  name: "search_products" as const,
  description:
    "Search the Open Food Facts database for food products by name, brand, or description. " +
    "Returns a list of matching products with their barcodes, names, brands, and Nutri-Scores. " +
    "Use this to find products when the user does not have a specific barcode. " +
    "Results are paginated; use the page parameter for additional results.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string" as const,
        description: "Search terms (e.g., 'organic peanut butter', 'Nutella', 'low sugar cereal').",
        minLength: 1,
        maxLength: 200,
      },
      page: {
        type: "number" as const,
        description: "Page number for pagination (default: 1).",
        minimum: 1,
        maximum: 100,
      },
      page_size: {
        type: "number" as const,
        description: "Number of results per page (default: 10, max: 50).",
        minimum: 1,
        maximum: 50,
      },
    },
    required: ["query"] as const,
    additionalProperties: false as const,
  },
  handler: async (args: { query: string; page?: number; page_size?: number }) => {
    const query = args.query?.trim();

    if (!query || query.length < 1 || query.length > 200) {
      return {
        content: [{ type: "text" as const, text: "Invalid search query. Please provide a query between 1 and 200 characters." }],
        isError: true,
      };
    }

    const page = Math.min(Math.max(args.page || 1, 1), 100);
    const pageSize = Math.min(Math.max(args.page_size || 10, 1), 50);

    try {
      const result = await searchProducts(query, page, pageSize);

      if (result.products.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No products found for "${query}". Try different search terms or check the spelling.`,
            },
          ],
          structuredContent: {
            query,
            total_count: 0,
            page,
            page_size: pageSize,
            products: [],
          },
          isError: false,
        };
      }

      const productList = result.products
        .map((p, i) => {
          const parts = [
            `${i + 1}. ${p.product_name}`,
            p.brands ? `   Brand: ${p.brands}` : null,
            `   Barcode: ${p.barcode}`,
            p.nutrition_grades ? `   Nutri-Score: ${p.nutrition_grades.toUpperCase()}` : null,
          ];
          return parts.filter(Boolean).join("\n");
        })
        .join("\n\n");

      const summary = `Found ${result.count} products for "${query}" (showing page ${page}):\n\n${productList}`;

      return {
        content: [{ type: "text" as const, text: summary }],
        structuredContent: {
          query,
          total_count: result.count,
          page: result.page,
          page_size: result.page_size,
          page_count: result.page_count,
          products: result.products.map((p) => ({
            barcode: p.barcode,
            product_name: p.product_name,
            brands: p.brands,
            quantity: p.quantity,
            nutriscore_grade: p.nutrition_grades || "unknown",
            nova_group: p.nova_group,
            categories: p.categories,
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
            text: `Unable to search products: ${(error as Error).message}. Please try again later.`,
          },
        ],
        isError: true,
      };
    }
  },
};
