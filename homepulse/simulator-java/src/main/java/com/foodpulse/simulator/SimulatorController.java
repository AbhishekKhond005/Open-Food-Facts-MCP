package com.foodpulse.simulator;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.*;

@RestController
public class SimulatorController {
    private final McpClient mcp;
    private final Map<String,List<String>> conversations=new ConcurrentHashMap<>();
    private final Map<String,Pending> confirmations=new ConcurrentHashMap<>();
    private static final Pattern BARCODE=Pattern.compile("\\b\\d{8,14}\\b");
    private record Pending(String conversationId,String tool,Map<String,Object> args,long created) {}
    private record Plan(String tool,Map<String,Object> args,String message) {}
    SimulatorController(McpClient mcp) { this.mcp=mcp; }
    @GetMapping("/health") Map<String,Object> health() { return Map.of("status","ok"); }
    @GetMapping("/api/v1/status") Map<String,Object> status() { return mcp.status(); }
    @PostMapping("/api/v1/chat") ResponseEntity<Map<String,Object>> chat(@RequestBody(required=false) Map<String,Object> request) {
        Object raw=request==null?null:request.get("message");
        if(!(raw instanceof String text) || text.isBlank()) return bad("\"message\" is required and must be a non-empty string.");
        String id=request.get("conversationId") instanceof String s && !s.isBlank()?s:newId("conv_");
        conversations.computeIfAbsent(id, ignored -> Collections.synchronizedList(new ArrayList<>())).add(text.trim());
        try {
            List<JsonNode> tools=mcp.tools(); Plan p=plan(text.trim(),tools);
            if(p.message()!=null) return ResponseEntity.ok(response(id,"completed",p.message(),List.of()));
            JsonNode schema=tools.stream().filter(t->t.path("name").asText().equals(p.tool())).findFirst().orElseThrow().path("inputSchema");
            List<String> errors=validate(schema,p.args());
            if(!errors.isEmpty()) return ResponseEntity.ok(response(id,"completed","I'm missing some details: "+String.join("; ",errors)+". Could you provide them?",List.of()));
            return ResponseEntity.ok(execute(id,p.tool(),p.args()));
        } catch(Exception e) {
            return ResponseEntity.ok(response(id,"failed","The food information service is currently unavailable. Please try again in a moment.",List.of(Map.of("toolName","mcp","status","error","summary","MCP server is unreachable."))));
        }
    }
    @PostMapping("/api/v1/chat/confirm") ResponseEntity<Map<String,Object>> confirm(@RequestBody(required=false) Map<String,Object> request) {
        if(request==null || !(request.get("conversationId") instanceof String id) || id.isBlank() || !(request.get("confirmationId") instanceof String cid) || cid.isBlank()) return bad("\"conversationId\" and \"confirmationId\" are required.");
        Object decision=request.get("decision");
        if(!"approve".equals(decision) && !"reject".equals(decision)) return bad("\"decision\" must be \"approve\" or \"reject\".");
        Pending pending=confirmations.remove(cid);
        if(pending==null || System.currentTimeMillis()-pending.created()>300000) return ResponseEntity.ok(response(id,"failed","This confirmation has expired or has already been used. No action was taken.",List.of()));
        if(!pending.conversationId().equals(id)) return ResponseEntity.ok(response(id,"failed","Confirmation mismatch. No action was taken.",List.of()));
        if("reject".equals(decision)) return ResponseEntity.ok(response(id,"completed","No problem — I've cancelled the operation. No changes were made.",List.of(trace(pending.tool(),"cancelled",null))));
        return ResponseEntity.ok(execute(id,pending.tool(),pending.args()));
    }
    private Map<String,Object> execute(String id,String tool,Map<String,Object> args) {
        try {
            JsonNode result=mcp.call(tool,args); boolean error=result.path("isError").asBoolean(false);
            String text=text(result); String message=text.isBlank()?(error?"Sorry, I couldn't complete that operation.":"Done! The operation completed successfully."):text;
            if(error && message.length()>300) message=message.substring(0,297)+"...";
            Map<String,Object> out=response(id,error?"failed":"completed",message,List.of(trace(tool,error?"error":"success",result)));
            if(!error) out.put("structuredResult",result.has("structuredContent")?result.get("structuredContent"):null);
            conversations.computeIfAbsent(id, ignored -> Collections.synchronizedList(new ArrayList<>())).add(message);
            return out;
        } catch(Exception e) { return response(id,"failed","I couldn't reach the food information service. Please check that the MCP server is running.",List.of(trace(tool,"error",null))); }
    }
    static Plan plan(String message,List<JsonNode> tools) {
        String s=message.toLowerCase(Locale.ROOT); Set<String> available=new HashSet<>(); tools.forEach(t->available.add(t.path("name").asText()));
        String tool=null; Map<String,Object> args=new LinkedHashMap<>();
        if(matches(s,"\\b(search|find|look for|show|find me)\\b.*\\b(product|food|brand|cereal|snack|butter|milk|chips|chocolate)\\b")) tool="search_products";
        else if(matches(s,"\\b(compare|versus|vs\\.?|which .*healthier)\\b")) tool="compare_products";
        else if(matches(s,"\\b(alternative|alternatives|healthier|healthiest|lower sugar|less sugar|less salt)\\b")) tool="find_alternatives";
        else if(matches(s,"\\b(nutrition|nutritional|calories|sugar|salt|sodium|fat|protein|allergen|allergy|peanut|ingredient|additive|vegan|vegetarian|gluten|dairy|lactose|dietary)\\b")) {
            tool=matches(s,"allergen|allergy|peanut")?"check_allergens":matches(s,"ingredient|additive|emulsifier|e-number")?"analyze_ingredients":matches(s,"vegan|vegetarian|gluten|dairy|lactose|dietary")?"check_dietary_preferences":"get_nutrition_info";
        } else if(matches(s,"\\b(what is|identify|tell me about|look up)\\b")) tool="search_products";
        else if(BARCODE.matcher(message).find()) tool="get_product_by_barcode";
        if(tool==null || !available.contains(tool)) {
            StringBuilder msg=new StringBuilder("I'm not sure how to help with \"").append(message).append("\". I can search products by name, look up a barcode, analyze nutrition and ingredients, check allergens and dietary preferences, compare products, or find alternatives.\n");
            if(tools.isEmpty()) msg.append("No tools are currently available."); else for(JsonNode t:tools) msg.append("• **").append(t.path("name").asText()).append("**: ").append(t.path("description").asText()).append('\n');
            return new Plan(null,Map.of(),msg.toString().stripTrailing());
        }
        var matcher=BARCODE.matcher(message); var barcodes=new ArrayList<String>(); while(matcher.find()) barcodes.add(matcher.group());
        if(tool.equals("search_products")) {
            String query=message.replaceAll("(?i)\\b(search|find|look for|show|find me|what is|identify|tell me about|look up)\\b","").replaceAll("(?i)\\b(products?|foods?)\\b","").replaceAll("[?.]","").trim();
            args.put("query",query.isEmpty()?message.trim():query); args.put("page",1); args.put("page_size",5);
        } else if(tool.equals("compare_products")) {
            if(barcodes.size()<2) return new Plan(null,Map.of(),"Please include at least two product barcodes so I can compare them.");
            args.put("barcodes",barcodes); args.put("criteria",s.contains("sugar")?"sugar":s.contains("fat")?"fat":s.contains("protein")?"protein":s.contains("calorie")?"calories":"overall");
        } else {
            if(barcodes.isEmpty()) return new Plan(null,Map.of(),"Please include the product's barcode so I can look it up. You can also ask me to search for the product by name first.");
            args.put("barcode",barcodes.getFirst());
        }
        return new Plan(tool,args,null);
    }
    private static boolean matches(String s,String regex) { return Pattern.compile(regex).matcher(s).find(); }
    private static List<String> validate(JsonNode schema,Map<String,Object> args) {
        List<String> errors=new ArrayList<>(); schema.path("required").forEach(n->{if(!args.containsKey(n.asText()) || args.get(n.asText())==null) errors.add("Missing required field: \""+n.asText()+"\"");});
        args.forEach((key,value)->{String expected=schema.path("properties").path(key).path("type").asText(""); String actual=value instanceof String?"string":value instanceof Number?"number":value instanceof List?"array":value instanceof Boolean?"boolean":"object"; if(!expected.isEmpty() && !expected.equals(actual)) errors.add("Field \""+key+"\": expected "+expected+", got "+actual);});
        return errors;
    }
    private static String text(JsonNode result) { if(result==null) return ""; for(JsonNode part:result.path("content")) if("text".equals(part.path("type").asText())) return part.path("text").asText("").trim(); return ""; }
    private static Map<String,Object> trace(String tool,String status,JsonNode result) { String summary=text(result); if(summary.length()>300) summary=summary.substring(0,297)+"..."; if(summary.isEmpty()) summary="error".equals(status)?"The tool \""+tool+"\" returned an error.":"Tool \""+tool+"\" completed."; return Map.of("toolName",tool,"status",status,"summary",summary); }
    private static Map<String,Object> response(String id,String status,String message,List<?> calls) { Map<String,Object> r=new LinkedHashMap<>(); r.put("conversationId",id);r.put("status",status);r.put("assistantMessage",message);r.put("toolCalls",calls);return r; }
    private static ResponseEntity<Map<String,Object>> bad(String detail) { return ResponseEntity.badRequest().body(Map.of("error","Bad request","detail",detail)); }
    private static String newId(String prefix) { return prefix+UUID.randomUUID().toString().replace("-","").substring(0,12); }
}
