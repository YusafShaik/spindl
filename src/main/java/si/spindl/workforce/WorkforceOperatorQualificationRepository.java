package si.spindl.workforce;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkforceOperatorQualificationRepository extends JpaRepository<WorkforceOperatorQualificationEntity, UUID> {

    List<WorkforceOperatorQualificationEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    List<WorkforceOperatorQualificationEntity> findAllByTenantIdAndUserId(UUID tenantId, UUID userId);

    List<WorkforceOperatorQualificationEntity> findAllByTenantIdAndSkillId(UUID tenantId, UUID skillId);

    Optional<WorkforceOperatorQualificationEntity> findByTenantIdAndUserIdAndSkillId(UUID tenantId, UUID userId, UUID skillId);

    Optional<WorkforceOperatorQualificationEntity> findByTenantIdAndId(UUID tenantId, UUID id);

    @Query("SELECT q FROM WorkforceOperatorQualificationEntity q WHERE q.tenantId = :tenantId AND q.user.id = :userId AND q.skill.skillCode = :skillCode AND q.status = 'ACTIVE'")
    Optional<WorkforceOperatorQualificationEntity> findActiveQualificationBySkillCode(
            @Param("tenantId") UUID tenantId,
            @Param("userId") UUID userId,
            @Param("skillCode") String skillCode
    );

    @Query("SELECT COUNT(q) FROM WorkforceOperatorQualificationEntity q WHERE q.tenantId = :tenantId AND q.status = 'ACTIVE'")
    long countActiveQualifications(@Param("tenantId") UUID tenantId);
}
