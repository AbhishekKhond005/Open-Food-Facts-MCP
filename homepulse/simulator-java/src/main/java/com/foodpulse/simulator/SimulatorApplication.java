package com.foodpulse.simulator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication
public class SimulatorApplication {
    public static void main(String[] args) { SpringApplication.run(SimulatorApplication.class, args); }
    @Configuration
    static class CorsConfig implements WebMvcConfigurer {
        @Value("${simulator.web-origin}") String origin;
        public void addCorsMappings(CorsRegistry registry) {
            registry.addMapping("/**").allowedOrigins(origin).allowedMethods("GET", "POST", "OPTIONS").allowCredentials(true);
        }
    }
}
