package si.spindl.manufacturing;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="bom_revision_events")
public class BomRevisionEventEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="bom_id",nullable=false) private UUID bomId;
    @Column(name="actor_user_id") private UUID actorUserId;
    @Column(name="event_type",nullable=false,length=24) private String eventType;
    @Column(name="previous_status",length=16) private String previousStatus;
    @Column(name="new_status",nullable=false,length=16) private String newStatus;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected BomRevisionEventEntity(){}
    public BomRevisionEventEntity(UUID tenantId,UUID bomId,UUID actorUserId,String eventType,String previousStatus,String newStatus){this.tenantId=tenantId;this.bomId=bomId;this.actorUserId=actorUserId;this.eventType=eventType;this.previousStatus=previousStatus;this.newStatus=newStatus;}
    public UUID getId(){return id;}public String getEventType(){return eventType;}public String getPreviousStatus(){return previousStatus;}public String getNewStatus(){return newStatus;}public UUID getActorUserId(){return actorUserId;}public Instant getCreatedAt(){return createdAt;}
}
