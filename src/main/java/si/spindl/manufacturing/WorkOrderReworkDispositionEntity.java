package si.spindl.manufacturing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="work_order_rework_dispositions")
public class WorkOrderReworkDispositionEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="work_order_id",nullable=false) private UUID workOrderId;
    @Column(nullable=false) private int quantity;
    @Column(name="good_quantity",nullable=false) private int goodQuantity;
    @Column(name="scrap_quantity",nullable=false) private int scrapQuantity;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected WorkOrderReworkDispositionEntity(){}
    public WorkOrderReworkDispositionEntity(UUID tenantId,UUID workOrderId,int quantity,int good,int scrap,String key){this.tenantId=tenantId;this.workOrderId=workOrderId;this.quantity=quantity;this.goodQuantity=good;this.scrapQuantity=scrap;this.idempotencyKey=key;}
    public boolean matches(UUID orderId,int qty,int good,int scrap){return workOrderId.equals(orderId)&&quantity==qty&&goodQuantity==good&&scrapQuantity==scrap;}
}
