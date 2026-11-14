package si.spindl.crm;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="crm_leads")
public class LeadEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(nullable=false,length=180) private String name;
    @Column(length=180) private String company;
    @Column(length=254) private String email;
    @Column(length=40) private String phone;
    @Column(length=80) private String source;
    @Column(nullable=false,length=24) private String stage="NEW";
    @Column(name="owner_user_id") private UUID ownerUserId;
    @Column(name="branch_id",nullable=false) private UUID branchId;
    @Column(name="expected_value",precision=14,scale=2) private BigDecimal expectedValue;
    @Column(name="next_activity_title",length=180) private String nextActivityTitle;
    @Column(name="next_activity_at") private Instant nextActivityAt;
    @Column(name="converted_customer_id") private UUID convertedCustomerId;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @UpdateTimestamp @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected LeadEntity(){}
    public LeadEntity(UUID tenantId,String name,String company,String email,String phone,String source,UUID ownerUserId,UUID branchId,BigDecimal expectedValue,String nextActivityTitle,Instant nextActivityAt){this.tenantId=tenantId;this.name=name;this.company=company;this.email=email;this.phone=phone;this.source=source;this.ownerUserId=ownerUserId;this.branchId=branchId;this.expectedValue=expectedValue;this.nextActivityTitle=nextActivityTitle;this.nextActivityAt=nextActivityAt;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public String getName(){return name;}public String getCompany(){return company;}public String getEmail(){return email;}public String getPhone(){return phone;}public String getSource(){return source;}public String getStage(){return stage;}public UUID getOwnerUserId(){return ownerUserId;}public UUID getBranchId(){return branchId;}public BigDecimal getExpectedValue(){return expectedValue;}public String getNextActivityTitle(){return nextActivityTitle;}public Instant getNextActivityAt(){return nextActivityAt;}public UUID getConvertedCustomerId(){return convertedCustomerId;}public Instant getCreatedAt(){return createdAt;}public Instant getUpdatedAt(){return updatedAt;}
    public void moveTo(String value){stage=value;}
    public void schedule(String title,Instant dueAt){nextActivityTitle=title;nextActivityAt=dueAt;}
    public void convert(UUID customerId){convertedCustomerId=customerId;stage="WON";}
}
