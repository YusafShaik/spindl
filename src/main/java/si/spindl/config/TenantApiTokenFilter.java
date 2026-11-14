package si.spindl.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;
import si.spindl.identity.TenantApiTokenService;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public class TenantApiTokenFilter extends OncePerRequestFilter {
    private final TenantApiTokenService tokens;
    public TenantApiTokenFilter(TenantApiTokenService tokens){this.tokens=tokens;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
        String secret=request.getHeader("X-API-Key");
        if(secret==null||secret.isBlank()){chain.doFilter(request,response);return;}
        if(request.getHeader("Authorization")!=null||request.getRequestURI().startsWith("/api/auth/")||request.getRequestURI().startsWith("/api/platform/")){response.sendError(HttpServletResponse.SC_UNAUTHORIZED,"API key cannot be used on this route or with a bearer token");return;}
        var identity=tokens.authenticate(secret);
        if(identity==null){response.sendError(HttpServletResponse.SC_UNAUTHORIZED,"API token is invalid, expired, revoked, or no longer has workspace access");return;}
        Instant now=Instant.now();Jwt jwt=Jwt.withTokenValue("api-key-authentication").header("alg","none").issuedAt(now).expiresAt(now.plusSeconds(60)).subject(identity.userId().toString()).claim("tenant_id",identity.tenantId().toString()).claim("roles",List.of(identity.role())).claim("api_scopes",identity.scopes()).claim("api_token_id",identity.tokenId().toString()).build();
        var authentication=new JwtAuthenticationToken(jwt,List.of(new SimpleGrantedAuthority("ROLE_"+identity.role())));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        chain.doFilter(request,response);
    }
}
