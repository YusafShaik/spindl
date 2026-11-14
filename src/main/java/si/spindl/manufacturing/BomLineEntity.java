package si.spindl.manufacturing;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.util.UUID;

@Entity @Table(name="bom_lines")
public class BomLineEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="bom_id",nullable=false) private UUID bomId;
    @Column(name="component_item_id",nullable=false) private UUID componentItemId;
    @Column(name="quantity_per_unit",nullable=false) private int quantityPerUnit;
    @Column(name="scrap_allowance_percent",nullable=false,precision=5,scale=2) private BigDecimal scrapAllowancePercent;
    @Column(name="alternative_group",length=40) private String alternativeGroup;
    protected BomLineEntity(){}
    public BomLineEntity(UUID tenantId,UUID bomId,UUID componentItemId,int quantityPerUnit,BigDecimal scrapAllowancePercent,String alternativeGroup){this.tenantId=tenantId;this.bomId=bomId;this.componentItemId=componentItemId;this.quantityPerUnit=quantityPerUnit;this.scrapAllowancePercent=scrapAllowancePercent;this.alternativeGroup=alternativeGroup;}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public UUID getBomId(){return bomId;} public UUID getComponentItemId(){return componentItemId;} public int getQuantityPerUnit(){return quantityPerUnit;} public BigDecimal getScrapAllowancePercent(){return scrapAllowancePercent;} public String getAlternativeGroup(){return alternativeGroup;}
}
