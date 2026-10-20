/**
 * Nutrition analysis service.
 * Provides higher-level analysis functions on top of raw product data.
 * No MCP types here — pure business logic.
 */

import type { ProductData, Nutriments } from "./off-api.js";

/** Dietary classification result */
export interface DietaryAnalysis {
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_gluten_free: boolean | null;
  is_dairy_free: boolean | null;
  confidence: "high" | "medium" | "low";
  notes: string[];
}

/** Allergen check result */
export interface AllergenReport {
  detected_allergens: string[];
  potential_traces: string[];
  confidence: "high" | "medium" | "low";
  disclaimer: string;
}

/** Nutrition summary */
export interface NutritionSummary {
  nutriscore_grade: string;
  nova_group: number | null;
  ecoscore_grade: string;
  calories_per_100g: number | null;
  key_nutrients: {
    name: string;
    value_per_100g: number | null;
    unit: string;
    level: "low" | "moderate" | "high" | "unknown";
  }[];
  health_highlights: string[];
}

/** Ingredient analysis result */
export interface IngredientAnalysis {
  ingredients_text: string;
  identified_additives: string[];
  identified_allergens: string[];
  explanation: string[];
}

/** Product comparison */
export interface ComparisonResult {
  products: {
    barcode: string;
    product_name: string;
    nutriscore_grade: string;
    nova_group: number | null;
    calories_per_100g: number | null;
    sugar_per_100g: number | null;
    fat_per_100g: number | null;
    protein_per_100g: number | null;
    salt_per_100g: number | null;
  }[];
  recommendation: string;
  criteria_used: string;
}

// --- Known allergen keywords ---
const COMMON_ALLERGENS = [
  "peanut", "peanuts", "arachis",
  "milk", "lactose", "dairy", "casein", "whey",
  "egg", "eggs", "ovalbumin",
  "soy", "soya", "soybean",
  "wheat", "gluten",
  "tree nuts", "almond", "almonds", "hazelnut", "hazelnuts", "cashew", "walnut", "walnuts", "pistachio",
  "fish", "cod", "salmon", "tuna",
  "shellfish", "shrimp", "crab", "lobster", "prawn",
  "sesame",
  "celery",
  "mustard",
  "lupin", "lupine",
  "molluscs", "squid", "octopus",
  "sulphites", "sulfites", "sulphur dioxide",
];

// --- Meat / animal keywords for dietary detection ---
const MEAT_KEYWORDS = [
  "meat", "beef", "pork", "chicken", "lamb", "turkey", "duck", "bacon",
  "ham", "sausage", "salami", "pepperoni", "gelatin", "gelatine", "lard",
  "tallow", "suet", "anchovy", "anchovies", "fish", "shrimp", "crab",
  "lobster", "prawn", "squid", "octopus",
];

const DAIRY_KEYWORDS = [
  "milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "whey",
  "casein", "lactose", "ghee", "curd",
];

const EGG_KEYWORDS = ["egg", "eggs", "ovalbumin", "albumin", "lysozyme"];

const GLUTEN_KEYWORDS = [
  "wheat", "barley", "rye", "oats", "spelt", "kamut", "triticale", "gluten",
];

// Known additive prefixes (E-numbers)
const ADDITIVE_PATTERN = /\bE\s?\d{3,4}[a-z]?\b/gi;
const INS_PATTERN = /\bINS\s?\d{3,4}[a-z]?\b/gi;

/**
 * Nutrient level thresholds per 100g (UK FSA traffic-light model approximation)
 */
function getNutrientLevel(
  nutrientName: string,
  valuePer100g: number | null
): "low" | "moderate" | "high" | "unknown" {
  if (valuePer100g === null || valuePer100g === undefined) return "unknown";

  const thresholds: Record<string, { low: number; high: number }> = {
    fat: { low: 3, high: 17.5 },
    saturated_fat: { low: 1.5, high: 5 },
    sugars: { low: 5, high: 22.5 },
    salt: { low: 0.3, high: 1.5 },
    sodium: { low: 0.1, high: 0.6 },
  };

  const th = thresholds[nutrientName];
  if (!th) return "unknown";
  if (valuePer100g <= th.low) return "low";
  if (valuePer100g >= th.high) return "high";
  return "moderate";
}

function containsKeyword(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Analyze dietary suitability of a product.
 */
export function analyzeDietary(product: ProductData): DietaryAnalysis {
  const ingredients = product.ingredients_text.toLowerCase();
  const labels = product.labels.toLowerCase();
  const notes: string[] = [];

  if (!ingredients && !labels) {
    return {
      is_vegetarian: null,
      is_vegan: null,
      is_gluten_free: null,
      is_dairy_free: null,
      confidence: "low",
      notes: [
        "No ingredient information available. Cannot determine dietary suitability. Please verify the actual packaging.",
      ],
    };
  }

  // Vegetarian check
  const meatFound = containsKeyword(ingredients, MEAT_KEYWORDS);
  const isVegetarianLabel = labels.includes("vegetarian");
  let is_vegetarian: boolean | null = meatFound.length === 0;
  if (isVegetarianLabel) is_vegetarian = true;
  if (meatFound.length > 0) {
    notes.push(`Contains non-vegetarian ingredients: ${meatFound.join(", ")}`);
    is_vegetarian = false;
  }

  // Vegan check
  const dairyFound = containsKeyword(ingredients, DAIRY_KEYWORDS);
  const eggFound = containsKeyword(ingredients, EGG_KEYWORDS);
  const isVeganLabel = labels.includes("vegan");
  let is_vegan: boolean | null = meatFound.length === 0 && dairyFound.length === 0 && eggFound.length === 0;
  if (isVeganLabel) is_vegan = true;
  if (dairyFound.length > 0 || eggFound.length > 0) {
    const nonVegan = [...dairyFound, ...eggFound];
    notes.push(`Contains non-vegan ingredients: ${nonVegan.join(", ")}`);
    is_vegan = false;
  }

  // Gluten-free check
  const glutenFound = containsKeyword(ingredients, GLUTEN_KEYWORDS);
  const isGlutenFreeLabel = labels.includes("gluten-free") || labels.includes("gluten free");
  let is_gluten_free: boolean | null = glutenFound.length === 0;
  if (isGlutenFreeLabel) is_gluten_free = true;
  if (glutenFound.length > 0) {
    notes.push(`May contain gluten: ${glutenFound.join(", ")}`);
    is_gluten_free = false;
  }

  // Dairy-free check
  const is_dairy_free: boolean | null = dairyFound.length === 0;
  if (dairyFound.length > 0) {
    notes.push(`Contains dairy: ${dairyFound.join(", ")}`);
  }

  const confidence = ingredients.length > 20 ? "medium" : "low";

  notes.push(
    "This analysis is based on ingredient text parsing and may not be fully accurate. Always verify the actual product packaging for definitive dietary information."
  );

  return { is_vegetarian, is_vegan, is_gluten_free, is_dairy_free, confidence, notes };
}

/**
 * Check a product for allergens.
 */
export function checkAllergens(product: ProductData): AllergenReport {
  const ingredients = product.ingredients_text.toLowerCase();
  const allergenField = product.allergens.toLowerCase();
  const tracesField = product.traces.toLowerCase();

  const detected_allergens: string[] = [];
  const potential_traces: string[] = [];

  // Check the allergens field directly
  if (allergenField) {
    const parts = allergenField.split(",").map((a) => a.trim().replace(/^en:/, ""));
    detected_allergens.push(...parts.filter(Boolean));
  }

  // Check traces field
  if (tracesField) {
    const parts = tracesField.split(",").map((a) => a.trim().replace(/^en:/, ""));
    potential_traces.push(...parts.filter(Boolean));
  }

  // Also scan ingredients text
  const foundInIngredients = containsKeyword(ingredients, COMMON_ALLERGENS);
  for (const allergen of foundInIngredients) {
    if (!detected_allergens.some((a) => a.includes(allergen))) {
      detected_allergens.push(allergen);
    }
  }

  const confidence = ingredients.length > 20 || allergenField ? "medium" : "low";

  return {
    detected_allergens: [...new Set(detected_allergens)],
    potential_traces: [...new Set(potential_traces)],
    confidence,
    disclaimer:
      "This allergen report is based on data from Open Food Facts and ingredient text parsing. It may not capture all allergens. ALWAYS verify the actual product packaging, especially for severe allergies. Manufacturers may change formulations without notice.",
  };
}

/**
 * Generate a nutrition summary for a product.
 */
export function summarizeNutrition(product: ProductData): NutritionSummary {
  const n = product.nutriments;
  const health_highlights: string[] = [];

  const calories = n.energy_kcal_100g ?? null;

  const key_nutrients = [
    {
      name: "Fat",
      value_per_100g: n.fat_100g ?? null,
      unit: "g",
      level: getNutrientLevel("fat", n.fat_100g ?? null),
    },
    {
      name: "Saturated Fat",
      value_per_100g: n.saturated_fat_100g ?? null,
      unit: "g",
      level: getNutrientLevel("saturated_fat", n.saturated_fat_100g ?? null),
    },
    {
      name: "Sugars",
      value_per_100g: n.sugars_100g ?? null,
      unit: "g",
      level: getNutrientLevel("sugars", n.sugars_100g ?? null),
    },
    {
      name: "Salt",
      value_per_100g: n.salt_100g ?? null,
      unit: "g",
      level: getNutrientLevel("salt", n.salt_100g ?? null),
    },
    {
      name: "Protein",
      value_per_100g: n.proteins_100g ?? null,
      unit: "g",
      level: "unknown" as const,
    },
    {
      name: "Fiber",
      value_per_100g: n.fiber_100g ?? null,
      unit: "g",
      level: "unknown" as const,
    },
    {
      name: "Carbohydrates",
      value_per_100g: n.carbohydrates_100g ?? null,
      unit: "g",
      level: "unknown" as const,
    },
  ];

  // Health highlights
  if (product.nutrition_grades) {
    const grade = product.nutrition_grades.toUpperCase();
    if (grade === "A" || grade === "B") {
      health_highlights.push(`Good Nutri-Score: ${grade}`);
    } else if (grade === "D" || grade === "E") {
      health_highlights.push(`Poor Nutri-Score: ${grade} — consider healthier alternatives`);
    }
  }

  if (product.nova_group) {
    if (product.nova_group === 4) {
      health_highlights.push("NOVA Group 4: Ultra-processed food");
    } else if (product.nova_group === 1) {
      health_highlights.push("NOVA Group 1: Unprocessed or minimally processed food");
    }
  }

  for (const nutrient of key_nutrients) {
    if (nutrient.level === "high") {
      health_highlights.push(`High ${nutrient.name}: ${nutrient.value_per_100g}${nutrient.unit} per 100g`);
    }
  }

  return {
    nutriscore_grade: product.nutrition_grades || "unknown",
    nova_group: product.nova_group,
    ecoscore_grade: product.ecoscore_grade || "unknown",
    calories_per_100g: calories,
    key_nutrients,
    health_highlights,
  };
}

/**
 * Analyze ingredients of a product.
 */
export function analyzeIngredients(product: ProductData): IngredientAnalysis {
  const ingredients = product.ingredients_text;
  const explanation: string[] = [];

  // Find additives (E-numbers and INS numbers)
  const additives: string[] = [];
  let match;

  const eMatches = ingredients.match(ADDITIVE_PATTERN);
  if (eMatches) additives.push(...eMatches);

  const insMatches = ingredients.match(INS_PATTERN);
  if (insMatches) additives.push(...insMatches);

  // Check for common additives by name
  const additiveNames = [
    "maltodextrin", "emulsifier", "stabilizer", "stabiliser", "preservative",
    "antioxidant", "colour", "color", "flavour", "flavor", "sweetener",
    "thickener", "acidity regulator", "raising agent", "modified starch",
    "mono- and diglycerides", "lecithin", "xanthan gum", "carrageenan",
    "aspartame", "sucralose", "acesulfame",
  ];
  const foundAdditiveNames = containsKeyword(ingredients, additiveNames);
  additives.push(...foundAdditiveNames);

  // Allergens in ingredients
  const foundAllergens = containsKeyword(ingredients, COMMON_ALLERGENS);

  // Build explanation
  if (!ingredients) {
    explanation.push("No ingredient information available for this product.");
  } else {
    explanation.push(`This product lists the following ingredients: ${ingredients}`);
    if (additives.length > 0) {
      explanation.push(`Identified additives and processing aids: ${[...new Set(additives)].join(", ")}`);
    } else {
      explanation.push("No common additives or E-numbers were detected in the ingredient list.");
    }
    if (foundAllergens.length > 0) {
      explanation.push(`Potential allergens detected in ingredients: ${[...new Set(foundAllergens)].join(", ")}`);
    }
  }

  return {
    ingredients_text: ingredients,
    identified_additives: [...new Set(additives)],
    identified_allergens: [...new Set(foundAllergens)],
    explanation,
  };
}

/**
 * Compare multiple products.
 */
export function compareProducts(
  products: ProductData[],
  criteria: string = "overall"
): ComparisonResult {
  const mapped = products.map((p) => ({
    barcode: p.barcode,
    product_name: p.product_name,
    nutriscore_grade: p.nutrition_grades || "unknown",
    nova_group: p.nova_group,
    calories_per_100g: p.nutriments.energy_kcal_100g ?? null,
    sugar_per_100g: p.nutriments.sugars_100g ?? null,
    fat_per_100g: p.nutriments.fat_100g ?? null,
    protein_per_100g: p.nutriments.proteins_100g ?? null,
    salt_per_100g: p.nutriments.salt_100g ?? null,
  }));

  let recommendation = "";
  const gradeOrder: Record<string, number> = { a: 1, b: 2, c: 3, d: 4, e: 5, unknown: 6 };

  if (criteria === "sugar" || criteria === "sugars") {
    const sorted = [...mapped].sort((a, b) => (a.sugar_per_100g ?? 999) - (b.sugar_per_100g ?? 999));
    const best = sorted[0];
    recommendation = best
      ? `${best.product_name} has the lowest sugar content at ${best.sugar_per_100g ?? "unknown"}g per 100g.`
      : "Unable to compare sugar content.";
  } else if (criteria === "fat") {
    const sorted = [...mapped].sort((a, b) => (a.fat_per_100g ?? 999) - (b.fat_per_100g ?? 999));
    const best = sorted[0];
    recommendation = best
      ? `${best.product_name} has the lowest fat content at ${best.fat_per_100g ?? "unknown"}g per 100g.`
      : "Unable to compare fat content.";
  } else if (criteria === "protein") {
    const sorted = [...mapped].sort((a, b) => (b.protein_per_100g ?? 0) - (a.protein_per_100g ?? 0));
    const best = sorted[0];
    recommendation = best
      ? `${best.product_name} has the highest protein content at ${best.protein_per_100g ?? "unknown"}g per 100g.`
      : "Unable to compare protein content.";
  } else if (criteria === "calories") {
    const sorted = [...mapped].sort((a, b) => (a.calories_per_100g ?? 999) - (b.calories_per_100g ?? 999));
    const best = sorted[0];
    recommendation = best
      ? `${best.product_name} has the lowest calories at ${best.calories_per_100g ?? "unknown"} kcal per 100g.`
      : "Unable to compare calories.";
  } else {
    // Overall: use nutriscore
    const sorted = [...mapped].sort(
      (a, b) => (gradeOrder[a.nutriscore_grade.toLowerCase()] ?? 6) - (gradeOrder[b.nutriscore_grade.toLowerCase()] ?? 6)
    );
    const best = sorted[0];
    recommendation = best
      ? `${best.product_name} has the best overall Nutri-Score: ${best.nutriscore_grade.toUpperCase()}.`
      : "Unable to determine the best product.";
  }

  return {
    products: mapped,
    recommendation,
    criteria_used: criteria,
  };
}
