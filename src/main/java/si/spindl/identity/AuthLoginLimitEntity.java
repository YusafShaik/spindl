package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "auth_login_limits")
public class AuthLoginLimitEntity {
    @Id
    @Column(name = "bucket_key", nullable = false, length = 70)
    private String bucketKey;

    @Column(name = "window_started_at", nullable = false)
    private Instant windowStartedAt;

    @Column(name = "failure_count", nullable = false)
    private int failureCount;

    @Column(name = "blocked_until")
    private Instant blockedUntil;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AuthLoginLimitEntity() {}
}
