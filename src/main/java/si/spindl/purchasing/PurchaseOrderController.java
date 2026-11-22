package si.spindl.purchasing;

import si.spindl.common.security.AuthenticatedActor;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import si.spindl.purchasing.PurchaseOrderDtos.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/purchase-orders")
public class PurchaseOrderController {
    private final PurchaseOrderService service;
    public PurchaseOrderController(PurchaseOrderService service){this.service=service;}

    @GetMapping public List<PurchaseOrderView> list(){return service.list();}
    @GetMapping("/reorder-suggestions") public List<ReorderSuggestion> reorderSuggestions(){return service.reorderSuggestions();}
    @GetMapping("/{id}") public PurchaseOrderView get(@PathVariable UUID id){return service.get(id);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public PurchaseOrderView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody CreateOrderRequest request){return service.create(request,AuthenticatedActor.userId(jwt));}
    @PostMapping("/{id}/approve") public PurchaseOrderView approve(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.approve(id,AuthenticatedActor.userId(jwt));}
    @PostMapping("/{id}/receive") public ReceiptView receive(@PathVariable UUID id,@Valid @RequestBody ReceiveRequest request){return service.receive(id,request);}
    @PostMapping("/{id}/return") @ResponseStatus(HttpStatus.CREATED) public ReturnView returnGoods(@PathVariable UUID id,@Valid @RequestBody ReturnRequest request){return service.returnGoods(id,request);}
}
