package si.spindl.engineering;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.catalog.ItemEntity;
import si.spindl.identity.AppUserEntity;
import si.spindl.manufacturing.BomEntity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "engineering_change_orders", uniqueConstraints = {
        @UniqueConstraint(name = "uk_ecos_tenant_number", columnNames = {"tenant_id", "eco_number"})
})
public class EngineeringChangeOrderEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "eco_number", nullable = false, length = 64)
    private String ecoNumber;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "change_severity", nullable = false, length = 24)
    private String changeSeverity = "MAJOR"; // 'CRITICAL', 'MAJOR', 'MINOR'

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "finished_item_id", nullable = false)
    private ItemEntity finishedItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "base_bom_id")
    private BomEntity baseBom;

    @Column(name = "target_revision", nullable = false, length = 24)
    private String targetRevision;

    @Column(nullable = false, length = 24)
    private String status = "UNDER_REVIEW"; // 'DRAFT', 'UNDER_REVIEW', 'APPROVED', 'IMPLEMENTED', 'REJECTED'

    @Column(name = "effective_cutover_date", nullable = false)
    private LocalDate effectiveCutoverDate;

    @Column(name = "implementation_notes", columnDefinition = "TEXT")
    private String implementationNotes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "implemented_bom_id")
    private BomEntity implementedBom;

    @Column(name = "implemented_at")
    private Instant implementedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private AppUserEntity createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "eco", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EcoBomDiffLineEntity> diffLines = new ArrayList<>();

    @OneToMany(mappedBy = "eco", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EcoSignOffEntity> signOffs = new ArrayList<>();

    protected EngineeringChangeOrderEntity() {}

    public EngineeringChangeOrderEntity(UUID tenantId, String ecoNumber, String title, String reason,
                                        String changeSeverity, ItemEntity finishedItem, BomEntity baseBom,
                                        String targetRevision, LocalDate effectiveCutoverDate, AppUserEntity createdBy) {
        this.tenantId = tenantId;
        this.ecoNumber = ecoNumber;
        this.title = title;
        this.reason = reason;
        this.changeSeverity = changeSeverity != null ? changeSeverity : "MAJOR";
        this.finishedItem = finishedItem;
        this.baseBom = baseBom;
        this.targetRevision = targetRevision;
        this.effectiveCutoverDate = effectiveCutoverDate;
        this.createdBy = createdBy;
        this.status = "UNDER_REVIEW";
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public String getEcoNumber() { return ecoNumber; }
    public String getTitle() { return title; }
    public String getReason() { return reason; }
    public String getChangeSeverity() { return changeSeverity; }
    public ItemEntity getFinishedItem() { return finishedItem; }
    public BomEntity getBaseBom() { return baseBom; }
    public String getTargetRevision() { return targetRevision; }
    public String getStatus() { return status; }
    public LocalDate getEffectiveCutoverDate() { return effectiveCutoverDate; }
    public String getImplementationNotes() { return implementationNotes; }
    public BomEntity getImplementedBom() { return implementedBom; }
    public Instant getImplementedAt() { return implementedAt; }
    public AppUserEntity getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<EcoBomDiffLineEntity> getDiffLines() { return diffLines; }
    public List<EcoSignOffEntity> getSignOffs() { return signOffs; }

    public void addDiffLine(EcoBomDiffLineEntity line) {
        diffLines.add(line);
        line.setEco(this);
    }

    public void addSignOff(EcoSignOffEntity signOff) {
        signOffs.add(signOff);
        signOffset(signOff);
    }

    private void signOffset(EcoSignOffEntity signOff) {
        signOff.setEco(this);
    }

    public void checkAndPromoteApproved() {
        if (!"UNDER_REVIEW".equalsIgnoreCase(this.status)) return;
        boolean allApproved = !signOffs.isEmpty() && signOffs.stream().allMatch(s -> "APPROVED".equalsIgnoreCase(s.getStatus()));
        if (allApproved) {
            this.status = "APPROVED";
        }
    }

    public void markRejected(String notes) {
        this.status = "REJECTED";
        this.implementationNotes = notes;
    }

    public void markImplemented(BomEntity newBom, String notes) {
        this.status = "IMPLEMENTED";
        this.implementedBom = newBom;
        this.implementedAt = Instant.now();
        this.implementationNotes = notes;
    }
}
