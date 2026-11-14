package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="tenant_roles")
public class TenantRoleEntity {
    @Id private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="role_code",nullable=false,length=24) private String roleCode;
    @Column(name="display_name",nullable=false,length=80) private String displayName;
    @Column(nullable=false,length=240) private String description;
    @Column(name="system_role",nullable=false) private boolean systemRole;
    @Column(name="created_by") private UUID createdBy;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected TenantRoleEntity(){}
    public TenantRoleEntity(UUID id,UUID tenantId,String roleCode,String displayName,String description,boolean systemRole,UUID createdBy){
        this.id=id;this.tenantId=tenantId;this.roleCode=roleCode;this.displayName=displayName;this.description=description;
        this.systemRole=systemRole;this.createdBy=createdBy;this.updatedAt=Instant.now();
    }
    @PreUpdate void touch(){updatedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getRoleCode(){return roleCode;}
    public String getDisplayName(){return displayName;} public String getDescription(){return description;} public boolean isSystemRole(){return systemRole;}
    public UUID getCreatedBy(){return createdBy;} public Instant getCreatedAt(){return createdAt;}
    public void update(String displayName,String description){this.displayName=displayName;this.description=description;}
}
