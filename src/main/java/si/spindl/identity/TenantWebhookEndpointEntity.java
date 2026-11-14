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
import java.util.List;
import java.util.UUID;

@Entity @Table(name="tenant_webhook_endpoints")
public class TenantWebhookEndpointEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(nullable=false,length=120) private String name;
    @Column(name="target_url",nullable=false,length=2048) private String targetUrl;
    @Column(name="secret_ciphertext",nullable=false,length=1024) private String secretCiphertext;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="event_types",nullable=false,columnDefinition="jsonb") private List<String> eventTypes;
    @Column(nullable=false) private boolean active=true;
    @Column(name="created_by",nullable=false) private UUID createdBy;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected TenantWebhookEndpointEntity(){}
    public TenantWebhookEndpointEntity(UUID tenantId,String name,String url,String ciphertext,List<String> events,UUID createdBy){this.tenantId=tenantId;this.name=name;this.targetUrl=url;this.secretCiphertext=ciphertext;this.eventTypes=List.copyOf(events);this.createdBy=createdBy;}
    public void deactivate(){active=false;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public String getName(){return name;}public String getTargetUrl(){return targetUrl;}public String getSecretCiphertext(){return secretCiphertext;}public List<String> getEventTypes(){return eventTypes;}public boolean isActive(){return active;}public UUID getCreatedBy(){return createdBy;}public Instant getCreatedAt(){return createdAt;}
}
