package si.spindl.purchasing;

import jakarta.persistence.*;
import si.spindl.catalog.ItemEntity;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name="purchase_order_lines",uniqueConstraints=@UniqueConstraint(name="uk_purchase_order_line_item",columnNames={"purchase_order_id","item_id"}))
public class PurchaseOrderLineEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="purchase_order_id",nullable=false) private PurchaseOrderEntity purchaseOrder;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="item_id",nullable=false) private ItemEntity item;
    @Column(name="ordered_quantity",nullable=false) private int orderedQuantity;
    @Column(name="received_quantity",nullable=false) private int receivedQuantity;
    @Column(name="accepted_quantity",nullable=false) private int acceptedQuantity;
    @Column(name="returned_quantity",nullable=false) private int returnedQuantity;
    @Column(name="billed_quantity",nullable=false) private int billedQuantity;
    @Column(name="credited_quantity",nullable=false) private int creditedQuantity;
    @Column(name="unit_price",nullable=false,precision=14,scale=2) private BigDecimal unitPrice;

    protected PurchaseOrderLineEntity(){}
    PurchaseOrderLineEntity(PurchaseOrderEntity order,UUID tenantId,ItemEntity item,int quantity,BigDecimal unitPrice){this.purchaseOrder=order;this.tenantId=tenantId;this.item=item;this.orderedQuantity=quantity;this.unitPrice=unitPrice;}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public PurchaseOrderEntity getPurchaseOrder(){return purchaseOrder;} public ItemEntity getItem(){return item;} public int getOrderedQuantity(){return orderedQuantity;} public int getReceivedQuantity(){return receivedQuantity;} public int getAcceptedQuantity(){return acceptedQuantity;} public int getReturnedQuantity(){return returnedQuantity;} public int getBilledQuantity(){return billedQuantity;} public int getCreditedQuantity(){return creditedQuantity;} public int getReturnableQuantity(){return acceptedQuantity-returnedQuantity-(billedQuantity-creditedQuantity);} public int getBillableQuantity(){return acceptedQuantity-returnedQuantity-(billedQuantity-creditedQuantity);} public BigDecimal getUnitPrice(){return unitPrice;}
    public int getRemainingQuantity(){return orderedQuantity-receivedQuantity;}
    public boolean isFullyReceived(){return receivedQuantity>=orderedQuantity;}
    public void receive(int accepted,int rejected){int total=Math.addExact(accepted,rejected);if(total<=0||total>getRemainingQuantity())throw new IllegalArgumentException("Receipt quantity exceeds the remaining order quantity");receivedQuantity+=total;acceptedQuantity+=accepted;}
    public void returnAccepted(int quantity){if(quantity<=0||quantity>getReturnableQuantity())throw new IllegalArgumentException("Return quantity exceeds the accepted quantity still returnable");returnedQuantity+=quantity;}
    public void billAccepted(int quantity){if(quantity<=0||quantity>getBillableQuantity())throw new IllegalArgumentException("Bill quantity exceeds accepted uninvoiced quantity");billedQuantity+=quantity;}
    public void creditAndReturnBilled(int quantity){if(quantity<=0||quantity>billedQuantity-creditedQuantity||quantity>acceptedQuantity-returnedQuantity)throw new IllegalArgumentException("Credit return exceeds billed goods not already credited or returned");creditedQuantity+=quantity;returnedQuantity+=quantity;}
}
