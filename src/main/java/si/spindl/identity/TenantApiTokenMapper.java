package si.spindl.identity;

import si.spindl.identity.TenantApiTokenDtos.TokenView;

/** Entity and row mapping for TenantApiTokenDtos. The records themselves stay free of persistence types. */
public final class TenantApiTokenMapper {
    private TenantApiTokenMapper() {}

    public static TokenView toTokenView(TenantApiTokenEntity entity) {
return new TokenView(entity.getId(),entity.getName(),entity.getTokenPrefix(),entity.getScopes(),entity.getExpiresAt(),entity.getRevokedAt(),entity.getLastUsedAt(),entity.getCreatedAt());
    }
}
