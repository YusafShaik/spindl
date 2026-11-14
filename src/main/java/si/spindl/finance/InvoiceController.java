package si.spindl.finance;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;

import static si.spindl.finance.InvoiceDtos.*;

@RestController
public class InvoiceController {
    private final InvoiceService service;
    private final CustomerCreditNoteService creditNotes;
    public InvoiceController(InvoiceService service,CustomerCreditNoteService creditNotes) { this.service = service;this.creditNotes=creditNotes; }

    @GetMapping("/api/invoices")
    public List<InvoiceView> list() { return service.list(); }

    @PostMapping("/api/sales-orders/{id}/invoice")
    @ResponseStatus(HttpStatus.CREATED)
    public InvoiceView issue(@PathVariable UUID id, @Valid @RequestBody IssueRequest request) { return service.issue(id, request); }

    @PostMapping("/api/invoices/{id}/payments")
    public InvoiceView payment(@PathVariable UUID id, @Valid @RequestBody PaymentRequest request) { return service.recordPayment(id, request); }

    @GetMapping("/api/invoices/settings")
    public InvoiceService.FinanceSettingsView settings(){return service.settings();}

    @PutMapping("/api/invoices/settings")
    public InvoiceService.FinanceSettingsView updateSettings(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody FinanceSettingsUpdateRequest request){return service.updateSettings(UUID.fromString(jwt.getSubject()),request);}

    @GetMapping("/api/invoices/tax-summary")
    public List<InvoiceService.TaxSummaryView> taxSummary(@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to){return service.taxSummary(from,to);}

    @GetMapping(value="/api/invoices/tax-summary/export",produces="text/csv")
    public String exportTaxSummary(@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to){return service.exportTaxSummary(from,to);}

    @GetMapping("/api/customer-credit-notes")
    public List<CustomerCreditNoteDtos.CreditNoteView> creditNotes(){return creditNotes.list();}

    @GetMapping("/api/customer-credit-notes/{id}")
    public CustomerCreditNoteDtos.CreditNoteView creditNote(@PathVariable UUID id){return creditNotes.get(id);}

    @PostMapping("/api/invoices/{id}/credits")
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerCreditNoteDtos.CreditNoteView credit(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody CustomerCreditNoteDtos.CreateCreditRequest request){return creditNotes.create(UUID.fromString(jwt.getSubject()),id,request);}

    @PostMapping("/api/customer-credit-notes/{id}/refunds")
    public CustomerCreditNoteDtos.CreditNoteView refund(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody CustomerCreditNoteDtos.RefundRequest request){return creditNotes.refund(UUID.fromString(jwt.getSubject()),id,request);}
}
