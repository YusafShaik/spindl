package si.spindl.inventory;

import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.util.UUID;

@Entity
@Table(name="inventory_cycle_count_lines",uniqueConstraints=@UniqueConstraint(name="uk_cycle_count_item",columnNames={"cycle_count_id","item_id"}))
public class InventoryCycleCountLineEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="cycle_count_id",nullable=false) private UUID cycleCountId;
    @Column(name="item_id",nullable=false) private UUID itemId;
    @Column(nullable=false,length=64) private String sku;
    @Column(name="item_name",nullable=false,length=180) private String itemName;
    @Column(nullable=false,length=24) private String unit;
    @Column(name="system_quantity",nullable=false) private int systemQuantity;
    @Column(name="counted_quantity") private Integer countedQuantity;
    protected InventoryCycleCountLineEntity(){}
    public InventoryCycleCountLineEntity(UUID tenantId,UUID cycleCountId,ItemEntity item,int systemQuantity){this.tenantId=tenantId;this.cycleCountId=cycleCountId;this.itemId=item.getId();this.sku=item.getSku();this.itemName=item.getName();this.unit=item.getUnit();this.systemQuantity=systemQuantity;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public UUID getCycleCountId(){return cycleCountId;}public UUID getItemId(){return itemId;}public String getSku(){return sku;}public String getItemName(){return itemName;}public String getUnit(){return unit;}public int getSystemQuantity(){return systemQuantity;}public Integer getCountedQuantity(){return countedQuantity;}public Integer getVariance(){return countedQuantity==null?null:countedQuantity-systemQuantity;}
    public void count(int quantity){if(quantity<0)throw new IllegalArgumentException("Counted quantity cannot be negative");countedQuantity=quantity;}
}
