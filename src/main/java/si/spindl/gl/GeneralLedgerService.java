package si.spindl.gl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.finance.InvoiceEntity;
import si.spindl.finance.InvoiceRepository;
import si.spindl.pos.PosSaleEntity;
import si.spindl.pos.PosSaleRepository;
import si.spindl.purchasing.SupplierBillEntity;
import si.spindl.purchasing.SupplierBillRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class GeneralLedgerService {

    private final GlAccountRepository accountRepository;
    private final GlJournalEntryRepository entryRepository;
    private final GlJournalLineRepository lineRepository;
    private final InvoiceRepository invoiceRepository;
    private final SupplierBillRepository supplierBillRepository;
    private final PosSaleRepository posSaleRepository;

    public GeneralLedgerService(
            GlAccountRepository accountRepository,
            GlJournalEntryRepository entryRepository,
            GlJournalLineRepository lineRepository,
            InvoiceRepository invoiceRepository,
            SupplierBillRepository supplierBillRepository,
            PosSaleRepository posSaleRepository
    ) {
        this.accountRepository = accountRepository;
        this.entryRepository = entryRepository;
        this.lineRepository = lineRepository;
        this.invoiceRepository = invoiceRepository;
        this.supplierBillRepository = supplierBillRepository;
        this.posSaleRepository = posSaleRepository;
    }

    public void ensureStandardAccounts(UUID tenantId) {
        if (!accountRepository.findAllByTenantIdOrderByAccountCodeAsc(tenantId).isEmpty()) {
            return;
        }

        List<GlAccountEntity> accounts = List.of(
                new GlAccountEntity(tenantId, "1010", "Cash on Hand", "ASSET", "CURRENT_ASSET", "DEBIT", true, "Liquid vault cash and petty disbursements"),
                new GlAccountEntity(tenantId, "1020", "Bank Operating Account", "ASSET", "CURRENT_ASSET", "DEBIT", true, "Primary commercial bank checking account"),
                new GlAccountEntity(tenantId, "1050", "POS Cash Drawer", "ASSET", "CURRENT_ASSET", "DEBIT", true, "Point of sale counter physical float"),
                new GlAccountEntity(tenantId, "1100", "Accounts Receivable (A/R)", "ASSET", "CURRENT_ASSET", "DEBIT", true, "Outstanding invoice receivables from commercial clients"),
                new GlAccountEntity(tenantId, "1210", "Raw Materials Inventory", "ASSET", "CURRENT_ASSET", "DEBIT", true, "Direct raw materials stock valuation in warehouse"),
                new GlAccountEntity(tenantId, "1220", "Work In Progress (WIP)", "ASSET", "CURRENT_ASSET", "DEBIT", true, "Partially assembled production lots on shop floor"),
                new GlAccountEntity(tenantId, "1230", "Finished Goods Inventory", "ASSET", "CURRENT_ASSET", "DEBIT", true, "Completed assemblies ready for commercial dispatch"),
                new GlAccountEntity(tenantId, "1500", "Plant & Machinery", "ASSET", "FIXED_ASSET", "DEBIT", true, "Heavy machinery, CNC mills, and metrology tooling"),
                new GlAccountEntity(tenantId, "1590", "Accumulated Depreciation - Machinery", "ASSET", "FIXED_ASSET", "CREDIT", true, "Contra-asset cumulative machinery depreciation"),
                new GlAccountEntity(tenantId, "2010", "Accounts Payable (A/P)", "LIABILITY", "CURRENT_LIABILITY", "CREDIT", true, "Pending vendor obligations and supplier bills"),
                new GlAccountEntity(tenantId, "2110", "GST Output Tax Payable", "LIABILITY", "CURRENT_LIABILITY", "CREDIT", true, "Collected GST liability owed to tax authorities"),
                new GlAccountEntity(tenantId, "2120", "GST Input Tax Credit", "LIABILITY", "CURRENT_LIABILITY", "DEBIT", true, "Eligible GST credits paid on procurement invoices"),
                new GlAccountEntity(tenantId, "2200", "Accrued Payroll & Benefits", "LIABILITY", "CURRENT_LIABILITY", "CREDIT", true, "Earned employee wages and withholding benefits"),
                new GlAccountEntity(tenantId, "3010", "Owner Capital & Equity", "EQUITY", "EQUITY", "CREDIT", true, "Paid-in founder capital and partner shares"),
                new GlAccountEntity(tenantId, "3020", "Retained Earnings", "EQUITY", "EQUITY", "CREDIT", true, "Cumulative undistributed net profit/loss"),
                new GlAccountEntity(tenantId, "4010", "Manufacturing Sales Revenue", "REVENUE", "OPERATING_REVENUE", "CREDIT", true, "Commercial contract manufacturing sales"),
                new GlAccountEntity(tenantId, "4020", "POS Retail Sales Revenue", "REVENUE", "OPERATING_REVENUE", "CREDIT", true, "Counter walk-in retail sales receipts"),
                new GlAccountEntity(tenantId, "4030", "Engineering & Service Fees", "REVENUE", "OPERATING_REVENUE", "CREDIT", true, "Precision metrology and rapid prototyping fees"),
                new GlAccountEntity(tenantId, "5010", "Raw Materials Consumed (COGS)", "EXPENSE", "COGS", "DEBIT", true, "Material cost recognized upon work order completion"),
                new GlAccountEntity(tenantId, "5020", "Direct Manufacturing Labor", "EXPENSE", "COGS", "DEBIT", true, "Operator routing touch time allocated to production"),
                new GlAccountEntity(tenantId, "5030", "Factory Power & Overheads", "EXPENSE", "COGS", "DEBIT", true, "Industrial 3-phase grid power and machining coolant"),
                new GlAccountEntity(tenantId, "6010", "Salaries & Executive Wages", "EXPENSE", "OPERATING_EXPENSE", "DEBIT", true, "General, administrative, and engineering salaries"),
                new GlAccountEntity(tenantId, "6020", "Plant Facility Rent & Utilities", "EXPENSE", "OPERATING_EXPENSE", "DEBIT", true, "Factory lease, security, and facility maintenance"),
                new GlAccountEntity(tenantId, "6030", "Freight, Shipping & Logistics", "EXPENSE", "OPERATING_EXPENSE", "DEBIT", true, "Outbound freight, carrier surcharges, and challan handling"),
                new GlAccountEntity(tenantId, "6040", "Equipment Repairs & Maintenance", "EXPENSE", "OPERATING_EXPENSE", "DEBIT", true, "CMMS breakdown spare parts and preventative calibration"),
                new GlAccountEntity(tenantId, "6050", "Bank & Payment Gateway Fees", "EXPENSE", "OPERATING_EXPENSE", "DEBIT", true, "Credit card processing fees and bank transaction tariffs")
        );
        accountRepository.saveAll(accounts);
    }

    public List<GlDtos.GlAccountDto> listAccounts(UUID tenantId) {
        ensureStandardAccounts(tenantId);
        List<GlAccountEntity> accounts = accountRepository.findAllByTenantIdOrderByAccountCodeAsc(tenantId);
        Map<UUID, GlJournalLineRepository.AccountBalanceProjection> balanceMap = lineRepository.aggregateAllBalances(tenantId)
                .stream()
                .collect(Collectors.toMap(GlJournalLineRepository.AccountBalanceProjection::getAccountId, p -> p));

        return accounts.stream().map(a -> {
            GlJournalLineRepository.AccountBalanceProjection proj = balanceMap.get(a.getId());
            BigDecimal debit = proj != null && proj.getTotalDebit() != null ? proj.getTotalDebit() : BigDecimal.ZERO;
            BigDecimal credit = proj != null && proj.getTotalCredit() != null ? proj.getTotalCredit() : BigDecimal.ZERO;

            BigDecimal balance;
            if ("DEBIT".equalsIgnoreCase(a.getNormalBalance())) {
                balance = debit.subtract(credit);
            } else {
                balance = credit.subtract(debit);
            }

            return new GlDtos.GlAccountDto(
                    a.getId(),
                    a.getTenantId(),
                    a.getAccountCode(),
                    a.getAccountName(),
                    a.getAccountType(),
                    a.getSubType(),
                    a.getNormalBalance(),
                    a.getParentAccount() != null ? a.getParentAccount().getId() : null,
                    a.getCurrency(),
                    a.isActive(),
                    a.isSystem(),
                    a.getDescription(),
                    balance,
                    a.getCreatedAt()
            );
        }).toList();
    }

    public GlDtos.GlAccountDto createAccount(UUID tenantId, GlDtos.CreateGlAccountRequest req) {
        ensureStandardAccounts(tenantId);
        if (accountRepository.existsByTenantIdAndAccountCode(tenantId, req.accountCode())) {
            throw new IllegalArgumentException("Account with code " + req.accountCode() + " already exists.");
        }

        GlAccountEntity entity = new GlAccountEntity();
        entity.setTenantId(tenantId);
        entity.setAccountCode(req.accountCode());
        entity.setAccountName(req.accountName());
        entity.setAccountType(req.accountType());
        entity.setSubType(req.subType());
        entity.setNormalBalance(req.normalBalance() != null ? req.normalBalance() : "DEBIT");
        entity.setDescription(req.description());
        entity.setSystem(false);
        entity.setActive(true);

        if (req.parentAccountId() != null) {
            accountRepository.findById(req.parentAccountId()).ifPresent(entity::setParentAccount);
        }

        GlAccountEntity saved = accountRepository.save(entity);
        return new GlDtos.GlAccountDto(
                saved.getId(),
                saved.getTenantId(),
                saved.getAccountCode(),
                saved.getAccountName(),
                saved.getAccountType(),
                saved.getSubType(),
                saved.getNormalBalance(),
                saved.getParentAccount() != null ? saved.getParentAccount().getId() : null,
                saved.getCurrency(),
                saved.isActive(),
                saved.isSystem(),
                saved.getDescription(),
                BigDecimal.ZERO,
                saved.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<GlDtos.GlJournalEntryDto> listJournalEntries(
            UUID tenantId,
            String sourceType,
            String status,
            LocalDate fromDate,
            LocalDate toDate
    ) {
        List<GlJournalEntryEntity> entries = entryRepository.filterEntries(
                tenantId,
                (sourceType != null && !sourceType.isBlank() && !"ALL".equalsIgnoreCase(sourceType)) ? sourceType : null,
                (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) ? status : null,
                fromDate,
                toDate
        );

        return entries.stream().map(e -> toEntryDto(e, false)).toList();
    }

    @Transactional(readOnly = true)
    public GlDtos.GlJournalEntryDto getJournalEntry(UUID tenantId, UUID entryId) {
        GlJournalEntryEntity entry = entryRepository.findByTenantIdAndId(tenantId, entryId)
                .orElseThrow(() -> new IllegalArgumentException("Journal Entry not found"));
        return toEntryDto(entry, true);
    }

    public GlDtos.GlJournalEntryDto createJournalEntry(UUID tenantId, UUID userId, GlDtos.CreateJournalEntryRequest req) {
        ensureStandardAccounts(tenantId);
        if (req.lines() == null || req.lines().size() < 2) {
            throw new IllegalArgumentException("Journal entry requires at least 2 lines for double-entry bookkeeping.");
        }

        BigDecimal totalDebit = BigDecimal.ZERO;
        BigDecimal totalCredit = BigDecimal.ZERO;

        for (GlDtos.CreateJournalLineRequest lineReq : req.lines()) {
            BigDecimal deb = lineReq.debitAmount() != null ? lineReq.debitAmount() : BigDecimal.ZERO;
            BigDecimal cred = lineReq.creditAmount() != null ? lineReq.creditAmount() : BigDecimal.ZERO;
            totalDebit = totalDebit.add(deb);
            totalCredit = totalCredit.add(cred);
        }

        if (totalDebit.compareTo(totalCredit) != 0) {
            throw new IllegalArgumentException(String.format(
                    "Journal entry is out of balance. Total Debits (%.2f) must equal Total Credits (%.2f).",
                    totalDebit, totalCredit
            ));
        }

        if (totalDebit.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Journal entry total amount must be strictly greater than zero.");
        }

        // Generate next entry number
        String yyyyMM = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
        long count = entryRepository.countByEntryNumberPrefix(tenantId, "JV-" + yyyyMM + "-%");
        String entryNumber = String.format("JV-%s-%04d", yyyyMM, count + 1);

        GlJournalEntryEntity entry = new GlJournalEntryEntity();
        entry.setTenantId(tenantId);
        entry.setEntryNumber(entryNumber);
        entry.setPostingDate(req.postingDate() != null ? req.postingDate() : LocalDate.now());
        entry.setSourceType(req.sourceType() != null ? req.sourceType() : "MANUAL");
        entry.setSourceReferenceId(req.sourceReferenceId());
        entry.setSourceReferenceNumber(req.sourceReferenceNumber());
        entry.setMemo(req.memo() != null ? req.memo() : "Manual Journal Entry");
        entry.setStatus("POSTED");
        entry.setTotalDebit(totalDebit);
        entry.setTotalCredit(totalCredit);
        entry.setCreatedByUserId(userId);

        GlJournalEntryEntity savedEntry = entryRepository.save(entry);

        int lineNo = 1;
        List<GlJournalLineEntity> lines = new ArrayList<>();
        for (GlDtos.CreateJournalLineRequest lineReq : req.lines()) {
            GlAccountEntity account = accountRepository.findById(lineReq.accountId())
                    .orElseThrow(() -> new IllegalArgumentException("Account ID not found: " + lineReq.accountId()));

            GlJournalLineEntity line = new GlJournalLineEntity();
            line.setTenantId(tenantId);
            line.setJournalEntry(savedEntry);
            line.setLineNumber(lineNo++);
            line.setAccount(account);
            line.setDebitAmount(lineReq.debitAmount() != null ? lineReq.debitAmount() : BigDecimal.ZERO);
            line.setCreditAmount(lineReq.creditAmount() != null ? lineReq.creditAmount() : BigDecimal.ZERO);
            line.setDescription(lineReq.description() != null ? lineReq.description() : savedEntry.getMemo());
            line.setPartyName(lineReq.partyName());
            lines.add(line);
        }

        lineRepository.saveAll(lines);
        savedEntry.setLines(lines);

        return toEntryDto(savedEntry, true);
    }

    @Transactional(readOnly = true)
    public GlDtos.TrialBalanceResponse getTrialBalance(UUID tenantId, LocalDate asOfDate) {
        ensureStandardAccounts(tenantId);
        LocalDate targetDate = asOfDate != null ? asOfDate : LocalDate.now();
        List<GlAccountEntity> accounts = accountRepository.findAllByTenantIdOrderByAccountCodeAsc(tenantId);
        Map<UUID, GlJournalLineRepository.AccountBalanceProjection> balanceMap = lineRepository.aggregateBalancesAsOf(tenantId, targetDate)
                .stream()
                .collect(Collectors.toMap(GlJournalLineRepository.AccountBalanceProjection::getAccountId, p -> p));

        List<GlDtos.TrialBalanceRowDto> rows = new ArrayList<>();
        BigDecimal sumDebit = BigDecimal.ZERO;
        BigDecimal sumCredit = BigDecimal.ZERO;

        for (GlAccountEntity acc : accounts) {
            GlJournalLineRepository.AccountBalanceProjection proj = balanceMap.get(acc.getId());
            BigDecimal debit = proj != null && proj.getTotalDebit() != null ? proj.getTotalDebit() : BigDecimal.ZERO;
            BigDecimal credit = proj != null && proj.getTotalCredit() != null ? proj.getTotalCredit() : BigDecimal.ZERO;

            sumDebit = sumDebit.add(debit);
            sumCredit = sumCredit.add(credit);

            BigDecimal netDebit = BigDecimal.ZERO;
            BigDecimal netCredit = BigDecimal.ZERO;

            if (debit.compareTo(credit) >= 0) {
                netDebit = debit.subtract(credit);
            } else {
                netCredit = credit.subtract(debit);
            }

            rows.add(new GlDtos.TrialBalanceRowDto(
                    acc.getId(),
                    acc.getAccountCode(),
                    acc.getAccountName(),
                    acc.getAccountType(),
                    acc.getSubType(),
                    debit,
                    credit,
                    netDebit,
                    netCredit
            ));
        }

        boolean isBalanced = sumDebit.compareTo(sumCredit) == 0;
        BigDecimal diff = sumDebit.subtract(sumCredit).abs();

        return new GlDtos.TrialBalanceResponse(
                asOfDate != null ? asOfDate : LocalDate.now(),
                rows,
                sumDebit,
                sumCredit,
                isBalanced,
                diff
        );
    }

    @Transactional(readOnly = true)
    public GlDtos.BalanceSheetReportDto getBalanceSheet(UUID tenantId, LocalDate asOfDate) {
        ensureStandardAccounts(tenantId);
        LocalDate targetDate = asOfDate != null ? asOfDate : LocalDate.now();
        List<GlAccountEntity> accounts = accountRepository.findAllByTenantIdOrderByAccountCodeAsc(tenantId);
        Map<UUID, GlJournalLineRepository.AccountBalanceProjection> balanceMap = lineRepository.aggregateBalancesAsOf(tenantId, targetDate)
                .stream()
                .collect(Collectors.toMap(GlJournalLineRepository.AccountBalanceProjection::getAccountId, p -> p));

        List<GlDtos.AccountSummaryRow> currentAssets = new ArrayList<>();
        List<GlDtos.AccountSummaryRow> fixedAssets = new ArrayList<>();
        List<GlDtos.AccountSummaryRow> currentLiabilities = new ArrayList<>();
        List<GlDtos.AccountSummaryRow> longTermLiabilities = new ArrayList<>();
        List<GlDtos.AccountSummaryRow> equityItems = new ArrayList<>();

        BigDecimal totalCurrentAssets = BigDecimal.ZERO;
        BigDecimal totalFixedAssets = BigDecimal.ZERO;
        BigDecimal totalCurrentLiabilities = BigDecimal.ZERO;
        BigDecimal totalLongTermLiabilities = BigDecimal.ZERO;
        BigDecimal totalEquity = BigDecimal.ZERO;

        BigDecimal cumulativeRevenue = BigDecimal.ZERO;
        BigDecimal cumulativeCogs = BigDecimal.ZERO;
        BigDecimal cumulativeExpenses = BigDecimal.ZERO;

        for (GlAccountEntity acc : accounts) {
            GlJournalLineRepository.AccountBalanceProjection proj = balanceMap.get(acc.getId());
            BigDecimal debit = proj != null && proj.getTotalDebit() != null ? proj.getTotalDebit() : BigDecimal.ZERO;
            BigDecimal credit = proj != null && proj.getTotalCredit() != null ? proj.getTotalCredit() : BigDecimal.ZERO;

            switch (acc.getAccountType().toUpperCase()) {
                case "ASSET" -> {
                    BigDecimal bal = "CREDIT".equalsIgnoreCase(acc.getNormalBalance())
                            ? credit.subtract(debit).negate()
                            : debit.subtract(credit);
                    GlDtos.AccountSummaryRow row = new GlDtos.AccountSummaryRow(acc.getId(), acc.getAccountCode(), acc.getAccountName(), acc.getSubType(), bal);
                    if ("FIXED_ASSET".equalsIgnoreCase(acc.getSubType())) {
                        fixedAssets.add(row);
                        totalFixedAssets = totalFixedAssets.add(bal);
                    } else {
                        currentAssets.add(row);
                        totalCurrentAssets = totalCurrentAssets.add(bal);
                    }
                }
                case "LIABILITY" -> {
                    BigDecimal bal = "DEBIT".equalsIgnoreCase(acc.getNormalBalance())
                            ? debit.subtract(credit).negate()
                            : credit.subtract(debit);
                    GlDtos.AccountSummaryRow row = new GlDtos.AccountSummaryRow(acc.getId(), acc.getAccountCode(), acc.getAccountName(), acc.getSubType(), bal);
                    if ("LONG_TERM_LIABILITY".equalsIgnoreCase(acc.getSubType())) {
                        longTermLiabilities.add(row);
                        totalLongTermLiabilities = totalLongTermLiabilities.add(bal);
                    } else {
                        currentLiabilities.add(row);
                        totalCurrentLiabilities = totalCurrentLiabilities.add(bal);
                    }
                }
                case "EQUITY" -> {
                    BigDecimal bal = credit.subtract(debit);
                    GlDtos.AccountSummaryRow row = new GlDtos.AccountSummaryRow(acc.getId(), acc.getAccountCode(), acc.getAccountName(), acc.getSubType(), bal);
                    equityItems.add(row);
                    totalEquity = totalEquity.add(bal);
                }
                case "REVENUE" -> cumulativeRevenue = cumulativeRevenue.add(credit.subtract(debit));
                case "EXPENSE" -> {
                    if ("COGS".equalsIgnoreCase(acc.getSubType())) {
                        cumulativeCogs = cumulativeCogs.add(debit.subtract(credit));
                    } else {
                        cumulativeExpenses = cumulativeExpenses.add(debit.subtract(credit));
                    }
                }
            }
        }

        BigDecimal retainedEarnings = cumulativeRevenue.subtract(cumulativeCogs).subtract(cumulativeExpenses);
        BigDecimal totalAssets = totalCurrentAssets.add(totalFixedAssets);
        BigDecimal totalLiabilities = totalCurrentLiabilities.add(totalLongTermLiabilities);
        BigDecimal totalLiabilitiesAndEquity = totalLiabilities.add(totalEquity).add(retainedEarnings);
        boolean isBalanced = totalAssets.compareTo(totalLiabilitiesAndEquity) == 0;

        return new GlDtos.BalanceSheetReportDto(
                asOfDate != null ? asOfDate : LocalDate.now(),
                currentAssets,
                totalCurrentAssets,
                fixedAssets,
                totalFixedAssets,
                totalAssets,
                currentLiabilities,
                totalCurrentLiabilities,
                longTermLiabilities,
                totalLongTermLiabilities,
                totalLiabilities,
                equityItems,
                retainedEarnings,
                totalEquity.add(retainedEarnings),
                totalLiabilitiesAndEquity,
                isBalanced
        );
    }

    @Transactional(readOnly = true)
    public GlDtos.ProfitLossReportDto getProfitLoss(UUID tenantId, LocalDate fromDate, LocalDate toDate) {
        ensureStandardAccounts(tenantId);
        LocalDate start = fromDate != null ? fromDate : LocalDate.now().withDayOfMonth(1);
        LocalDate end = toDate != null ? toDate : LocalDate.now();
        List<GlAccountEntity> accounts = accountRepository.findAllByTenantIdOrderByAccountCodeAsc(tenantId);
        Map<UUID, GlJournalLineRepository.AccountBalanceProjection> balanceMap = lineRepository.aggregateBalancesBetween(tenantId, start, end)
                .stream()
                .collect(Collectors.toMap(GlJournalLineRepository.AccountBalanceProjection::getAccountId, p -> p));

        List<GlDtos.AccountSummaryRow> revenue = new ArrayList<>();
        List<GlDtos.AccountSummaryRow> cogs = new ArrayList<>();
        List<GlDtos.AccountSummaryRow> expenses = new ArrayList<>();

        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalCogs = BigDecimal.ZERO;
        BigDecimal totalExpenses = BigDecimal.ZERO;

        for (GlAccountEntity acc : accounts) {
            GlJournalLineRepository.AccountBalanceProjection proj = balanceMap.get(acc.getId());
            BigDecimal debit = proj != null && proj.getTotalDebit() != null ? proj.getTotalDebit() : BigDecimal.ZERO;
            BigDecimal credit = proj != null && proj.getTotalCredit() != null ? proj.getTotalCredit() : BigDecimal.ZERO;

            if ("REVENUE".equalsIgnoreCase(acc.getAccountType())) {
                BigDecimal bal = credit.subtract(debit);
                revenue.add(new GlDtos.AccountSummaryRow(acc.getId(), acc.getAccountCode(), acc.getAccountName(), acc.getSubType(), bal));
                totalRevenue = totalRevenue.add(bal);
            } else if ("EXPENSE".equalsIgnoreCase(acc.getAccountType())) {
                BigDecimal bal = debit.subtract(credit);
                if ("COGS".equalsIgnoreCase(acc.getSubType())) {
                    cogs.add(new GlDtos.AccountSummaryRow(acc.getId(), acc.getAccountCode(), acc.getAccountName(), acc.getSubType(), bal));
                    totalCogs = totalCogs.add(bal);
                } else {
                    expenses.add(new GlDtos.AccountSummaryRow(acc.getId(), acc.getAccountCode(), acc.getAccountName(), acc.getSubType(), bal));
                    totalExpenses = totalExpenses.add(bal);
                }
            }
        }

        BigDecimal grossProfit = totalRevenue.subtract(totalCogs);
        BigDecimal grossMargin = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? grossProfit.divide(totalRevenue, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        BigDecimal netIncome = grossProfit.subtract(totalExpenses);
        BigDecimal netMargin = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? netIncome.divide(totalRevenue, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        return new GlDtos.ProfitLossReportDto(
                fromDate != null ? fromDate : LocalDate.now().withDayOfMonth(1),
                toDate != null ? toDate : LocalDate.now(),
                revenue,
                totalRevenue,
                cogs,
                totalCogs,
                grossProfit,
                grossMargin,
                expenses,
                totalExpenses,
                netIncome,
                netMargin
        );
    }

    @Transactional(readOnly = true)
    public GlDtos.FinancialSummaryCardsDto getFinancialSummary(UUID tenantId) {
        ensureStandardAccounts(tenantId);
        GlDtos.BalanceSheetReportDto bs = getBalanceSheet(tenantId, LocalDate.now());
        GlDtos.ProfitLossReportDto pl = getProfitLoss(tenantId, LocalDate.now().withDayOfMonth(1), LocalDate.now());
        long entryCount = entryRepository.countByEntryNumberPrefix(tenantId, "JV-%");

        return new GlDtos.FinancialSummaryCardsDto(
                bs.totalAssets(),
                bs.totalLiabilities(),
                bs.totalEquity(),
                pl.totalRevenue(),
                pl.netOperatingIncome(),
                entryCount,
                bs.isBalanced()
        );
    }

    public GlDtos.SyncSubledgersResultDto syncSubledgers(UUID tenantId) {
        ensureStandardAccounts(tenantId);
        int invoiceCount = 0;
        int billCount = 0;
        int posCount = 0;

        Optional<GlAccountEntity> arOpt = accountRepository.findByTenantIdAndAccountCode(tenantId, "1100");
        Optional<GlAccountEntity> salesOpt = accountRepository.findByTenantIdAndAccountCode(tenantId, "4010");
        Optional<GlAccountEntity> gstOutOpt = accountRepository.findByTenantIdAndAccountCode(tenantId, "2110");
        Optional<GlAccountEntity> rawOpt = accountRepository.findByTenantIdAndAccountCode(tenantId, "1210");
        Optional<GlAccountEntity> apOpt = accountRepository.findByTenantIdAndAccountCode(tenantId, "2010");
        Optional<GlAccountEntity> posDrawerOpt = accountRepository.findByTenantIdAndAccountCode(tenantId, "1050");
        Optional<GlAccountEntity> posSalesOpt = accountRepository.findByTenantIdAndAccountCode(tenantId, "4020");

        if (arOpt.isEmpty() || salesOpt.isEmpty() || gstOutOpt.isEmpty() || rawOpt.isEmpty() || apOpt.isEmpty()) {
            return new GlDtos.SyncSubledgersResultDto(0, 0, 0, 0);
        }

        // 1. Sync Invoices
        List<InvoiceEntity> invoices = invoiceRepository.findAllByTenantIdOrderByIssuedAtDesc(tenantId);
        for (InvoiceEntity inv : invoices) {
            if (!entryRepository.existsByTenantIdAndSourceReferenceId(tenantId, inv.getId())) {
                BigDecimal total = inv.getTotal() != null ? inv.getTotal() : BigDecimal.ZERO;
                BigDecimal subtotal = inv.getSubtotal() != null ? inv.getSubtotal() : total;
                BigDecimal tax = inv.getTaxTotal() != null ? inv.getTaxTotal() : total.subtract(subtotal);

                if (total.compareTo(BigDecimal.ZERO) > 0) {
                    List<GlDtos.CreateJournalLineRequest> lines = List.of(
                            new GlDtos.CreateJournalLineRequest(arOpt.get().getId(), total, BigDecimal.ZERO, "Invoice " + inv.getInvoiceNumber() + " receivable", inv.getCustomer() != null ? inv.getCustomer().getName() : "Customer"),
                            new GlDtos.CreateJournalLineRequest(salesOpt.get().getId(), BigDecimal.ZERO, subtotal, "Sales Revenue for " + inv.getInvoiceNumber(), inv.getCustomer() != null ? inv.getCustomer().getName() : "Customer"),
                            new GlDtos.CreateJournalLineRequest(gstOutOpt.get().getId(), BigDecimal.ZERO, tax, "GST Output Tax for " + inv.getInvoiceNumber(), "Tax Authority")
                    );
                    createJournalEntry(tenantId, null, new GlDtos.CreateJournalEntryRequest(
                            LocalDate.now(),
                            "INVOICE",
                            inv.getId(),
                            inv.getInvoiceNumber(),
                            "Automated subledger sync for Invoice " + inv.getInvoiceNumber(),
                            lines
                    ));
                    invoiceCount++;
                }
            }
        }

        // 2. Sync Supplier Bills
        List<SupplierBillEntity> bills = supplierBillRepository.findAllByTenantIdOrderByIssuedAtDesc(tenantId);
        for (SupplierBillEntity bill : bills) {
            if (!entryRepository.existsByTenantIdAndSourceReferenceId(tenantId, bill.getId())) {
                BigDecimal total = bill.getTotal() != null ? bill.getTotal() : BigDecimal.ZERO;
                if (total.compareTo(BigDecimal.ZERO) > 0) {
                    List<GlDtos.CreateJournalLineRequest> lines = List.of(
                            new GlDtos.CreateJournalLineRequest(rawOpt.get().getId(), total, BigDecimal.ZERO, "Bill " + bill.getBillNumber() + " raw material intake", bill.getSupplier() != null ? bill.getSupplier().getName() : "Vendor"),
                            new GlDtos.CreateJournalLineRequest(apOpt.get().getId(), BigDecimal.ZERO, total, "Trade accounts payable for Bill " + bill.getBillNumber(), bill.getSupplier() != null ? bill.getSupplier().getName() : "Vendor")
                    );
                    createJournalEntry(tenantId, null, new GlDtos.CreateJournalEntryRequest(
                            LocalDate.now(),
                            "SUPPLIER_BILL",
                            bill.getId(),
                            bill.getBillNumber(),
                            "Automated subledger sync for Bill " + bill.getBillNumber(),
                            lines
                    ));
                    billCount++;
                }
            }
        }

        return new GlDtos.SyncSubledgersResultDto(invoiceCount, billCount, posCount, invoiceCount + billCount + posCount);
    }

    private GlDtos.GlJournalEntryDto toEntryDto(GlJournalEntryEntity entity, boolean loadLines) {
        List<GlDtos.GlJournalLineDto> lineDtos = Collections.emptyList();
        if (loadLines) {
            List<GlJournalLineEntity> lines = lineRepository.findAllByTenantIdAndJournalEntryIdOrderByLineNumberAsc(entity.getTenantId(), entity.getId());
            lineDtos = lines.stream().map(l -> new GlDtos.GlJournalLineDto(
                    l.getId(),
                    l.getLineNumber(),
                    l.getAccount().getId(),
                    l.getAccount().getAccountCode(),
                    l.getAccount().getAccountName(),
                    l.getAccount().getAccountType(),
                    l.getDebitAmount(),
                    l.getCreditAmount(),
                    l.getDescription(),
                    l.getPartyName()
            )).toList();
        }

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
                lineDtos
        );
    }
}
