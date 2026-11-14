package si.spindl.identity;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class AuthDtos {
    private AuthDtos() {}
    public record RegisterRequest(@NotBlank @Size(max = 160) String name, @NotBlank @Email @Size(max = 254) String email,
                                  @NotBlank @Size(min = 12, max = 72) String password,
                                  @NotBlank @Size(min = 2, max = 180) String workspaceName) {}
    public record LoginRequest(@NotBlank @Email @Size(max = 254) String email, @NotBlank String password) {}
    public record AuthResponse(String accessToken, String tokenType, long expiresIn, String userId, String email,
                               String name, String tenantId, String tenantName, String role) {}
    public record ForgotPasswordRequest(@NotBlank @Email @Size(max = 254) String email) {}
    public record ResetPasswordRequest(@NotBlank String token, @NotBlank @Size(min = 12, max = 72) String password) {}
    public record SessionView(UUID id, Instant createdAt, Instant expiresAt, boolean current) {}
}
