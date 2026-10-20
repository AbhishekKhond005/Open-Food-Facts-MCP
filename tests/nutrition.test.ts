import { describe, it, expect } from "vitest";
import {
  analyzeDietary,
  checkAllergens,
  summarizeNutrition,
  analyzeIngredients,
  compareProducts,
} from "../src/services/nutrition.js";
import type { ProductData } from "../src/services/off-api.js";

function makeProduct(overrides: Partial<ProductData> = {}): ProductData {
  return {
    barcode: "0000000000000",
    product_name: "Test Product",
    brands: "Test Brand",
    categories: "Snacks",
    labels: "",
    quantity: "100g",
    ingredients_text: "",
    allergens: "",
    traces: "",
    nutriments: {},
    nutrition_grades: "",
    nova_group: null,
    ecoscore_grade: "",
    image_url: "",
    image_front_url: "",
    countries: "",
    stores: "",
    ...overrides,
  };
}

describe("analyzeDietary", () => {
  it("returns low confidence when no ingredients", () => {
    const result = analyzeDietary(makeProduct());
    expect(result.confidence).toBe("low");
    expect(result.is_vegetarian).toBeNull();
    expect(result.is_vegan).toBeNull();
  });

  it("detects meat ingredients as non-vegetarian", () => {
    const result = analyzeDietary(
      makeProduct({ ingredients_text: "wheat flour, chicken stock, salt" })
    );
    expect(result.is_vegetarian).toBe(false);
    expect(result.is_vegan).toBe(false);
  });

  it("detects dairy as non-vegan", () => {
    const result = analyzeDietary(
      makeProduct({ ingredients_text: "sugar, cocoa, milk powder, vanilla" })
    );
    expect(result.is_vegetarian).toBe(true);
    expect(result.is_vegan).toBe(false);
  });

  it("detects gluten-containing ingredients", () => {
    const result = analyzeDietary(
      makeProduct({ ingredients_text: "wheat flour, sugar, butter, eggs" })
    );
    expect(result.is_gluten_free).toBe(false);
  });

  it("respects label overrides", () => {
    const result = analyzeDietary(
      makeProduct({ ingredients_text: "soy protein", labels: "vegan, gluten-free" })
    );
    expect(result.is_vegan).toBe(true);
    expect(result.is_gluten_free).toBe(true);
  });

  it("always includes a verification note", () => {
    const result = analyzeDietary(
      makeProduct({ ingredients_text: "rice, water" })
    );
    expect(result.notes.some((n) => n.includes("verify"))).toBe(true);
  });
});

describe("checkAllergens", () => {
  it("detects allergens from allergens field", () => {
    const result = checkAllergens(
      makeProduct({ allergens: "en:milk, en:nuts" })
    );
    expect(result.detected_allergens).toContain("milk");
    expect(result.detected_allergens).toContain("nuts");
  });

  it("detects allergens from ingredients text", () => {
    const result = checkAllergens(
      makeProduct({ ingredients_text: "wheat flour, peanut butter, sugar" })
    );
    expect(result.detected_allergens).toContain("peanut");
    expect(result.detected_allergens).toContain("wheat");
  });

  it("reports traces separately", () => {
    const result = checkAllergens(
      makeProduct({ traces: "en:sesame, en:soy" })
    );
    expect(result.potential_traces).toContain("sesame");
    expect(result.potential_traces).toContain("soy");
  });

  it("always includes disclaimer", () => {
    const result = checkAllergens(makeProduct());
    expect(result.disclaimer).toContain("ALWAYS verify");
  });
});

describe("summarizeNutrition", () => {
  it("returns nutriscore and nova group", () => {
    const result = summarizeNutrition(
      makeProduct({ nutrition_grades: "b", nova_group: 2 })
    );
    expect(result.nutriscore_grade).toBe("b");
    expect(result.nova_group).toBe(2);
  });

  it("classifies high sugar correctly", () => {
    const result = summarizeNutrition(
      makeProduct({ nutriments: { sugars_100g: 25 } })
    );
    const sugar = result.key_nutrients.find((n) => n.name === "Sugars");
    expect(sugar?.level).toBe("high");
  });

  it("classifies low salt correctly", () => {
    const result = summarizeNutrition(
      makeProduct({ nutriments: { salt_100g: 0.1 } })
    );
    const salt = result.key_nutrients.find((n) => n.name === "Salt");
    expect(salt?.level).toBe("low");
  });

  it("highlights poor nutriscore", () => {
    const result = summarizeNutrition(
      makeProduct({ nutrition_grades: "e" })
    );
    expect(result.health_highlights.some((h) => h.includes("Poor Nutri-Score"))).toBe(true);
  });

  it("highlights ultra-processed NOVA 4", () => {
    const result = summarizeNutrition(
      makeProduct({ nova_group: 4 })
    );
    expect(result.health_highlights.some((h) => h.includes("Ultra-processed"))).toBe(true);
  });
});

describe("analyzeIngredients", () => {
  it("detects E-numbers", () => {
    const result = analyzeIngredients(
      makeProduct({ ingredients_text: "sugar, E621, E330, citric acid" })
    );
    expect(result.identified_additives).toContain("E621");
    expect(result.identified_additives).toContain("E330");
  });

  it("detects additive names", () => {
    const result = analyzeIngredients(
      makeProduct({ ingredients_text: "flour, maltodextrin, emulsifier, lecithin" })
    );
    expect(result.identified_additives).toContain("maltodextrin");
    expect(result.identified_additives).toContain("emulsifier");
    expect(result.identified_additives).toContain("lecithin");
  });

  it("handles empty ingredients", () => {
    const result = analyzeIngredients(makeProduct());
    expect(result.explanation.some((e) => e.includes("No ingredient information"))).toBe(true);
  });
});

describe("compareProducts", () => {
  const productA = makeProduct({
    barcode: "111",
    product_name: "Product A",
    nutrition_grades: "a",
    nutriments: { sugars_100g: 5, fat_100g: 2, energy_kcal_100g: 100, proteins_100g: 10 },
  });
  const productB = makeProduct({
    barcode: "222",
    product_name: "Product B",
    nutrition_grades: "c",
    nutriments: { sugars_100g: 20, fat_100g: 15, energy_kcal_100g: 300, proteins_100g: 5 },
  });

  it("compares by overall nutriscore", () => {
    const result = compareProducts([productA, productB], "overall");
    expect(result.recommendation).toContain("Product A");
    expect(result.criteria_used).toBe("overall");
  });

  it("compares by sugar content", () => {
    const result = compareProducts([productA, productB], "sugar");
    expect(result.recommendation).toContain("Product A");
    expect(result.recommendation).toContain("5");
  });

  it("compares by protein content (higher is better)", () => {
    const result = compareProducts([productA, productB], "protein");
    expect(result.recommendation).toContain("Product A");
    expect(result.recommendation).toContain("10");
  });

  it("compares by calories", () => {
    const result = compareProducts([productA, productB], "calories");
    expect(result.recommendation).toContain("Product A");
  });

  it("includes all products in the result", () => {
    const result = compareProducts([productA, productB]);
    expect(result.products).toHaveLength(2);
  });
});
