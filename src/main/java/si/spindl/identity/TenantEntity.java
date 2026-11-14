package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tenants")
public class TenantEntity {
    @Id @UuidGenerator private UUID id;
    @Column(nullable = false, unique = true, length = 80) private String slug;
    @Column(name = "display_name", nullable = false, length = 180) private String displayName;
    @Column(name = "legal_name", length = 180) private String legalName;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "country_code", nullable = false, length = 2) private String countryCode = "IN";
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "currency_code", nullable = false, length = 3) private String currencyCode = "INR";
    @Column(nullable = false, length = 24) private String status = "trial";
    @Column(nullable = false, length = 64) private String timezone = "UTC";
    @Column(name = "fiscal_year_start_month", nullable = false) private short fiscalYearStartMonth = 1;
    @Column(name = "grace_period_ends_at") private Instant gracePeriodEndsAt;
    @Column(name = "closed_at") private Instant closedAt;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected TenantEntity() {}

    public TenantEntity(UUID id, String slug, String displayName) {
        this.id = id;
        this.slug = slug;
        this.displayName = displayName;
    }

    @PrePersist void onCreate() { Instant now = Instant.now(); createdAt = now; updatedAt = now; }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }

    public UUID getId() { return id; }
    public String getSlug() { return slug; }
    public String getDisplayName() { return displayName; }
    public String getLegalName() { return legalName; }
    public String getCountryCode() { return countryCode; }
    public String getCurrencyCode() { return currencyCode; }
    public String getStatus() { return status; }
    public String getTimezone() { return timezone; }
    public int getFiscalYearStartMonth() { return fiscalYearStartMonth; }
    public Instant getGracePeriodEndsAt() { return gracePeriodEndsAt; }
    public Instant getClosedAt() { return closedAt; }

    public void updateProfile(String displayName, String legalName, String timezone, String countryCode,
                              String currencyCode, int fiscalYearStartMonth) {
        this.displayName = displayName;
        this.legalName = legalName;
        this.timezone = timezone;
        this.countryCode = countryCode;
        this.currencyCode = currencyCode;
        this.fiscalYearStartMonth = (short) fiscalYearStartMonth;
    }

    public boolean isClosed() { return "closed".equals(status); }
    public boolean isReadOnly(Instant now) {
        return "suspended".equals(status) || isClosed()
                || ("past_due".equals(status) && (gracePeriodEndsAt == null || now.isAfter(gracePeriodEndsAt)));
    }
}
