package si.spindl.manufacturing;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.DevelopmentTenant;
import java.util.List;
import java.util.UUID;
@RestController @RequestMapping("/api/work-centers")
public class WorkCenterController {
    private final WorkCenterService service;private final DevelopmentTenant tenant;
    public WorkCenterController(WorkCenterService service,DevelopmentTenant tenant){this.service=service;this.tenant=tenant;}
    @GetMapping public List<ManufacturingDtos.WorkCenterView> list(@AuthenticationPrincipal Jwt jwt){return service.list(tenant.currentTenantId()).stream().map(view->protectRates(jwt,view)).toList();}
    @GetMapping("/operators") public List<ManufacturingDtos.OperatorOption> operators(){return service.operators(tenant.currentTenantId());}
    @GetMapping("/{id}/queue") public List<ManufacturingDtos.WorkCenterQueueCard> queue(@PathVariable UUID id){return service.queue(tenant.currentTenantId(),id);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public ManufacturingDtos.WorkCenterView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody ManufacturingDtos.WorkCenterRequest request){requireRatePermission(jwt);return service.create(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),request);}
    @PatchMapping("/{id}/active") public ManufacturingDtos.WorkCenterView active(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody ManufacturingDtos.WorkCenterActiveRequest request){return protectRates(jwt,service.setActive(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),id,request.active()));}
    private ManufacturingDtos.WorkCenterView protectRates(Jwt jwt,ManufacturingDtos.WorkCenterView view){return canViewRates(jwt)?view:view.withoutRates();}
    private void requireRatePermission(Jwt jwt){if(!canViewRates(jwt))throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN,"Only managers and cost roles can configure work-center rates");}
    private boolean canViewRates(Jwt jwt){var roles=jwt.getClaimAsStringList("roles");return roles!=null&&roles.stream().anyMatch(role->java.util.Set.of("OWNER","ADMIN","MANAGER","COST_ANALYST").contains(role));}
}
