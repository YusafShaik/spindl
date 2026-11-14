package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tenant_role_permissions")
public class TenantRolePermissionEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(nullable = false, length = 24) private String role;
    @Column(nullable = false, length = 64) private String module;
    @Column(nullable = false, length = 64) private String resource;
    @Column(nullable = false, length = 32) private String action;
    @Column(name = "permission_scope", nullable = false, length = 24) private String permissionScope = "ALL";
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected TenantRolePermissionEntity() {}
    public TenantRolePermissionEntity(UUID tenantId, String role, String module, String resource, String action, String scope) {
        this.tenantId = tenantId; this.role = role; this.module = module; this.resource = resource; this.action = action; this.permissionScope = scope;
    }
    public UUID getTenantId(){return tenantId;} public String getRole(){return role;} public String getModule(){return module;}
    public String getResource(){return resource;} public String getAction(){return action;} public String getPermissionScope(){return permissionScope;}
}
