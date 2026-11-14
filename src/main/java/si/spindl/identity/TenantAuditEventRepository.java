package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.UUID;

public interface TenantAuditEventRepository extends JpaRepository<TenantAuditEventEntity, UUID>,JpaSpecificationExecutor<TenantAuditEventEntity> {}
