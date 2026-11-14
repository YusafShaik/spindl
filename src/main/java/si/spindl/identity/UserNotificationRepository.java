package si.spindl.identity;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserNotificationRepository extends JpaRepository<UserNotificationEntity, UUID> {
    @EntityGraph(attributePaths = "auditEvent")
    List<UserNotificationEntity> findAllByTenantIdAndUserIdOrderByCreatedAtDesc(UUID tenantId, UUID userId, Pageable pageable);
    long countByTenantIdAndUserIdAndReadAtIsNull(UUID tenantId, UUID userId);
    @EntityGraph(attributePaths = "auditEvent")
    Optional<UserNotificationEntity> findByTenantIdAndUserIdAndId(UUID tenantId, UUID userId, UUID id);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update UserNotificationEntity n set n.readAt = current_timestamp where n.tenantId = :tenantId and n.userId = :userId and n.readAt is null")
    int markAllRead(@org.springframework.data.repository.query.Param("tenantId") UUID tenantId,
                    @org.springframework.data.repository.query.Param("userId") UUID userId);
}
