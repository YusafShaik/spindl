package si.spindl.purchasing;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.purchasing.PurchaseOrderDtos.PurchaseOrderView;
import si.spindl.purchasing.PurchaseRequisitionDtos.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/purchase-requisitions")
public class PurchaseRequisitionController {
    private final PurchaseRequisitionService service;
    public PurchaseRequisitionController(PurchaseRequisitionService service){this.service=service;}
    @GetMapping public List<View> list(){return service.list();}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public View create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody CreateRequest request){return service.create(UUID.fromString(jwt.getSubject()),request);}
    @PostMapping("/{id}/approve") public View approve(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.approve(UUID.fromString(jwt.getSubject()),id);}
    @PostMapping("/{id}/reject") public View reject(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody RejectRequest request){return service.reject(UUID.fromString(jwt.getSubject()),id,request.reason());}
    @PostMapping("/{id}/convert") @ResponseStatus(HttpStatus.CREATED) public PurchaseOrderView convert(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody ConvertRequest request){return service.convert(UUID.fromString(jwt.getSubject()),id,request);}
}
