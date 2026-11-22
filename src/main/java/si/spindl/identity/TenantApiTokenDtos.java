package si.spindl.identity;

import java.time.Instant;
import java.util.UUID;
import java.util.List;

/** API contract for TenantApiTokenService. Mapping to entities lives in the mapper, not here. */
public final class TenantApiTokenDtos {
    private TenantApiTokenDtos() {}

    public record CreateTokenRequest(String name,List<String> scopes,Integer expiresInDays) {}

    public record TokenView(UUID id,String name,String tokenPrefix,List<String> scopes,Instant expiresAt,Instant revokedAt,Instant lastUsedAt,Instant createdAt) {}

    public record CreatedToken(TokenView token,String secret) {}

    public record ApiIdentity(UUID tokenId,UUID tenantId,UUID userId,String role,List<String> scopes) {}
}
