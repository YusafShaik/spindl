package si.spindl.engineering;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.catalog.ItemEntity;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "eco_bom_diff_lines")
public class EcoBomDiffLineEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "eco_id", nullable = false)
    private EngineeringChangeOrderEntity eco;

    @Column(name = "change_type", nullable = false, length = 24)
    private String changeType; // 'ADD', 'REMOVE', 'QUANTITY_CHANGE'

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "component_item_id", nullable = false)
    private ItemEntity componentItem;

    @Column(name = "old_quantity", nullable = false)
    private int oldQuantity = 0;

    @Column(name = "new_quantity", nullable = false)
    private int newQuantity = 0;

    @Column(name = "old_scrap_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal oldScrapPercent = BigDecimal.ZERO;

    @Column(name = "new_scrap_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal newScrapPercent = BigDecimal.ZERO;

    @Column(length = 255)
    private String notes;

    protected EcoBomDiffLineEntity() {
    }

    public EcoBomDiffLineEntity(UUID tenantId, EngineeringChangeOrderEntity eco, String changeType,
                                ItemEntity componentItem, int oldQuantity, int newQuantity,
                                BigDecimal oldScrapPercent, BigDecimal newScrapPercent, String notes) {
        this.tenantId = tenantId;
        this.eco = eco;
        this.changeType = changeType;
        this.componentItem = componentItem;
        this.oldQuantity = oldQuantity;
        this.newQuantity = newQuantity;
        this.oldScrapPercent = oldScrapPercent != null ? oldScrapPercent : BigDecimal.ZERO;
        this.newScrapPercent = newScrapPercent != null ? newScrapPercent : BigDecimal.ZERO;
        this.notes = notes;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public EngineeringChangeOrderEntity getEco() {
        return eco;
    }

    public void setEco(EngineeringChangeOrderEntity eco) {
        this.eco = eco;
    }

    public String getChangeType() {
        return changeType;
    }

    public ItemEntity getComponentItem() {
        return componentItem;
    }

    public int getOldQuantity() {
        return oldQuantity;
    }

    public int getNewQuantity() {
        return newQuantity;
    }

    public BigDecimal getOldScrapPercent() {
        return oldScrapPercent;
    }

    public BigDecimal getNewScrapPercent() {
        return newScrapPercent;
    }

    public String getNotes() {
        return notes;
    }
}
