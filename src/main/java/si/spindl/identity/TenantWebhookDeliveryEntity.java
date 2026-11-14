package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity @Table(name="tenant_webhook_deliveries")
public class TenantWebhookDeliveryEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="endpoint_id",nullable=false) private UUID endpointId;
    @Column(name="event_type",nullable=false,length=80) private String eventType;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") private Map<String,Object> payload;
    @Column(nullable=false,length=16) private String status="PENDING";
    @Column(name="attempt_count",nullable=false) private short attemptCount;
    @Column(name="replay_count",nullable=false) private short replayCount;
    @Column(name="next_attempt_at",nullable=false) private Instant nextAttemptAt=Instant.now();
    @Column(name="claimed_at") private Instant claimedAt;
    @Column(name="last_response_status") private Integer lastResponseStatus;
    @Column(name="last_error",length=500) private String lastError;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="delivered_at") private Instant deliveredAt;
    protected TenantWebhookDeliveryEntity(){}
    public TenantWebhookDeliveryEntity(UUID tenantId,UUID endpointId,String eventType,Map<String,Object> payload){this.tenantId=tenantId;this.endpointId=endpointId;this.eventType=eventType;this.payload=Map.copyOf(payload);}
    public void claim(){status="PROCESSING";claimedAt=Instant.now();}
    public void delivered(Integer responseStatus){attemptCount++;lastResponseStatus=responseStatus;lastError=null;status="DELIVERED";deliveredAt=Instant.now();claimedAt=null;}
    public void failed(Integer responseStatus,String error){attemptCount++;lastResponseStatus=responseStatus;lastError=error==null?null:error.substring(0,Math.min(error.length(),500));claimedAt=null;if(attemptCount>=8){status="DEAD";return;}status="RETRY";long delay=Math.min(3600,30L<<(attemptCount-1));nextAttemptAt=Instant.now().plusSeconds(delay);}
    public void dead(String error){status="DEAD";lastError=error==null?null:error.substring(0,Math.min(error.length(),500));claimedAt=null;}
    public void replay(){if(!"DEAD".equals(status))throw new IllegalStateException("Only dead-letter deliveries can be replayed");status="PENDING";attemptCount=0;replayCount++;nextAttemptAt=Instant.now();claimedAt=null;lastResponseStatus=null;lastError=null;deliveredAt=null;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public UUID getEndpointId(){return endpointId;}public String getEventType(){return eventType;}public Map<String,Object> getPayload(){return payload;}public String getStatus(){return status;}public short getAttemptCount(){return attemptCount;}public short getReplayCount(){return replayCount;}public Instant getNextAttemptAt(){return nextAttemptAt;}public Instant getClaimedAt(){return claimedAt;}public Integer getLastResponseStatus(){return lastResponseStatus;}public String getLastError(){return lastError;}public Instant getCreatedAt(){return createdAt;}public Instant getDeliveredAt(){return deliveredAt;}
}
