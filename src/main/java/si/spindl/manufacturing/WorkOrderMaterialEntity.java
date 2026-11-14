package si.spindl.manufacturing;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.catalog.WarehouseEntity;
import java.math.BigDecimal;
import java.util.UUID;

@Entity @Table(name="work_order_materials")
public class WorkOrderMaterialEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="work_order_id",nullable=false) private UUID workOrderId;
    @Column(name="component_item_id",nullable=false) private UUID componentItemId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="warehouse_id",nullable=false) private WarehouseEntity warehouse;
    @Column(name="quantity_per_unit",nullable=false) private int quantityPerUnit;
    @Column(name="scrap_allowance_percent",nullable=false,precision=5,scale=2) private BigDecimal scrapAllowancePercent;
    @Column(name="required_quantity",nullable=false) private int requiredQuantity;
    @Column(name="estimated_unit_cost",precision=14,scale=4) private BigDecimal estimatedUnitCost;
    @Column(name="issued_quantity",nullable=false) private int issuedQuantity;
    @Column(name="returned_quantity",nullable=false) private int returnedQuantity;
    protected WorkOrderMaterialEntity(){}
    public WorkOrderMaterialEntity(UUID tenantId,UUID workOrderId,UUID componentItemId,WarehouseEntity warehouse,int quantityPerUnit,BigDecimal scrapAllowancePercent,int requiredQuantity,BigDecimal estimatedUnitCost){this.tenantId=tenantId;this.workOrderId=workOrderId;this.componentItemId=componentItemId;this.warehouse=warehouse;this.quantityPerUnit=quantityPerUnit;this.scrapAllowancePercent=scrapAllowancePercent;this.requiredQuantity=requiredQuantity;this.estimatedUnitCost=estimatedUnitCost;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public UUID getWorkOrderId(){return workOrderId;}public UUID getComponentItemId(){return componentItemId;}public WarehouseEntity getWarehouse(){return warehouse;}public int getQuantityPerUnit(){return quantityPerUnit;}public BigDecimal getScrapAllowancePercent(){return scrapAllowancePercent;}public int getRequiredQuantity(){return requiredQuantity;}public BigDecimal getEstimatedUnitCost(){return estimatedUnitCost;}public int getIssuedQuantity(){return issuedQuantity;}public int getReturnedQuantity(){return returnedQuantity;}
    public void issue(int quantity){issuedQuantity=Math.addExact(issuedQuantity,quantity);}public void returnQuantity(int quantity){returnedQuantity=Math.addExact(returnedQuantity,quantity);}public int getUnissuedQuantity(){return requiredQuantity-issuedQuantity;}public int getUnreturnedIssuedQuantity(){return issuedQuantity-returnedQuantity;}
}
