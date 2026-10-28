package com.foodpulse.simulator;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

@Service
public class McpClient {
    private final ObjectMapper json;
    private final HttpClient http;
    private final String url, version, name, clientVersion;
    private final long timeout, ttl;
    private String session;
    private boolean initialized;
    private long nextId, expires;
    private List<JsonNode> cache;

    McpClient(ObjectMapper json, @Value("${simulator.mcp-url}") String url,
              @Value("${simulator.protocol-version}") String version,
              @Value("${simulator.client-name}") String name,
              @Value("${simulator.client-version}") String clientVersion,
              @Value("${simulator.timeout-ms}") long timeout,
              @Value("${simulator.cache-ttl-ms}") long ttl) {
        this.json=json; this.url=url; this.version=version; this.name=name; this.clientVersion=clientVersion;
        this.timeout=timeout; this.ttl=ttl; this.http=HttpClient.newBuilder().connectTimeout(Duration.ofMillis(timeout)).build();
    }
    private JsonNode post(Map<String,Object> body, boolean includeSession) throws Exception {
        var b=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofMillis(timeout))
            .header("Content-Type","application/json").header("Accept","application/json, text/event-stream")
            .header("MCP-Protocol-Version",version);
        if(includeSession && session != null) b.header("MCP-Session-Id",session);
        var response=http.send(b.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
        response.headers().firstValue("Mcp-Session-Id").ifPresent(id -> session=id);
        if(response.statusCode()<200 || response.statusCode()>=300) {
            if(response.statusCode()==404) reset();
            throw new IllegalStateException("MCP HTTP "+response.statusCode());
        }
        if(response.statusCode()==202 || response.statusCode()==204) return null;
        String text=response.body();
        if(response.headers().firstValue("content-type").orElse("").contains("text/event-stream")) {
            text=text.lines().filter(line -> line.startsWith("data:")).map(line -> line.substring(5).trim()).findFirst().orElseThrow(() -> new IllegalStateException("Missing MCP event"));
        }
        return json.readTree(text);
    }
    private JsonNode rpc(String method, Map<String,Object> params, boolean includeSession) throws Exception {
        long id=++nextId;
        JsonNode result=post(Map.of("jsonrpc","2.0","id",id,"method",method,"params",params),includeSession);
        if(result==null || result.hasNonNull("error") || result.path("id").asLong()!=id || !result.has("result")) throw new IllegalStateException("Invalid MCP response for "+method);
        return result.get("result");
    }
    private void initialize() throws Exception {
        if(initialized) return;
        rpc("initialize",Map.of("protocolVersion",version,"capabilities",Map.of(),"clientInfo",Map.of("name",name,"version",clientVersion)),false);
        post(Map.of("jsonrpc","2.0","method","notifications/initialized","params",Map.of()),true);
        initialized=true;
    }
    private void reset() { initialized=false; session=null; cache=null; expires=0; }
    synchronized List<JsonNode> tools() throws Exception {
        initialize();
        if(cache!=null && System.currentTimeMillis()<expires) return cache;
        List<JsonNode> all=new ArrayList<>(); String cursor=null;
        do {
            JsonNode r=rpc("tools/list",cursor==null?Map.of():Map.of("cursor",cursor),true);
            r.path("tools").forEach(all::add); cursor=r.path("nextCursor").isTextual()?r.path("nextCursor").asText():null;
        } while(cursor!=null && !cursor.isBlank());
        cache=List.copyOf(all); expires=System.currentTimeMillis()+ttl; return cache;
    }
    synchronized JsonNode call(String name, Map<String,Object> arguments) throws Exception {
        initialize(); return rpc("tools/call",Map.of("name",name,"arguments",arguments),true);
    }
    Map<String,Object> status() {
        try { return Map.of("simulator","ready","mcpServer","connected","discoveredToolCount",tools().size()); }
        catch(Exception e) { return Map.of("simulator","ready","mcpServer","unavailable","discoveredToolCount",0,"error",String.valueOf(e.getMessage())); }
    }
}
