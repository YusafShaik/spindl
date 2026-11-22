package si.spindl.identity;

import si.spindl.common.security.AuthenticatedActor;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final PasswordResetService passwordResetService;
    public AuthController(AuthService authService, PasswordResetService passwordResetService) { this.authService = authService; this.passwordResetService = passwordResetService; }
    @PostMapping("/register") public AuthDtos.AuthResponse register(@Valid @RequestBody AuthDtos.RegisterRequest request) { return authService.register(request); }
    @PostMapping("/login") public AuthDtos.AuthResponse login(@Valid @RequestBody AuthDtos.LoginRequest request, HttpServletRequest servletRequest) {
        return authService.login(request, servletRequest.getRemoteAddr());
    }
    @PostMapping("/logout") public java.util.Map<String, String> logout(@AuthenticationPrincipal Jwt jwt) {
        authService.revokeSession(AuthenticatedActor.userId(jwt), UUID.fromString(jwt.getId()));
        SecurityContextHolder.clearContext();
        return java.util.Map.of("status", "signed_out", "message", "Remove the bearer token from this device to complete sign out.");
    }
    @GetMapping("/sessions") public java.util.List<AuthDtos.SessionView> sessions(@AuthenticationPrincipal Jwt jwt) {
        return authService.listSessions(AuthenticatedActor.userId(jwt), UUID.fromString(jwt.getId()));
    }
    @DeleteMapping("/sessions/{id}") public java.util.Map<String, String> revokeSession(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        authService.revokeSession(AuthenticatedActor.userId(jwt), id);
        return java.util.Map.of("status", "revoked");
    }
    @PostMapping("/password/forgot") public java.util.Map<String, String> forgot(@Valid @RequestBody AuthDtos.ForgotPasswordRequest request) {
        passwordResetService.request(request.email());
        return java.util.Map.of("status", "accepted", "message", "If an active account exists for that email, a reset link will be sent.");
    }
    @PostMapping("/password/reset") public java.util.Map<String, String> reset(@Valid @RequestBody AuthDtos.ResetPasswordRequest request) {
        passwordResetService.complete(request.token(), request.password());
        return java.util.Map.of("status", "password_reset", "message", "Password updated. Sign in with your new password.");
    }
    @GetMapping("/workspaces") public java.util.List<AuthDtos.WorkspaceView> workspaces(@AuthenticationPrincipal Jwt jwt) {
        return authService.listWorkspaces(AuthenticatedActor.userId(jwt));
    }
    @PostMapping("/switch-tenant/{tenantId}") public AuthDtos.AuthResponse switchTenant(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID tenantId) {
        return authService.switchTenant(AuthenticatedActor.userId(jwt), tenantId);
    }
    @GetMapping("/me") public java.util.Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {
        return java.util.Map.of("userId", jwt.getSubject(), "email", jwt.getClaimAsString("email"), "name", jwt.getClaimAsString("name"),
                "tenantId", jwt.getClaimAsString("tenant_id"), "tenantName", jwt.getClaimAsString("tenant_name"), "role", jwt.getClaimAsStringList("roles").getFirst());
    }
}
