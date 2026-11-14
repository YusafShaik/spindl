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

@Entity @Table(name="tenant_api_tokens")
public class TenantApiTokenEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="created_by",nullable=false) private UUID createdBy;
    @Column(nullable=false,length=120) private String name;
    @Column(name="token_prefix",nullable=false,length=24) private String tokenPrefix;
    @Column(name="token_hash",nullable=false,length=64,unique=true) private String tokenHash;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") private List<String> scopes;
    @Column(name="expires_at") private Instant expiresAt;
    @Column(name="revoked_at") private Instant revokedAt;
    @Column(name="last_used_at") private Instant lastUsedAt;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected TenantApiTokenEntity(){}
    public TenantApiTokenEntity(UUID tenantId,UUID createdBy,String name,String prefix,String hash,List<String> scopes,Instant expiresAt){this.tenantId=tenantId;this.createdBy=createdBy;this.name=name;this.tokenPrefix=prefix;this.tokenHash=hash;this.scopes=List.copyOf(scopes);this.expiresAt=expiresAt;}
    public void touch(){lastUsedAt=Instant.now();}
    public void revoke(){if(revokedAt==null)revokedAt=Instant.now();}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public UUID getCreatedBy(){return createdBy;}public String getName(){return name;}public String getTokenPrefix(){return tokenPrefix;}public String getTokenHash(){return tokenHash;}public List<String> getScopes(){return scopes;}public Instant getExpiresAt(){return expiresAt;}public Instant getRevokedAt(){return revokedAt;}public Instant getLastUsedAt(){return lastUsedAt;}public Instant getCreatedAt(){return createdAt;}
}
