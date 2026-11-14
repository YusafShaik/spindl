package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantApiTokenRepository extends JpaRepository<TenantApiTokenEntity,UUID> {
    List<TenantApiTokenEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    Optional<TenantApiTokenEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    Optional<TenantApiTokenEntity> findByTokenHashAndRevokedAtIsNull(String tokenHash);
}
