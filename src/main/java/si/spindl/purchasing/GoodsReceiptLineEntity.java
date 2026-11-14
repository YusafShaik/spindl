package si.spindl.purchasing;

import jakarta.persistence.*;
import si.spindl.catalog.WarehouseEntity;
import java.util.UUID;

@Entity
@Table(name="goods_receipt_lines")
public class GoodsReceiptLineEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="goods_receipt_id",nullable=false) private GoodsReceiptEntity receipt;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="purchase_order_line_id",nullable=false) private PurchaseOrderLineEntity purchaseOrderLine;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="warehouse_id",nullable=false) private WarehouseEntity warehouse;
    @Column(name="accepted_quantity",nullable=false) private int acceptedQuantity;
    @Column(name="rejected_quantity",nullable=false) private int rejectedQuantity;
    protected GoodsReceiptLineEntity(){}
    GoodsReceiptLineEntity(UUID tenantId,GoodsReceiptEntity receipt,PurchaseOrderLineEntity line,WarehouseEntity warehouse,int accepted,int rejected){this.tenantId=tenantId;this.receipt=receipt;this.purchaseOrderLine=line;this.warehouse=warehouse;this.acceptedQuantity=accepted;this.rejectedQuantity=rejected;}
    public WarehouseEntity getWarehouse(){return warehouse;} public int getAcceptedQuantity(){return acceptedQuantity;} public int getRejectedQuantity(){return rejectedQuantity;}
}
