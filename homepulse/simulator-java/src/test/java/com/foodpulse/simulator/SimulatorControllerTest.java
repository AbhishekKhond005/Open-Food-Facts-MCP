package com.foodpulse.simulator;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class SimulatorControllerTest {
    private final ObjectMapper json=new ObjectMapper();
    class FakeClient extends McpClient {
        boolean offline; String called; Map<String,Object> arguments;
        FakeClient() { super(json,"http://localhost:8081/mcp","2025-11-25","test","1",1000,1000); }
        @Override synchronized List<JsonNode> tools() { if(offline) throw new IllegalStateException("offline"); return List.of(json.readTree("{\"name\":\"get_nutrition_info\",\"inputSchema\":{\"type\":\"object\",\"required\":[\"barcode\"],\"properties\":{\"barcode\":{\"type\":\"string\"}}}}")); }
        @Override synchronized JsonNode call(String name,Map<String,Object> args) { called=name; arguments=args; return json.readTree("{\"content\":[{\"type\":\"text\",\"text\":\"Nutrition result\"}],\"structuredContent\":{\"barcode\":\"12345678\"},\"isError\":false}"); }
    }
    @Test void validatesChatAndConfirmsInvalidOrExpiredRequests() {
        var controller=new SimulatorController(new FakeClient());
        assertEquals(400,controller.chat(Map.of("message"," ")).getStatusCode().value());
        assertEquals(400,controller.confirm(Map.of("conversationId","c","confirmationId","x","decision","maybe")).getStatusCode().value());
        assertEquals("failed",controller.confirm(Map.of("conversationId","c","confirmationId","x","decision","approve")).getBody().get("status"));
    }
    @Test void discoversToolAndReturnsCompatibleResult() {
        var client=new FakeClient(); var controller=new SimulatorController(client);
        var result=controller.chat(Map.of("message","nutrition 12345678","conversationId","c")).getBody();
        assertEquals("completed",result.get("status")); assertEquals("Nutrition result",result.get("assistantMessage"));
        assertEquals("c",result.get("conversationId")); assertNotNull(result.get("structuredResult"));
        assertEquals("get_nutrition_info",client.called); assertEquals(Map.of("barcode","12345678"),client.arguments);
        assertTrue(controller.chat(Map.of("message","nutrition")).getBody().get("assistantMessage").toString().contains("barcode"));
    }
    @Test void reportsUnavailableMcp() {
        var client=new FakeClient(); client.offline=true;
        assertEquals("failed",new SimulatorController(client).chat(Map.of("message","hello")).getBody().get("status"));
    }
}
