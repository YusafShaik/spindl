package si.spindl.logistics;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryChallanRepository extends JpaRepository<DeliveryChallanEntity, UUID> {
    List<DeliveryChallanEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<DeliveryChallanEntity> findAllByTenantIdAndStatusOrderByCreatedAtDesc(UUID tenantId, String status);
    Optional<DeliveryChallanEntity> findByTenantIdAndId(UUID tenantId, UUID id);
    Optional<DeliveryChallanEntity> findByTenantIdAndChallanNumber(UUID tenantId, String challanNumber);
    boolean existsByTenantIdAndChallanNumber(UUID tenantId, String challanNumber);

    @Query("SELECT COUNT(c) FROM DeliveryChallanEntity c WHERE c.tenantId = :tenantId AND c.status = 'IN_TRANSIT'")
    long countInTransit(@Param("tenantId") UUID tenantId);

    @Query("SELECT COUNT(c) FROM DeliveryChallanEntity c WHERE c.tenantId = :tenantId AND c.status = 'PACKED'")
    long countPackedReadyForPickup(@Param("tenantId") UUID tenantId);

    @Query("SELECT COUNT(c) FROM DeliveryChallanEntity c WHERE c.tenantId = :tenantId AND c.status = 'DELIVERED'")
    long countDelivered(@Param("tenantId") UUID tenantId);
}
