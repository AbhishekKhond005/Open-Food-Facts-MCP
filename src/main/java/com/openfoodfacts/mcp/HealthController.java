package com.openfoodfacts.mcp;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.Map;
@RestController public class HealthController {
 @GetMapping("/health") public Map<String,Object> health(){return Map.of("status","ok","server","open-food-facts-mcp","version","1.0.0","timestamp",Instant.now().toString());}
}
