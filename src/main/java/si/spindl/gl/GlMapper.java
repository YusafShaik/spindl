package si.spindl.gl;

import java.math.BigDecimal;
import java.util.List;

/** Maps ledger entities to API records. Calculated balances stay with the caller. */
public final class GlMapper {

    private GlMapper() {}

    public static GlDtos.GlAccountDto toAccount(GlAccountEntity account, BigDecimal balance) {
        return new GlDtos.GlAccountDto(
                account.getId(),
                account.getTenantId(),
                account.getAccountCode(),
                account.getAccountName(),
                account.getAccountType(),
                account.getSubType(),
                account.getNormalBalance(),
                account.getParentAccount() != null ? account.getParentAccount().getId() : null,
                account.getCurrency(),
                account.isActive(),
                account.isSystem(),
                account.getDescription(),
                balance,
                account.getCreatedAt()
        );
    }

    public static GlDtos.GlJournalLineDto toLine(GlJournalLineEntity line) {
        return new GlDtos.GlJournalLineDto(
                line.getId(),
                line.getLineNumber(),
                line.getAccount().getId(),
                line.getAccount().getAccountCode(),
                line.getAccount().getAccountName(),
                line.getAccount().getAccountType(),
                line.getDebitAmount(),
                line.getCreditAmount(),
                line.getDescription(),
                line.getPartyName()
        );
    }

    public static GlDtos.GlJournalEntryDto toEntry(GlJournalEntryEntity entity, List<GlDtos.GlJournalLineDto> lines) {
        return new GlDtos.GlJournalEntryDto(
                entity.getId(),
                entity.getTenantId(),
                entity.getEntryNumber(),
                entity.getPostingDate(),
                entity.getSourceType(),
                entity.getSourceReferenceId(),
                entity.getSourceReferenceNumber(),
                entity.getMemo(),
                entity.getStatus(),
                entity.getTotalDebit(),
                entity.getTotalCredit(),
                entity.getCreatedByUserId(),
                entity.getCreatedAt(),
                entity.getPostedAt(),
                lines
        );
    }
}
