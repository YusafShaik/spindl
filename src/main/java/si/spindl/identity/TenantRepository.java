package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface TenantRepository extends JpaRepository<TenantEntity, UUID> {
    interface TenantSummary { UUID getId(); String getDisplayName(); String getSlug(); }
    interface TenantAccessState { String getStatus(); Instant getGracePeriodEndsAt(); }

    boolean existsBySlug(String slug);

    @Query("select t.id as id, t.displayName as displayName, t.slug as slug from TenantEntity t where t.id = :id")
    Optional<TenantSummary> findSummaryById(@Param("id") UUID id);

    @Query("select t.status as status, t.gracePeriodEndsAt as gracePeriodEndsAt from TenantEntity t where t.id = :id")
    Optional<TenantAccessState> findAccessStateById(@Param("id") UUID id);
}
