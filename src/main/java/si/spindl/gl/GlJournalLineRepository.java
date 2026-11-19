package si.spindl.gl;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface GlJournalLineRepository extends JpaRepository<GlJournalLineEntity, UUID> {

    List<GlJournalLineEntity> findAllByTenantIdAndJournalEntryIdOrderByLineNumberAsc(UUID tenantId, UUID journalEntryId);

    interface AccountBalanceProjection {
        UUID getAccountId();
        java.math.BigDecimal getTotalDebit();
        java.math.BigDecimal getTotalCredit();
    }

    @Query("SELECT l.account.id AS accountId, COALESCE(SUM(l.debitAmount), 0) AS totalDebit, COALESCE(SUM(l.creditAmount), 0) AS totalCredit " +
           "FROM GlJournalLineEntity l JOIN l.journalEntry j " +
           "WHERE l.tenantId = :tenantId AND j.status = 'POSTED' " +
           "GROUP BY l.account.id")
    List<AccountBalanceProjection> aggregateAllBalances(@Param("tenantId") UUID tenantId);

    @Query("SELECT l.account.id AS accountId, COALESCE(SUM(l.debitAmount), 0) AS totalDebit, COALESCE(SUM(l.creditAmount), 0) AS totalCredit " +
           "FROM GlJournalLineEntity l JOIN l.journalEntry j " +
           "WHERE l.tenantId = :tenantId AND j.status = 'POSTED' AND j.postingDate <= :asOfDate " +
           "GROUP BY l.account.id")
    List<AccountBalanceProjection> aggregateBalancesAsOf(
            @Param("tenantId") UUID tenantId,
            @Param("asOfDate") LocalDate asOfDate
    );

    @Query("SELECT l.account.id AS accountId, COALESCE(SUM(l.debitAmount), 0) AS totalDebit, COALESCE(SUM(l.creditAmount), 0) AS totalCredit " +
           "FROM GlJournalLineEntity l JOIN l.journalEntry j " +
           "WHERE l.tenantId = :tenantId AND j.status = 'POSTED' " +
           "AND j.postingDate >= :fromDate AND j.postingDate <= :toDate " +
           "GROUP BY l.account.id")
    List<AccountBalanceProjection> aggregateBalancesBetween(
            @Param("tenantId") UUID tenantId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate
    );
}
