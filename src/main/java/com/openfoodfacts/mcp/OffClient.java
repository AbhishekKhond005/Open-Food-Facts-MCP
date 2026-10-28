package com.openfoodfacts.mcp;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

@Service
public class OffClient {
    private static final String FIELDS="code,product_name,brands,categories,labels,quantity,ingredients_text,allergens,allergens_tags,traces,traces_tags,nutriments,nutrition_grades,nova_group,ecoscore_grade,image_url,image_front_url,countries,stores";
    private final ObjectMapper json; private final HttpClient client; private final String base;
    public OffClient(ObjectMapper json, @Value("${off.api.base-url:https://world.openfoodfacts.org}") String base,
                     @Value("${off.api.timeout-ms:10000}") int timeout) {
        this.json=json; this.base=base.replaceAll("/$", ""); this.client=HttpClient.newBuilder().connectTimeout(Duration.ofMillis(timeout)).build(); this.timeout=timeout;
    }
    private final int timeout;
    private Map<String,Object> get(String url) {
        try {
            var request=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofMillis(timeout)).header("User-Agent","OpenFoodFactsMCP/1.0").GET().build();
            var response=client.send(request,HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()<200 || response.statusCode()>=300) throw new IllegalStateException("Open Food Facts request failed");
            return json.readValue(response.body(),new TypeReference<>(){});
        } catch(InterruptedException e){ Thread.currentThread().interrupt(); throw new IllegalStateException("Open Food Facts API request interrupted"); }
        catch(Exception e){ if(e instanceof IllegalStateException && e.getMessage().startsWith("Open Food Facts")) throw (IllegalStateException)e; throw new IllegalStateException(e instanceof java.net.http.HttpTimeoutException ? "Open Food Facts API request timed out" : "Failed to reach Open Food Facts API"); }
    }
    public Product byBarcode(String barcode) {
        var d=get(base+"/api/v2/product/"+enc(barcode)+"?fields="+FIELDS);
        if("0".equals(String.valueOf(d.get("status"))) || !(d.get("product") instanceof Map<?,?>)) return null;
        @SuppressWarnings("unchecked") Map<String,Object> p=(Map<String,Object>)d.get("product"); return Product.from(p);
    }
    public Map<String,Object> search(String query,int page,int size) {
        String fields="code,product_name,brands,quantity,categories,nutrition_grades,nova_group,image_front_url,ingredients_text,allergens,traces,nutriments,labels,ecoscore_grade";
        return searchUrl(base+"/cgi/search.pl?search_terms="+enc(query)+"&search_simple=1&action=process&json=1&page="+page+"&page_size="+size+"&fields="+fields,page,size);
    }
    public Map<String,Object> category(String category,int page,int size) {
        return searchUrl(base+"/api/v2/search?categories_tags_en="+enc(category)+"&page="+page+"&page_size="+size+"&fields="+FIELDS,page,size);
    }
    private Map<String,Object> searchUrl(String url,int page,int size) {
        var d=get(url); var result=new LinkedHashMap<String,Object>(d); result.putIfAbsent("count",0); result.putIfAbsent("page",page); result.putIfAbsent("page_size",size); result.putIfAbsent("page_count",0);
        var products=new ArrayList<Product>(); Object ps=d.get("products"); if(ps instanceof List<?> list) for(Object p:list) if(p instanceof Map<?,?> m){ @SuppressWarnings("unchecked") Map<String,Object> mm=(Map<String,Object>)m; products.add(Product.from(mm)); }
        result.put("products",products); return result;
    }
    static String enc(String s){ return URLEncoder.encode(s,java.nio.charset.StandardCharsets.UTF_8); }
}
