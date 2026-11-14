package si.spindl.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import si.spindl.identity.ApiUsageQuotaService;
import java.util.UUID;

@Configuration
public class ApiUsageMeteringConfig implements WebMvcConfigurer {
    private final ApiUsageQuotaService quota;

    public ApiUsageMeteringConfig(ApiUsageQuotaService quota){this.quota=quota;}

    @Override
    public void addInterceptors(InterceptorRegistry registry){registry.addInterceptor(new MeteringInterceptor(quota)).addPathPatterns("/api/**");}

    private static final class MeteringInterceptor implements HandlerInterceptor {
        private final ApiUsageQuotaService quota;
        private MeteringInterceptor(ApiUsageQuotaService quota){this.quota=quota;}

        @Override
        public boolean preHandle(jakarta.servlet.http.HttpServletRequest request,jakarta.servlet.http.HttpServletResponse response,Object handler){
            Authentication authentication=SecurityContextHolder.getContext().getAuthentication();
            if(!(authentication instanceof JwtAuthenticationToken jwt)||!authentication.isAuthenticated())return true;
            String path=request.getRequestURI();
            if(path.equals("/api/tenant/settings/plan")||path.startsWith("/api/tenant/settings/plan-"))return true;
            try{quota.recordAuthenticatedRequest(UUID.fromString(jwt.getToken().getClaimAsString("tenant_id")));}
            catch(IllegalArgumentException exception){throw new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED,"Workspace session is invalid");}
            return true;
        }
    }
}
