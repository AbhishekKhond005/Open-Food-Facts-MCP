package com.openfoodfacts.mcp;

import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.util.*;

@Configuration
public class ToolSpecifications {
    private static Map<String,Object> field(String type,String description,Object... extras){var m=new LinkedHashMap<String,Object>();m.put("type",type);m.put("description",description);for(int i=0;i<extras.length;i+=2)m.put((String)extras[i],extras[i+1]);return m;}
    private static Map<String,Object> schema(Map<String,Object> properties,String... required){var m=new LinkedHashMap<String,Object>();m.put("type","object");m.put("properties",properties);m.put("required",List.of(required));m.put("additionalProperties",false);return m;}
    private static Map<String,Object> barcode(){return field("string","The barcode number of the product.","minLength",4,"maxLength",30);}
    @Bean public List<McpServerFeatures.SyncToolSpecification> foodToolSpecs(FoodTools h){
      var defs=new LinkedHashMap<String,Map<String,Object>>();
      defs.put("get_product_by_barcode",schema(Map.of("barcode",field("string","The barcode number of the product (e.g., '3017624010701' for Nutella).","minLength",4,"maxLength",30)),"barcode"));
      defs.put("search_products",schema(Map.of("query",field("string","Search terms (e.g., 'organic peanut butter', 'Nutella', 'low sugar cereal').","minLength",1,"maxLength",200),"page",field("number","Page number for pagination (default: 1).","minimum",1,"maximum",100),"page_size",field("number","Number of results per page (default: 10, max: 50).","minimum",1,"maximum",50)),"query"));
      defs.put("get_nutrition_info",schema(Map.of("barcode",barcode()),"barcode"));
      defs.put("check_dietary_preferences",schema(Map.of("barcode",barcode()),"barcode"));
      defs.put("check_allergens",schema(Map.of("barcode",barcode()),"barcode"));
      defs.put("analyze_ingredients",schema(Map.of("barcode",barcode()),"barcode"));
      defs.put("compare_products",schema(Map.of("barcodes",field("array","Array of 2 to 5 barcode numbers to compare.","items",Map.of("type","string"),"minItems",2,"maxItems",5),"criteria",field("string","Comparison criteria: 'overall', 'sugar', 'fat', 'protein', or 'calories'. Default: 'overall'.","enum",List.of("overall","sugar","fat","protein","calories"))),"barcodes"));
      defs.put("find_alternatives",schema(Map.of("barcode",field("string","The barcode of the product to find alternatives for.","minLength",4,"maxLength",30),"criteria",field("string","What to optimize for: 'overall', 'sugar', 'fat', 'salt', or 'calories'. Default: 'overall'.","enum",List.of("overall","sugar","fat","salt","calories")),"max_results",field("number","Maximum number of alternatives to return (default: 5, max: 10).","minimum",1,"maximum",10)),"barcode"));
      Map<String,String> descriptions=Map.of(
        "get_product_by_barcode","Look up a food product by its barcode (EAN-13, UPC-A, or other standard barcode). Returns product name, brand, ingredients, nutrition, Nutri-Score, NOVA group, allergens, and other key information.",
        "search_products","Search Open Food Facts by product name, brand, or description. Results are paginated; use page to fetch additional results.",
        "get_nutrition_info","Get detailed nutrition for a product barcode, including Nutri-Score, NOVA, Eco-Score, calories, nutrient levels, and health highlights.",
        "check_dietary_preferences","Check vegetarian, vegan, gluten-free, and dairy-free suitability based on product ingredients and labels. Verify the actual packaging.",
        "check_allergens","Check product allergens and potential traces. This is an informational analysis; always verify actual packaging, especially for severe allergies.",
        "analyze_ingredients","Explain ingredients, identify additives and E-numbers, and flag potential allergens in a product ingredient list.",
        "compare_products","Compare 2 to 5 food products by barcode. Criteria: overall, sugar, fat, protein, or calories.",
        "find_alternatives","Find healthier alternatives to a product within its most specific category, sorted by overall Nutri-Score, sugar, fat, salt, or calories.");
      var result=new ArrayList<McpServerFeatures.SyncToolSpecification>();
      for(var entry:defs.entrySet()){String name=entry.getKey();var tool=McpSchema.Tool.builder(name,entry.getValue()).description(descriptions.get(name)).build();result.add(new McpServerFeatures.SyncToolSpecification(tool,(exchange,request)->dispatch(h,name,request.arguments())));}
      return result;
    }
    private static McpSchema.CallToolResult dispatch(FoodTools h,String name,Map<String,Object>a){return switch(name){
      case "get_product_by_barcode" -> h.getProduct((String)a.get("barcode"));
      case "search_products" -> h.search((String)a.get("query"),integer(a.get("page")),integer(a.get("page_size")));
      case "get_nutrition_info" -> h.nutrition((String)a.get("barcode"));
      case "check_dietary_preferences" -> h.dietary((String)a.get("barcode"));
      case "check_allergens" -> h.allergens((String)a.get("barcode"));
      case "analyze_ingredients" -> h.ingredients((String)a.get("barcode"));
      case "compare_products" -> h.compare(strings(a.get("barcodes")),(String)a.get("criteria"));
      case "find_alternatives" -> h.alternatives((String)a.get("barcode"),(String)a.get("criteria"),integer(a.get("max_results")));
      default -> throw new IllegalArgumentException("Unknown tool");
    };}
    private static Integer integer(Object v){return v instanceof Number n?n.intValue():null;}
    private static List<String> strings(Object v){if(!(v instanceof List<?> xs))return null;return xs.stream().map(x->x==null?null:x.toString()).toList();}
}
