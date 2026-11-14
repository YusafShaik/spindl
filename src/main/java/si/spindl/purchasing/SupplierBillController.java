package si.spindl.purchasing;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
import static si.spindl.purchasing.SupplierBillDtos.*;

@RestController
public class SupplierBillController {
    private final SupplierBillService service;
    public SupplierBillController(SupplierBillService service){this.service=service;}
    @GetMapping("/api/supplier-bills") public List<BillView> list(){return service.list();}
    @PostMapping("/api/purchase-orders/{id}/bill") @ResponseStatus(HttpStatus.CREATED) public BillView issue(@PathVariable UUID id,@Valid @RequestBody IssueRequest request){return service.issue(id,request);}
    @PostMapping("/api/supplier-bills/{id}/payments") public BillView pay(@PathVariable UUID id,@Valid @RequestBody PaymentRequest request){return service.pay(id,request);}
}
