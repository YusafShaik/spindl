package si.spindl.gl;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GlAccountRepository extends JpaRepository<GlAccountEntity, UUID> {

    List<GlAccountEntity> findAllByTenantIdOrderByAccountCodeAsc(UUID tenantId);

    List<GlAccountEntity> findAllByTenantIdAndAccountTypeOrderByAccountCodeAsc(UUID tenantId, String accountType);

    Optional<GlAccountEntity> findByTenantIdAndAccountCode(UUID tenantId, String accountCode);

    boolean existsByTenantIdAndAccountCode(UUID tenantId, String accountCode);

    @Query("SELECT a FROM GlAccountEntity a WHERE a.tenantId = :tenantId AND a.isActive = true ORDER BY a.accountCode ASC")
    List<GlAccountEntity> findActiveAccounts(@Param("tenantId") UUID tenantId);
}
