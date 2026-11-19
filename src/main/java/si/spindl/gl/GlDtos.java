package si.spindl.gl;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class GlDtos {

    public record GlAccountDto(
            UUID id,
            UUID tenantId,
            String accountCode,
            String accountName,
            String accountType,
            String subType,
            String normalBalance,
            UUID parentAccountId,
            String currency,
            boolean isActive,
            boolean isSystem,
            String description,
            BigDecimal currentBalance,
            Instant createdAt
    ) {}

    public record CreateGlAccountRequest(
            String accountCode,
            String accountName,
            String accountType,
            String subType,
            String normalBalance,
            UUID parentAccountId,
            String description
    ) {}

    public record GlJournalLineDto(
            UUID id,
            int lineNumber,
            UUID accountId,
            String accountCode,
            String accountName,
            String accountType,
            BigDecimal debitAmount,
            BigDecimal creditAmount,
            String description,
            String partyName
    ) {}

    public record GlJournalEntryDto(
            UUID id,
            UUID tenantId,
            String entryNumber,
            LocalDate postingDate,
            String sourceType,
            UUID sourceReferenceId,
            String sourceReferenceNumber,
            String memo,
            String status,
            BigDecimal totalDebit,
            BigDecimal totalCredit,
            UUID createdByUserId,
            Instant createdAt,
            Instant postedAt,
            List<GlJournalLineDto> lines
    ) {}

    public record CreateJournalLineRequest(
            UUID accountId,
            BigDecimal debitAmount,
            BigDecimal creditAmount,
            String description,
            String partyName
    ) {}

    public record CreateJournalEntryRequest(
            LocalDate postingDate,
            String sourceType,
            UUID sourceReferenceId,
            String sourceReferenceNumber,
            String memo,
            List<CreateJournalLineRequest> lines
    ) {}

    public record TrialBalanceRowDto(
            UUID accountId,
            String accountCode,
            String accountName,
            String accountType,
            String subType,
            BigDecimal totalDebit,
            BigDecimal totalCredit,
            BigDecimal netDebit,
            BigDecimal netCredit
    ) {}

    public record TrialBalanceResponse(
            LocalDate asOfDate,
            List<TrialBalanceRowDto> rows,
            BigDecimal totalDebit,
            BigDecimal totalCredit,
            boolean isBalanced,
            BigDecimal outOfBalanceAmount
    ) {}

    public record AccountSummaryRow(
            UUID accountId,
            String accountCode,
            String accountName,
            String subType,
            BigDecimal amount
    ) {}

    public record BalanceSheetReportDto(
            LocalDate asOfDate,
            List<AccountSummaryRow> currentAssets,
            BigDecimal totalCurrentAssets,
            List<AccountSummaryRow> fixedAssets,
            BigDecimal totalFixedAssets,
            BigDecimal totalAssets,
            List<AccountSummaryRow> currentLiabilities,
            BigDecimal totalCurrentLiabilities,
            List<AccountSummaryRow> longTermLiabilities,
            BigDecimal totalLongTermLiabilities,
            BigDecimal totalLiabilities,
            List<AccountSummaryRow> equityItems,
            BigDecimal retainedEarnings,
            BigDecimal totalEquity,
            BigDecimal totalLiabilitiesAndEquity,
            boolean isBalanced
    ) {}

    public record ProfitLossReportDto(
            LocalDate fromDate,
            LocalDate toDate,
            List<AccountSummaryRow> operatingRevenue,
            BigDecimal totalRevenue,
            List<AccountSummaryRow> costOfGoodsSold,
            BigDecimal totalCogs,
            BigDecimal grossProfit,
            BigDecimal grossMarginPercent,
            List<AccountSummaryRow> operatingExpenses,
            BigDecimal totalExpenses,
            BigDecimal netOperatingIncome,
            BigDecimal netMarginPercent
    ) {}

    public record FinancialSummaryCardsDto(
            BigDecimal totalAssets,
            BigDecimal totalLiabilities,
            BigDecimal totalEquity,
            BigDecimal periodRevenue,
            BigDecimal netProfit,
            long journalEntriesCount,
            boolean isGlBalanced
    ) {}

    public record SyncSubledgersResultDto(
            int invoicesProcessed,
            int billsProcessed,
            int posSalesProcessed,
            int totalJournalsCreated
    ) {}
}
