package si.spindl.crm;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="crm_lead_activities")
public class LeadActivityEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="lead_id",nullable=false) private UUID leadId;
    @Column(name="actor_user_id",nullable=false) private UUID actorUserId;
    @Column(name="activity_type",nullable=false,length=24) private String activityType;
    @Column(nullable=false,length=2000) private String body;
    @Column(name="due_at") private Instant dueAt;
    @Column(name="completed_at") private Instant completedAt;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected LeadActivityEntity(){}
    public LeadActivityEntity(UUID tenantId,UUID leadId,UUID actorId,String type,String body,Instant dueAt){this.tenantId=tenantId;this.leadId=leadId;this.actorUserId=actorId;this.activityType=type;this.body=body;this.dueAt=dueAt;}
    public UUID getId(){return id;}public String getActivityType(){return activityType;}public String getBody(){return body;}public Instant getDueAt(){return dueAt;}public Instant getCompletedAt(){return completedAt;}public Instant getCreatedAt(){return createdAt;}public UUID getActorUserId(){return actorUserId;}
    public void complete(){if(completedAt==null)completedAt=Instant.now();}
}
