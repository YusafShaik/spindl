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
@Table(name="tenant_branches")
public class TenantBranchEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(nullable=false,length=40) private String code;
    @Column(nullable=false,length=120) private String name;
    @Column(name="legal_name",length=180) private String legalName;
    @Column(name="tax_registration",length=80) private String taxRegistration;
    @Column(nullable=false) private boolean active=true;
    @Column(name="is_default",nullable=false) private boolean defaultBranch;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected TenantBranchEntity(){}
    public TenantBranchEntity(UUID tenantId,String code,String name,String legalName,String taxRegistration,boolean defaultBranch){this.tenantId=tenantId;this.code=code;this.name=name;this.legalName=legalName;this.taxRegistration=taxRegistration;this.defaultBranch=defaultBranch;}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getCode(){return code;} public String getName(){return name;} public String getLegalName(){return legalName;} public String getTaxRegistration(){return taxRegistration;} public boolean isActive(){return active;} public boolean isDefaultBranch(){return defaultBranch;}
    public void update(String code,String name,String legalName,String taxRegistration){this.code=code;this.name=name;this.legalName=legalName;this.taxRegistration=taxRegistration;}
    public void setActive(boolean active){if(defaultBranch&&!active)throw new IllegalStateException("The default branch cannot be deactivated");this.active=active;}
}
