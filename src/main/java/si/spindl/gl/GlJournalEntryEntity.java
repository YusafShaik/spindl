package si.spindl.gl;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "gl_journal_entries")
public class GlJournalEntryEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "entry_number", nullable = false, length = 64)
    private String entryNumber;

    @Column(name = "posting_date", nullable = false)
    private LocalDate postingDate = LocalDate.now();

    @Column(name = "source_type", nullable = false, length = 32)
    private String sourceType = "MANUAL"; // MANUAL, INVOICE, SUPPLIER_BILL, CUSTOMER_PAYMENT, SUPPLIER_PAYMENT, POS_SALE, PERIOD_CLOSE

    @Column(name = "source_reference_id")
    private UUID sourceReferenceId;

    @Column(name = "source_reference_number", length = 64)
    private String sourceReferenceNumber;

    @Column(name = "memo", nullable = false, length = 255)
    private String memo;

    @Column(name = "status", nullable = false, length = 24)
    private String status = "POSTED"; // DRAFT, POSTED, VOIDED

    @Column(name = "total_debit", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalDebit = BigDecimal.ZERO;

    @Column(name = "total_credit", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalCredit = BigDecimal.ZERO;

    @Column(name = "created_by_user_id")
    private UUID createdByUserId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "posted_at", nullable = false)
    private Instant postedAt = Instant.now();

    @OneToMany(mappedBy = "journalEntry", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("lineNumber ASC")
    private List<GlJournalLineEntity> lines = new ArrayList<>();

    public GlJournalEntryEntity() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getEntryNumber() { return entryNumber; }
    public void setEntryNumber(String entryNumber) { this.entryNumber = entryNumber; }

    public LocalDate getPostingDate() { return postingDate; }
    public void setPostingDate(LocalDate postingDate) { this.postingDate = postingDate; }

    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }

    public UUID getSourceReferenceId() { return sourceReferenceId; }
    public void setSourceReferenceId(UUID sourceReferenceId) { this.sourceReferenceId = sourceReferenceId; }

    public String getSourceReferenceNumber() { return sourceReferenceNumber; }
    public void setSourceReferenceNumber(String sourceReferenceNumber) { this.sourceReferenceNumber = sourceReferenceNumber; }

    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public BigDecimal getTotalDebit() { return totalDebit; }
    public void setTotalDebit(BigDecimal totalDebit) { this.totalDebit = totalDebit; }

    public BigDecimal getTotalCredit() { return totalCredit; }
    public void setTotalCredit(BigDecimal totalCredit) { this.totalCredit = totalCredit; }

    public UUID getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(UUID createdByUserId) { this.createdByUserId = createdByUserId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getPostedAt() { return postedAt; }
    public void setPostedAt(Instant postedAt) { this.postedAt = postedAt; }

    public List<GlJournalLineEntity> getLines() { return lines; }
    public void setLines(List<GlJournalLineEntity> lines) { this.lines = lines; }
}
