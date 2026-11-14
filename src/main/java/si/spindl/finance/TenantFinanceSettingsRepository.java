package si.spindl.finance;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;

public interface TenantFinanceSettingsRepository extends JpaRepository<TenantFinanceSettingsEntity,UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from TenantFinanceSettingsEntity s where s.tenantId=:tenantId")
    Optional<TenantFinanceSettingsEntity> findForUpdate(@Param("tenantId") UUID tenantId);
}
