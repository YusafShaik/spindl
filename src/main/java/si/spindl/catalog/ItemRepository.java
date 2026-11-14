package si.spindl.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ItemRepository extends JpaRepository<ItemEntity, UUID> {
    List<ItemEntity> findAllByTenantIdAndActiveTrueOrderByName(UUID tenantId);
    Page<ItemEntity> findAllByTenantIdAndActiveTrueOrderByName(UUID tenantId,Pageable pageable);
    Optional<ItemEntity> findByTenantIdAndId(UUID tenantId, UUID id);
    boolean existsByTenantIdAndSkuIgnoreCase(UUID tenantId, String sku);
    boolean existsByTenantIdAndBarcodeIgnoreCase(UUID tenantId,String barcode);
    boolean existsByTenantIdAndBarcodeIgnoreCaseAndIdNot(UUID tenantId,String barcode,UUID id);
    long countByTenantIdAndActiveTrue(UUID tenantId);
    @Query("select sum(i.onHand * i.unitPrice) from ItemEntity i where i.tenantId=:tenantId and i.active=true")
    Optional<BigDecimal> calculateInventoryValue(@Param("tenantId") UUID tenantId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ItemEntity i where i.tenantId=:tenantId and i.id=:id and i.active=true")
    Optional<ItemEntity> findActiveForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ItemEntity i where i.tenantId=:tenantId and i.id=:id")
    Optional<ItemEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
    @Query("select i from ItemEntity i where i.tenantId=:tenantId and i.active=true and i.onHand-i.reservedQuantity-i.manufacturingReservedQuantity-i.qualityHoldQuantity <= i.lowStockThreshold order by i.onHand-i.reservedQuantity-i.manufacturingReservedQuantity-i.qualityHoldQuantity asc, i.name asc")
    List<ItemEntity> findLowStock(@Param("tenantId") UUID tenantId);
    @Query("select count(i) from ItemEntity i where i.tenantId=:tenantId and i.active=true and i.onHand-i.reservedQuantity-i.manufacturingReservedQuantity-i.qualityHoldQuantity <= i.lowStockThreshold")
    long countLowStock(@Param("tenantId") UUID tenantId);
}
