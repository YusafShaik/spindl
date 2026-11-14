package si.spindl.manufacturing;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity @Table(name="bills_of_materials")
public class BomEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="finished_item_id",nullable=false) private UUID finishedItemId;
    @Column(nullable=false,length=24) private String revision;
    @Column(nullable=false,length=16) private String status="DRAFT";
    @Column(name="effective_from",nullable=false) private LocalDate effectiveFrom;
    @Column(name="effective_to") private LocalDate effectiveTo;
    @Column(name="approved_at") private Instant approvedAt;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected BomEntity(){}
    public BomEntity(UUID tenantId,UUID finishedItemId,String revision,LocalDate effectiveFrom,LocalDate effectiveTo){this.tenantId=tenantId;this.finishedItemId=finishedItemId;this.revision=revision;this.effectiveFrom=effectiveFrom;this.effectiveTo=effectiveTo;}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public UUID getFinishedItemId(){return finishedItemId;} public String getRevision(){return revision;} public String getStatus(){return status;} public LocalDate getEffectiveFrom(){return effectiveFrom;} public LocalDate getEffectiveTo(){return effectiveTo;}
    public void approve(){status="APPROVED";approvedAt=Instant.now();}
    public void updateDraft(LocalDate from,LocalDate to){if(!status.equals("DRAFT"))throw new IllegalStateException("Only draft BOM revisions can be edited");effectiveFrom=from;effectiveTo=to;}
    public void obsolete(){if(status.equals("APPROVED"))status="OBSOLETE";}
}
