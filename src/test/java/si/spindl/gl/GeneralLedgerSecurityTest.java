package si.spindl.gl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import si.spindl.finance.InvoiceRepository;
import si.spindl.pos.PosSaleRepository;
import si.spindl.purchasing.SupplierBillRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class GeneralLedgerSecurityTest {

    private GlAccountRepository accountRepository;
    private GlJournalEntryRepository entryRepository;
    private GlJournalLineRepository lineRepository;
    private InvoiceRepository invoiceRepository;
    private SupplierBillRepository supplierBillRepository;
    private PosSaleRepository posSaleRepository;
    private GeneralLedgerService glService;

    @BeforeEach
    void setUp() {
        accountRepository = Mockito.mock(GlAccountRepository.class);
        entryRepository = Mockito.mock(GlJournalEntryRepository.class);
        lineRepository = Mockito.mock(GlJournalLineRepository.class);
        invoiceRepository = Mockito.mock(InvoiceRepository.class);
        supplierBillRepository = Mockito.mock(SupplierBillRepository.class);
        posSaleRepository = Mockito.mock(PosSaleRepository.class);

        glService = new GeneralLedgerService(
                accountRepository,
                entryRepository,
                lineRepository,
                invoiceRepository,
                supplierBillRepository,
                posSaleRepository
        );
    }

    @Test
    void createJournalEntryRejectsCrossTenantAccount() {
        UUID tenantId = UUID.randomUUID();
        UUID foreignAccountId = UUID.randomUUID();
        UUID localAccountId = UUID.randomUUID();

        // Foreign account does NOT exist under tenantId
        when(accountRepository.findByTenantIdAndId(tenantId, foreignAccountId)).thenReturn(Optional.empty());

        GlJournalEntryEntity entry = new GlJournalEntryEntity();
        entry.setId(UUID.randomUUID());
        entry.setTenantId(tenantId);
        when(entryRepository.save(any(GlJournalEntryEntity.class))).thenReturn(entry);

        GlDtos.CreateJournalLineRequest line1 = new GlDtos.CreateJournalLineRequest(
                foreignAccountId, BigDecimal.valueOf(100.00), BigDecimal.ZERO, "Debit foreign", null
        );
        GlDtos.CreateJournalLineRequest line2 = new GlDtos.CreateJournalLineRequest(
                localAccountId, BigDecimal.ZERO, BigDecimal.valueOf(100.00), "Credit local", null
        );

        GlDtos.CreateJournalEntryRequest req = new GlDtos.CreateJournalEntryRequest(
                LocalDate.now(), "MANUAL", null, null, "Cross tenant test", List.of(line1, line2)
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> glService.createJournalEntry(tenantId, UUID.randomUUID(), req)
        );
        assertTrue(ex.getMessage().contains("Account ID not found"));
    }
}
