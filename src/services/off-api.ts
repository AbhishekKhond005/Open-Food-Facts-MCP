/**
 * Open Food Facts API client.
 * All external API calls go through this module with proper timeouts,
 * error handling, and response validation.
 */

import { logger } from "../logging.js";

export interface OffApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

/** Nutriment values from Open Food Facts */
export interface Nutriments {
  energy_kcal_100g?: number;
  energy_kj_100g?: number;
  fat_100g?: number;
  saturated_fat_100g?: number;
  carbohydrates_100g?: number;
  sugars_100g?: number;
  fiber_100g?: number;
  proteins_100g?: number;
  salt_100g?: number;
  sodium_100g?: number;
  [key: string]: number | string | undefined;
}

/** Structured product data extracted from Open Food Facts */
export interface ProductData {
  barcode: string;
  product_name: string;
  brands: string;
  categories: string;
  labels: string;
  quantity: string;
  ingredients_text: string;
  allergens: string;
  traces: string;
  nutriments: Nutriments;
  nutrition_grades: string;
  nova_group: number | null;
  ecoscore_grade: string;
  image_url: string;
  image_front_url: string;
  countries: string;
  stores: string;
}

/** Search result from Open Food Facts */
export interface SearchResult {
  count: number;
  page: number;
  page_size: number;
  page_count: number;
  products: ProductData[];
}

// Fields we request from the API to keep payloads small
const PRODUCT_FIELDS = [
  "code",
  "product_name",
  "brands",
  "categories",
  "labels",
  "quantity",
  "ingredients_text",
  "allergens",
  "allergens_tags",
  "traces",
  "traces_tags",
  "nutriments",
  "nutrition_grades",
  "nova_group",
  "ecoscore_grade",
  "image_url",
  "image_front_url",
  "countries",
  "stores",
].join(",");

let apiConfig: OffApiConfig = {
  baseUrl: "https://world.openfoodfacts.org",
  timeoutMs: 10000,
};

export function initOffApi(config: OffApiConfig): void {
  apiConfig = config;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), apiConfig.timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "OpenFoodFactsMCP/1.0 (hackathon-project; contact@example.com)",
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeProduct(raw: Record<string, unknown>): ProductData {
  return {
    barcode: String(raw.code || ""),
    product_name: String(raw.product_name || "Unknown"),
    brands: String(raw.brands || ""),
    categories: String(raw.categories || ""),
    labels: String(raw.labels || ""),
    quantity: String(raw.quantity || ""),
    ingredients_text: String(raw.ingredients_text || ""),
    allergens: String(raw.allergens || ""),
    traces: String(raw.traces || ""),
    nutriments: (raw.nutriments as Nutriments) || {},
    nutrition_grades: String(raw.nutrition_grades || ""),
    nova_group: raw.nova_group ? Number(raw.nova_group) : null,
    ecoscore_grade: String(raw.ecoscore_grade || ""),
    image_url: String(raw.image_url || ""),
    image_front_url: String(raw.image_front_url || ""),
    countries: String(raw.countries || ""),
    stores: String(raw.stores || ""),
  };
}

/**
 * Get a product by its barcode.
 */
export async function getProductByBarcode(barcode: string): Promise<ProductData | null> {
  const url = `${apiConfig.baseUrl}/api/v2/product/${encodeURIComponent(barcode)}?fields=${PRODUCT_FIELDS}`;
  const start = Date.now();

  logger.info("OFF API: fetching product by barcode", { barcode, url });

  try {
    const response = await fetchWithTimeout(url);
    const duration = Date.now() - start;

    if (!response.ok) {
      logger.warn("OFF API: non-OK response", { barcode, status: response.status, duration });
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (data.status === 0 || !data.product) {
      logger.info("OFF API: product not found", { barcode, duration });
      return null;
    }

    const product = normalizeProduct(data.product as Record<string, unknown>);
    logger.info("OFF API: product fetched successfully", { barcode, productName: product.product_name, duration });
    return product;
  } catch (error) {
    const duration = Date.now() - start;
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("OFF API: request timed out", { barcode, timeoutMs: apiConfig.timeoutMs, duration });
      throw new Error("Open Food Facts API request timed out");
    }
    logger.error("OFF API: request failed", { barcode, error: (error as Error).message, duration });
    throw new Error("Failed to reach Open Food Facts API");
  }
}

/**
 * Search products by text query.
 */
export async function searchProducts(
  query: string,
  page: number = 1,
  pageSize: number = 10
): Promise<SearchResult> {
  const url = `${apiConfig.baseUrl}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page=${page}&page_size=${pageSize}&fields=${PRODUCT_FIELDS}`;
  const start = Date.now();

  logger.info("OFF API: searching products", { query, page, pageSize });

  try {
    const response = await fetchWithTimeout(url);
    const duration = Date.now() - start;

    if (!response.ok) {
      logger.warn("OFF API: search non-OK response", { query, status: response.status, duration });
      throw new Error("Open Food Facts search request failed");
    }

    const data = (await response.json()) as Record<string, unknown>;
    const products = ((data.products as Record<string, unknown>[]) || []).map(normalizeProduct);

    logger.info("OFF API: search completed", { query, resultCount: products.length, duration });

    return {
      count: Number(data.count || 0),
      page: Number(data.page || page),
      page_size: Number(data.page_size || pageSize),
      page_count: Number(data.page_count || 0),
      products,
    };
  } catch (error) {
    const duration = Date.now() - start;
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("OFF API: search timed out", { query, timeoutMs: apiConfig.timeoutMs, duration });
      throw new Error("Open Food Facts API search request timed out");
    }
    if (error instanceof Error && error.message.includes("Open Food Facts")) {
      throw error;
    }
    logger.error("OFF API: search failed", { query, error: (error as Error).message, duration });
    throw new Error("Failed to reach Open Food Facts API");
  }
}

/**
 * Search products by category tag.
 */
export async function searchByCategory(
  category: string,
  page: number = 1,
  pageSize: number = 10
): Promise<SearchResult> {
  const url = `${apiConfig.baseUrl}/api/v2/search?categories_tags_en=${encodeURIComponent(category)}&page=${page}&page_size=${pageSize}&fields=${PRODUCT_FIELDS}`;
  const start = Date.now();

  logger.info("OFF API: searching by category", { category, page, pageSize });

  try {
    const response = await fetchWithTimeout(url);
    const duration = Date.now() - start;

    if (!response.ok) {
      logger.warn("OFF API: category search non-OK response", { category, status: response.status, duration });
      throw new Error("Open Food Facts category search request failed");
    }

    const data = (await response.json()) as Record<string, unknown>;
    const products = ((data.products as Record<string, unknown>[]) || []).map(normalizeProduct);

    logger.info("OFF API: category search completed", { category, resultCount: products.length, duration });

    return {
      count: Number(data.count || 0),
      page: Number(data.page || page),
      page_size: Number(data.page_size || pageSize),
      page_count: Number(data.page_count || 0),
      products,
    };
  } catch (error) {
    const duration = Date.now() - start;
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("OFF API: category search timed out", { category, timeoutMs: apiConfig.timeoutMs, duration });
      throw new Error("Open Food Facts API category search request timed out");
    }
    if (error instanceof Error && error.message.includes("Open Food Facts")) {
      throw error;
    }
    logger.error("OFF API: category search failed", { category, error: (error as Error).message, duration });
    throw new Error("Failed to reach Open Food Facts API");
  }
}
