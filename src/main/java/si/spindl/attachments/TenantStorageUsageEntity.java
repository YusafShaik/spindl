package si.spindl.attachments;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="tenant_storage_usage")
public class TenantStorageUsageEntity {
    @Id @Column(name="tenant_id") private UUID tenantId;
    @Column(name="used_bytes",nullable=false) private long usedBytes;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected TenantStorageUsageEntity(){}
    public UUID getTenantId(){return tenantId;}public long getUsedBytes(){return usedBytes;}
    public void addBytes(long amount){if(amount<=0)throw new IllegalArgumentException("Storage increment must be positive");usedBytes=Math.addExact(usedBytes,amount);updatedAt=Instant.now();}
    public void removeBytes(long amount){if(amount<=0||amount>usedBytes)throw new IllegalArgumentException("Invalid storage decrement");usedBytes-=amount;updatedAt=Instant.now();}
}
