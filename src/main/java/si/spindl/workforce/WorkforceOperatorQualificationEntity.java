package si.spindl.workforce;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.identity.AppUserEntity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "workforce_operator_qualifications")
public class WorkforceOperatorQualificationEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUserEntity user;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "skill_id", nullable = false)
    private WorkforceSkillEntity skill;

    @Column(name = "qualification_level", nullable = false, length = 24)
    private String qualificationLevel; // APPRENTICE, OPERATOR, SPECIALIST, MASTER

    @Column(name = "certified_at", nullable = false)
    private LocalDate certifiedAt = LocalDate.now();

    @Column(name = "expires_at")
    private LocalDate expiresAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "certified_by_user_id")
    private AppUserEntity certifiedByUser;

    @Column(name = "status", nullable = false, length = 24)
    private String status = "ACTIVE"; // ACTIVE, PROBATION, EXPIRED, SUSPENDED

    @Column(name = "notes", length = 255)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public WorkforceOperatorQualificationEntity() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public AppUserEntity getUser() { return user; }
    public void setUser(AppUserEntity user) { this.user = user; }

    public WorkforceSkillEntity getSkill() { return skill; }
    public void setSkill(WorkforceSkillEntity skill) { this.skill = skill; }

    public String getQualificationLevel() { return qualificationLevel; }
    public void setQualificationLevel(String qualificationLevel) { this.qualificationLevel = qualificationLevel; }

    public LocalDate getCertifiedAt() { return certifiedAt; }
    public void setCertifiedAt(LocalDate certifiedAt) { this.certifiedAt = certifiedAt; }

    public LocalDate getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDate expiresAt) { this.expiresAt = expiresAt; }

    public AppUserEntity getCertifiedByUser() { return certifiedByUser; }
    public void setCertifiedByUser(AppUserEntity certifiedByUser) { this.certifiedByUser = certifiedByUser; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
