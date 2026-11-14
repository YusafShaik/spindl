package si.spindl.purchasing;

import jakarta.persistence.*;
import si.spindl.catalog.ItemEntity;
import java.util.UUID;

@Entity
@Table(name="purchase_return_lines")
public class PurchaseReturnLineEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="purchase_return_id",nullable=false) private PurchaseReturnEntity purchaseReturn;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="purchase_order_line_id",nullable=false) private PurchaseOrderLineEntity purchaseOrderLine;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="item_id",nullable=false) private ItemEntity item;
    @Column(nullable=false) private int quantity;
    protected PurchaseReturnLineEntity(){}
    PurchaseReturnLineEntity(UUID tenantId,PurchaseReturnEntity purchaseReturn,PurchaseOrderLineEntity line,int quantity){this.tenantId=tenantId;this.purchaseReturn=purchaseReturn;this.purchaseOrderLine=line;this.item=line.getItem();this.quantity=quantity;}
    public int getQuantity(){return quantity;}
    public PurchaseOrderLineEntity getPurchaseOrderLine(){return purchaseOrderLine;}
}
