package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_users")
public class AppUserEntity {
    @Id @UuidGenerator private UUID id;
    @Column(nullable = false, unique = true, length = 254) private String email;
    @Column(name = "password_hash", nullable = false, length = 100) private String passwordHash;
    @Column(name = "display_name", nullable = false, length = 160) private String displayName;
    @Column(nullable = false) private boolean active = true;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected AppUserEntity() {}
    public AppUserEntity(String email, String passwordHash, String displayName) {
        this.email = email; this.passwordHash = passwordHash; this.displayName = displayName;
    }
    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getDisplayName() { return displayName; }
    public boolean isActive() { return active; }
    public void changePassword(String passwordHash) { this.passwordHash = passwordHash; }
}
