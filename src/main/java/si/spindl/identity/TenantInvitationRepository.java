package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public interface TenantInvitationRepository extends JpaRepository<TenantInvitationEntity, UUID> {
    Optional<TenantInvitationEntity> findByTokenHash(String tokenHash);
    List<TenantInvitationEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    Optional<TenantInvitationEntity> findByIdAndTenantId(UUID id, UUID tenantId);
    long countByTenantIdAndAcceptedAtIsNullAndExpiresAtAfter(UUID tenantId, java.time.Instant now);
    @Transactional long deleteAllByTenantIdAndRoleAndAcceptedAtIsNull(UUID tenantId,String role);
    @Transactional void deleteAllByTenantIdAndEmailAndAcceptedAtIsNull(UUID tenantId, String email);
}
