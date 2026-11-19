package si.spindl.gl;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GlJournalEntryRepository extends JpaRepository<GlJournalEntryEntity, UUID> {

    List<GlJournalEntryEntity> findAllByTenantIdOrderByPostingDateDescCreatedAtDesc(UUID tenantId);

    Optional<GlJournalEntryEntity> findByTenantIdAndId(UUID tenantId, UUID id);

    Optional<GlJournalEntryEntity> findByTenantIdAndEntryNumber(UUID tenantId, String entryNumber);

    Optional<GlJournalEntryEntity> findByTenantIdAndSourceReferenceId(UUID tenantId, UUID sourceReferenceId);

    boolean existsByTenantIdAndSourceReferenceId(UUID tenantId, UUID sourceReferenceId);

    @Query("SELECT j FROM GlJournalEntryEntity j WHERE j.tenantId = :tenantId AND (:sourceType IS NULL OR j.sourceType = :sourceType) AND (:status IS NULL OR j.status = :status) AND (:fromDate IS NULL OR j.postingDate >= :fromDate) AND (:toDate IS NULL OR j.postingDate <= :toDate) ORDER BY j.postingDate DESC, j.createdAt DESC")
    List<GlJournalEntryEntity> filterEntries(
            @Param("tenantId") UUID tenantId,
            @Param("sourceType") String sourceType,
            @Param("status") String status,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate
    );

    @Query("SELECT COUNT(j) FROM GlJournalEntryEntity j WHERE j.tenantId = :tenantId AND j.entryNumber LIKE :prefixPattern")
    long countByEntryNumberPrefix(@Param("tenantId") UUID tenantId, @Param("prefixPattern") String prefixPattern);
}
