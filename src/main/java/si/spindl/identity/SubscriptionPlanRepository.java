package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlanEntity, UUID> {
    Optional<SubscriptionPlanEntity> findByPlanCodeAndVersionAndActiveTrue(String planCode,int version);
    Optional<SubscriptionPlanEntity> findByPlanCodeAndVersion(String planCode,int version);
}
