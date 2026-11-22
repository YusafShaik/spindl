package si.spindl.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final String frontendUrl;

    public WebConfig(SpindlProperties properties) {
        this.frontendUrl = properties.getFrontendUrl();
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        Set<String> origins = new LinkedHashSet<>(List.of("http://localhost:5173", "http://127.0.0.1:5173"));
        if (frontendUrl != null && !frontendUrl.isBlank()) origins.add(frontendUrl.trim());
        registry.addMapping("/api/**")
                .allowedOrigins(origins.toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "Authorization", "X-Spindl-Tenant", "Idempotency-Key")
                .exposedHeaders("Location");
    }
}
