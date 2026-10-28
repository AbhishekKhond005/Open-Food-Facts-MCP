package com.openfoodfacts.mcp;

import java.util.*;

public record Product(String barcode, String product_name, String brands, String categories, String labels,
        String quantity, String ingredients_text, String allergens, String traces, Map<String,Object> nutriments,
        String nutrition_grades, Integer nova_group, String ecoscore_grade, String image_url,
        String image_front_url, String countries, String stores) {
    public Product { nutriments = nutriments == null ? Map.of() : nutriments; }
    static String str(Map<String,Object> m, String key, String fallback) { Object v=m.get(key); return v == null || v.toString().isBlank() ? fallback : v.toString(); }
    static Product from(Map<String,Object> m) {
        Object ng=m.get("nova_group"); Integer nova=null; try { if (ng!=null && !ng.toString().isBlank()) nova=(int)Double.parseDouble(ng.toString()); } catch(Exception ignored) {}
        Object nn=m.get("nutriments");
        @SuppressWarnings("unchecked") Map<String,Object> n=nn instanceof Map<?,?> ? (Map<String,Object>)nn : Map.of();
        return new Product(str(m,"code",""),str(m,"product_name","Unknown"),str(m,"brands",""),str(m,"categories",""),str(m,"labels",""),str(m,"quantity",""),str(m,"ingredients_text",""),str(m,"allergens",""),str(m,"traces",""),n,str(m,"nutrition_grades",""),nova,str(m,"ecoscore_grade",""),str(m,"image_url",""),str(m,"image_front_url",""),str(m,"countries",""),str(m,"stores",""));
    }
    Double nutrient(String key) { try { Object v=nutriments.get(key); return v==null?null:Double.valueOf(v.toString()); } catch(Exception e){ return null; } }
}
