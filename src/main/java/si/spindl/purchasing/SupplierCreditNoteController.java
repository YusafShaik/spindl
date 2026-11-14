package si.spindl.purchasing;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
import static si.spindl.purchasing.SupplierBillDtos.*;

@RestController
public class SupplierCreditNoteController {
    private final SupplierCreditNoteService service;
    public SupplierCreditNoteController(SupplierCreditNoteService service){this.service=service;}
    @GetMapping("/api/supplier-credit-notes") public List<CreditNoteView> list(){return service.list();}
    @PostMapping("/api/supplier-bills/{id}/credits") @ResponseStatus(HttpStatus.CREATED) public CreditNoteView credit(@PathVariable UUID id,@Valid @RequestBody CreditRequest request){return service.credit(id,request);}
}
