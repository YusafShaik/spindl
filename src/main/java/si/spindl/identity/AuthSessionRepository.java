package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AuthSessionRepository extends JpaRepository<AuthSessionEntity, UUID> {
    boolean existsByIdAndUserIdAndTenantIdAndRevokedAtIsNullAndExpiresAtAfter(UUID id, UUID userId, UUID tenantId, Instant now);
    List<AuthSessionEntity> findAllByUserIdAndRevokedAtIsNull(UUID userId);
    boolean existsByUserIdAndLoginSourceHashIsNotNullAndLoginSourceHashNot(UUID userId, String loginSourceHash);
}
