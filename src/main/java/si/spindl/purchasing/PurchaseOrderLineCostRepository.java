package si.spindl.purchasing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PurchaseOrderLineCostRepository extends JpaRepository<PurchaseOrderLineEntity, UUID> {
    @Query("select line.item.id as itemId, sum(line.unitPrice * (line.acceptedQuantity - line.returnedQuantity)) as totalValue, sum(line.acceptedQuantity - line.returnedQuantity) as totalUnits from PurchaseOrderLineEntity line where line.tenantId=:tenantId and line.acceptedQuantity>line.returnedQuantity group by line.item.id")
    List<AcceptedPurchaseCost> findAcceptedCostBasis(@Param("tenantId") UUID tenantId);
}
