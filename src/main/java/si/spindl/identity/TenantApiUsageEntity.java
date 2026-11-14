package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name="tenant_api_usage")
public class TenantApiUsageEntity {
    @Id private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="usage_month",nullable=false) private LocalDate usageMonth;
    @Column(name="request_count",nullable=false) private long requestCount;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected TenantApiUsageEntity(){}
}
