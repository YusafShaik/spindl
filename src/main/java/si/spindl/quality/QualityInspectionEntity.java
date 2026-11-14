package si.spindl.quality;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="quality_inspections",uniqueConstraints=@UniqueConstraint(name="uk_quality_inspection_idempotency",columnNames={"tenant_id","idempotency_key"}))
public class QualityInspectionEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="quality_lot_id",nullable=false) private UUID qualityLotId;
    @Column(nullable=false,length=8) private String outcome;
    @Column(nullable=false) private int quantity;
    @Column(length=500) private String notes;
    @Column(name="inspector_user_id",nullable=false) private UUID inspectorUserId;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected QualityInspectionEntity(){}
    public QualityInspectionEntity(UUID tenantId,UUID lotId,String outcome,int quantity,String notes,UUID inspectorId,String key){this.tenantId=tenantId;this.qualityLotId=lotId;this.outcome=outcome;this.quantity=quantity;this.notes=notes;this.inspectorUserId=inspectorId;this.idempotencyKey=key;}
    public UUID getId(){return id;}public String getOutcome(){return outcome;}public int getQuantity(){return quantity;}public boolean matches(UUID lotId,String requestedOutcome,int requestedQuantity,String requestedNotes){return qualityLotId.equals(lotId)&&outcome.equals(requestedOutcome)&&quantity==requestedQuantity&&java.util.Objects.equals(notes,requestedNotes);}
}
