package si.spindl.gl;

import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.DevelopmentTenant;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/gl")
public class GeneralLedgerController {

    private final GeneralLedgerService service;
    private final DevelopmentTenant tenant;

    public GeneralLedgerController(GeneralLedgerService service, DevelopmentTenant tenant) {
        this.service = service;
        this.tenant = tenant;
    }

    // ==========================================
    // SUMMARY & METRICS
    // ==========================================

    @GetMapping("/summary")
    public GlDtos.FinancialSummaryCardsDto getSummary() {
        return service.getFinancialSummary(tenant.currentTenantId());
    }

    // ==========================================
    // CHART OF ACCOUNTS
    // ==========================================

    @GetMapping("/accounts")
    public List<GlDtos.GlAccountDto> listAccounts() {
        return service.listAccounts(tenant.currentTenantId());
    }

    @PostMapping("/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    public GlDtos.GlAccountDto createAccount(@Valid @RequestBody GlDtos.CreateGlAccountRequest req) {
        return service.createAccount(tenant.currentTenantId(), req);
    }

    // ==========================================
    // JOURNAL ENTRIES
    // ==========================================

    @GetMapping("/journal-entries")
    public List<GlDtos.GlJournalEntryDto> listJournalEntries(
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate
    ) {
        return service.listJournalEntries(tenant.currentTenantId(), sourceType, status, fromDate, toDate);
    }

    @GetMapping("/journal-entries/{id}")
    public GlDtos.GlJournalEntryDto getJournalEntry(@PathVariable UUID id) {
        return service.getJournalEntry(tenant.currentTenantId(), id);
    }

    @PostMapping("/journal-entries")
    @ResponseStatus(HttpStatus.CREATED)
    public GlDtos.GlJournalEntryDto createJournalEntry(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody GlDtos.CreateJournalEntryRequest req
    ) {
        UUID userId = null;
        if (jwt != null && jwt.getSubject() != null) {
            try {
                userId = UUID.fromString(jwt.getSubject());
            } catch (Exception ignored) {}
        }
        return service.createJournalEntry(tenant.currentTenantId(), userId, req);
    }

    // ==========================================
    // FINANCIAL STATEMENTS & REPORTS
    // ==========================================

    @GetMapping("/trial-balance")
    public GlDtos.TrialBalanceResponse getTrialBalance(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOfDate
    ) {
        return service.getTrialBalance(tenant.currentTenantId(), asOfDate);
    }

    @GetMapping("/balance-sheet")
    public GlDtos.BalanceSheetReportDto getBalanceSheet(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOfDate
    ) {
        return service.getBalanceSheet(tenant.currentTenantId(), asOfDate);
    }

    @GetMapping("/profit-loss")
    public GlDtos.ProfitLossReportDto getProfitLoss(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate
    ) {
        return service.getProfitLoss(tenant.currentTenantId(), fromDate, toDate);
    }

    // ==========================================
    // SUBLEDGER INTEGRATION
    // ==========================================

    @PostMapping("/sync-subledgers")
    public GlDtos.SyncSubledgersResultDto syncSubledgers() {
        return service.syncSubledgers(tenant.currentTenantId());
    }
}
