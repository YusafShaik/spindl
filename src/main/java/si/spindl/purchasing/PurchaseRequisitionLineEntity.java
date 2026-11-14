package si.spindl.purchasing;

import jakarta.persistence.*;
import si.spindl.catalog.ItemEntity;
import java.util.UUID;

@Entity
@Table(name="purchase_requisition_lines",uniqueConstraints=@UniqueConstraint(name="uk_purchase_requisition_line_item",columnNames={"requisition_id","item_id"}))
public class PurchaseRequisitionLineEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="requisition_id",nullable=false) private PurchaseRequisitionEntity requisition;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="item_id",nullable=false) private ItemEntity item;
    @Column(nullable=false) private int quantity;
    protected PurchaseRequisitionLineEntity(){}
    PurchaseRequisitionLineEntity(UUID tenantId,PurchaseRequisitionEntity requisition,ItemEntity item,int quantity){this.tenantId=tenantId;this.requisition=requisition;this.item=item;this.quantity=quantity;}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public PurchaseRequisitionEntity getRequisition(){return requisition;} public ItemEntity getItem(){return item;} public int getQuantity(){return quantity;}
}
