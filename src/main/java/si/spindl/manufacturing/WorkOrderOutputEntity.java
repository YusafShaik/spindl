package si.spindl.manufacturing;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="work_order_outputs")
public class WorkOrderOutputEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="work_order_id",nullable=false) private UUID workOrderId;
    @Column(name="good_quantity",nullable=false) private int goodQuantity;
    @Column(name="scrap_quantity",nullable=false) private int scrapQuantity;
    @Column(name="rework_quantity",nullable=false) private int reworkQuantity;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(name="byproduct_fingerprint",nullable=false,length=64) private String byproductFingerprint;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected WorkOrderOutputEntity(){}
    public WorkOrderOutputEntity(UUID tenantId,UUID workOrderId,int goodQuantity,int scrapQuantity,int reworkQuantity,String idempotencyKey,String byproductFingerprint){this.tenantId=tenantId;this.workOrderId=workOrderId;this.goodQuantity=goodQuantity;this.scrapQuantity=scrapQuantity;this.reworkQuantity=reworkQuantity;this.idempotencyKey=idempotencyKey;this.byproductFingerprint=byproductFingerprint;}
    public boolean matches(UUID orderId,int good,int scrap,int rework,String fingerprint){return workOrderId.equals(orderId)&&goodQuantity==good&&scrapQuantity==scrap&&reworkQuantity==rework&&byproductFingerprint.equals(fingerprint);}
    public UUID getId(){return id;}
}
