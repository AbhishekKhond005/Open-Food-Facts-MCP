package com.openfoodfacts.mcp;
import org.junit.jupiter.api.Test;import java.util.*;import static org.junit.jupiter.api.Assertions.*;
class FoodToolsTest {
 @Test void exposesEightStableToolNames(){var names=Arrays.stream(FoodTools.class.getDeclaredMethods()).map(m->m.getAnnotation(org.springframework.ai.mcp.annotation.McpTool.class)).filter(Objects::nonNull).map(a->a.name()).toList();assertEquals(8,names.size());assertEquals(Set.of("get_product_by_barcode","search_products","get_nutrition_info","check_dietary_preferences","check_allergens","analyze_ingredients","compare_products","find_alternatives"),new HashSet<>(names));}
 @Test void invalidBarcodeIsSafeToolError(){var tools=new FoodTools(null,new NutritionService());var result=tools.getProduct("abc");assertTrue(result.isError());var text=result.content().getFirst();assertTrue(text instanceof io.modelcontextprotocol.spec.McpSchema.TextContent);assertTrue(((io.modelcontextprotocol.spec.McpSchema.TextContent)text).text().contains("Invalid barcode"));}
 @Test void compareRejectsOutOfRangeBarcodeCount(){var tools=new FoodTools(null,new NutritionService());assertTrue(tools.compare(List.of("1234"),"overall").isError());}
 @Test void searchRejectsBlankQuery(){var tools=new FoodTools(null,new NutritionService());assertTrue(tools.search("  ",1,10).isError());}
}
