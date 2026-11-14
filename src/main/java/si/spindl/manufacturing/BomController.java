package si.spindl.manufacturing;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.DevelopmentTenant;
import java.util.List;
import java.util.UUID;
@RestController @RequestMapping("/api/boms")
public class BomController {
    private final BomService service;private final BomRoutingService routing;private final DevelopmentTenant tenant;
    public BomController(BomService service,BomRoutingService routing,DevelopmentTenant tenant){this.service=service;this.routing=routing;this.tenant=tenant;}
    @GetMapping public List<ManufacturingDtos.BomView> list(){return service.list(tenant.currentTenantId());}
    @GetMapping("/{id}/history") public List<ManufacturingDtos.BomHistoryView> history(@PathVariable UUID id){return service.history(tenant.currentTenantId(),id);}
    @GetMapping("/{id}/routing") public List<ManufacturingDtos.BomOperationView> routing(@PathVariable UUID id){return routing.list(tenant.currentTenantId(),id);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public ManufacturingDtos.BomView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody ManufacturingDtos.CreateBomRequest request){return service.create(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),request);}
    @PutMapping("/{id}") public ManufacturingDtos.BomView updateDraft(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody ManufacturingDtos.UpdateBomRequest request){return service.updateDraft(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),id,request);}
    @PutMapping("/{id}/routing") public List<ManufacturingDtos.BomOperationView> routing(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody ManufacturingDtos.UpdateRoutingRequest request){return routing.replace(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),id,request);}
    @PostMapping("/{id}/approve") public ManufacturingDtos.BomView approve(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.approve(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),id);}
}
