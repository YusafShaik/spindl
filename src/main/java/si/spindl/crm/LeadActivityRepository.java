package si.spindl.crm;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface LeadActivityRepository extends JpaRepository<LeadActivityEntity,UUID> {
    List<LeadActivityEntity> findAllByTenantIdAndLeadIdOrderByCreatedAtDesc(UUID tenantId,UUID leadId);
}
