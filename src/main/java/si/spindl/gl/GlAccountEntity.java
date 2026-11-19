package si.spindl.gl;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "gl_accounts")
public class GlAccountEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "account_code", nullable = false, length = 32)
    private String accountCode;

    @Column(name = "account_name", nullable = false, length = 120)
    private String accountName;

    @Column(name = "account_type", nullable = false, length = 32)
    private String accountType; // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE

    @Column(name = "sub_type", nullable = false, length = 64)
    private String subType; // CURRENT_ASSET, FIXED_ASSET, CURRENT_LIABILITY, etc.

    @Column(name = "normal_balance", nullable = false, length = 16)
    private String normalBalance = "DEBIT"; // DEBIT, CREDIT

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_account_id")
    private GlAccountEntity parentAccount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "INR";

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "is_system", nullable = false)
    private boolean isSystem = false;

    @Column(name = "description", length = 255)
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public GlAccountEntity() {}

    public GlAccountEntity(UUID tenantId, String accountCode, String accountName, String accountType, String subType, String normalBalance, boolean isSystem, String description) {
        this.tenantId = tenantId;
        this.accountCode = accountCode;
        this.accountName = accountName;
        this.accountType = accountType;
        this.subType = subType;
        this.normalBalance = normalBalance;
        this.isSystem = isSystem;
        this.description = description;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getAccountCode() { return accountCode; }
    public void setAccountCode(String accountCode) { this.accountCode = accountCode; }

    public String getAccountName() { return accountName; }
    public void setAccountName(String accountName) { this.accountName = accountName; }

    public String getAccountType() { return accountType; }
    public void setAccountType(String accountType) { this.accountType = accountType; }

    public String getSubType() { return subType; }
    public void setSubType(String subType) { this.subType = subType; }

    public String getNormalBalance() { return normalBalance; }
    public void setNormalBalance(String normalBalance) { this.normalBalance = normalBalance; }

    public GlAccountEntity getParentAccount() { return parentAccount; }
    public void setParentAccount(GlAccountEntity parentAccount) { this.parentAccount = parentAccount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public boolean isSystem() { return isSystem; }
    public void setSystem(boolean system) { isSystem = system; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
