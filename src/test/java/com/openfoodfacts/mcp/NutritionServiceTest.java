package com.openfoodfacts.mcp;
import org.junit.jupiter.api.Test;import java.util.*;import static org.junit.jupiter.api.Assertions.*;
class NutritionServiceTest {
 private final NutritionService service=new NutritionService();
 private Product product(String ingredients,String labels,Map<String,Object> nutrients){return new Product("12345","Sample","Brand","",labels,"",ingredients,"en:milk","en:peanuts",nutrients,"b",2,"a","","","","");}
 @Test void dietaryReturnsUnknownWhenIngredientsAndLabelsAreMissing(){var a=service.dietary(product("","",Map.of()));assertNull(a.get("is_vegan"));assertEquals("low",a.get("confidence"));}
 @Test void dietaryDetectsAnimalAndGlutenIngredients(){var a=service.dietary(product("wheat, milk","",Map.of()));assertEquals(false,a.get("is_vegan"));assertEquals(false,a.get("is_gluten_free"));assertEquals(false,a.get("is_dairy_free"));}
 @Test void allergensCombinesDeclaredAllergensAndIngredientMatches(){var a=service.allergens(product("peanut flour","",Map.of()));assertTrue(((List<?>)a.get("detected_allergens")).contains("milk"));assertTrue(((List<?>)a.get("detected_allergens")).contains("peanut"));assertEquals(List.of("peanuts"),a.get("potential_traces"));}
 @Test void nutritionCalculatesTrafficLightLevels(){var p=product("","",Map.of("fat_100g",20,"sugars_100g",3,"energy_kcal_100g",100));var a=service.nutrition(p);var ns=(List<Map<String,Object>>)a.get("key_nutrients");assertEquals("high",ns.get(0).get("level"));assertEquals("low",ns.get(2).get("level"));assertEquals(100.0,a.get("calories_per_100g"));}
 @Test void comparisonRanksMissingValuesAfterKnownScores(){
  var missing=new Product("1","Unknown","","","","","","","",Map.of(),"",null,"","","","","");
  var known=new Product("2","Known","","","","","","","",Map.of("proteins_100g",3),"b",null,"","","","","");
  assertEquals("Known has the best overall Nutri-Score: B.",service.comparison(List.of(missing,known),"overall").get("recommendation"));
  assertEquals("Known has the highest protein content at 3g per 100g.",service.comparison(List.of(missing,known),"protein").get("recommendation"));
 }
}
