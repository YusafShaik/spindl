package si.spindl.catalog;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="warehouse_stock",uniqueConstraints=@UniqueConstraint(name="uk_warehouse_stock_tenant_location_item",columnNames={"tenant_id","warehouse_id","item_id"}))
public class WarehouseStockEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="warehouse_id",nullable=false) private WarehouseEntity warehouse;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="item_id",nullable=false) private ItemEntity item;
    @Column(name="on_hand",nullable=false) private int onHand;
    @Column(name="reserved_quantity",nullable=false) private int reservedQuantity;
    @Column(name="manufacturing_reserved_quantity",nullable=false) private int manufacturingReservedQuantity;
    @Column(name="quality_hold_quantity",nullable=false) private int qualityHoldQuantity;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected WarehouseStockEntity(){}
    public WarehouseStockEntity(UUID tenantId,WarehouseEntity warehouse,ItemEntity item){this.tenantId=tenantId;this.warehouse=warehouse;this.item=item;this.onHand=0;}
    @PrePersist @PreUpdate void touch(){updatedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public WarehouseEntity getWarehouse(){return warehouse;} public ItemEntity getItem(){return item;} public int getOnHand(){return onHand;} public int getReservedQuantity(){return reservedQuantity;} public int getManufacturingReservedQuantity(){return manufacturingReservedQuantity;} public int getQualityHoldQuantity(){return qualityHoldQuantity;}
    public void addQualityHold(int quantity){if(quantity<=0)throw new IllegalArgumentException("Quality hold must be positive");qualityHoldQuantity=Math.addExact(qualityHoldQuantity,quantity);}
    public void receiveStock(int quantity){if(quantity<=0)throw new IllegalArgumentException("Received quantity must be positive");onHand=Math.addExact(onHand,quantity);}
    public void releaseQualityHold(int quantity){if(quantity<=0||quantity>qualityHoldQuantity)throw new IllegalArgumentException("Quality hold release exceeds the warehouse hold");qualityHoldQuantity-=quantity;}
    public void reserve(int quantity){if(quantity<=0||quantity>onHand-reservedQuantity-qualityHoldQuantity)throw new IllegalArgumentException("Reservation exceeds stock available at this warehouse");reservedQuantity=Math.addExact(reservedQuantity,quantity);}
    public void releaseReservation(int quantity){if(quantity<=0||quantity>reservedQuantity)throw new IllegalArgumentException("Release exceeds the warehouse reservation");reservedQuantity-=quantity;}
    public void dispatchReservedStock(int quantity){if(quantity<=0||quantity>reservedQuantity||quantity>onHand)throw new IllegalArgumentException("Dispatch exceeds the warehouse transfer reservation");reservedQuantity-=quantity;onHand-=quantity;}
    public void reserveManufacturing(int quantity){if(quantity<=0||quantity>onHand-reservedQuantity-manufacturingReservedQuantity-qualityHoldQuantity)throw new IllegalArgumentException("Manufacturing reservation exceeds stock available at this warehouse");manufacturingReservedQuantity=Math.addExact(manufacturingReservedQuantity,quantity);}
    public void releaseManufacturingReservation(int quantity){if(quantity<=0||quantity>manufacturingReservedQuantity)throw new IllegalArgumentException("Release exceeds the warehouse manufacturing reservation");manufacturingReservedQuantity-=quantity;}
    public void validateAvailableDecrease(int quantity){if(quantity<=0||quantity>onHand-reservedQuantity-manufacturingReservedQuantity-qualityHoldQuantity)throw new IllegalArgumentException("Decrease exceeds stock available at this warehouse");}
    public void sellAvailable(int quantity){validateAvailableDecrease(quantity);onHand-=quantity;}
}
