package si.spindl.manufacturing;
import si.spindl.common.security.AuthenticatedActor;
import si.spindl.common.security.JwtRoleGate;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.CurrentTenant;
import java.util.List;
import java.util.UUID;
@RestController @RequestMapping("/api/work-orders")
public class WorkOrderController {
    private final WorkOrderService service;private final CurrentTenant tenant;
    public WorkOrderController(WorkOrderService service,CurrentTenant tenant){this.service=service;this.tenant=tenant;}
    @GetMapping public List<ManufacturingDtos.WorkOrderView> list(@AuthenticationPrincipal Jwt jwt){return service.list(tenant.currentTenantId()).stream().map(view->protectCost(jwt,view)).toList();}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public ManufacturingDtos.WorkOrderView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody ManufacturingDtos.CreateWorkOrderRequest request){return protectCost(jwt,service.create(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),request));}
    @GetMapping("/{id}/availability") public ManufacturingDtos.WorkOrderView availability(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return protectCost(jwt,service.availability(tenant.currentTenantId(),id));}
    @PostMapping("/{id}/release") public ManufacturingDtos.WorkOrderView release(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return protectCost(jwt,service.release(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id));}
    @PostMapping("/{id}/materials/{lineId}/issue") public ManufacturingDtos.WorkOrderView issue(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@PathVariable UUID lineId,@Valid @RequestBody ManufacturingDtos.QuantityRequest request){return protectCost(jwt,service.issue(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id,lineId,request));}
    @PostMapping("/{id}/materials/{lineId}/return") public ManufacturingDtos.WorkOrderView returnMaterial(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@PathVariable UUID lineId,@Valid @RequestBody ManufacturingDtos.QuantityRequest request){return protectCost(jwt,service.returnMaterial(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id,lineId,request));}
    @PostMapping("/{id}/output") public ManufacturingDtos.WorkOrderView output(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody ManufacturingDtos.OutputRequest request){return protectCost(jwt,service.output(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id,request));}
    @PostMapping("/{id}/rework/disposition") public ManufacturingDtos.WorkOrderView disposeRework(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody ManufacturingDtos.ReworkDispositionRequest request){return protectCost(jwt,service.disposeRework(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id,request));}
    @PostMapping("/{id}/operations/{operationId}/start") public ManufacturingDtos.WorkOrderView startOperation(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@PathVariable UUID operationId){return protectCost(jwt,service.startOperation(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id,operationId));}
    @PatchMapping("/{id}/operations/{operationId}/assign") public ManufacturingDtos.WorkOrderView assignOperation(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@PathVariable UUID operationId,@Valid @RequestBody ManufacturingDtos.AssignOperatorRequest request){return protectCost(jwt,service.assignOperation(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id,operationId,request));}
    @PostMapping("/{id}/operations/{operationId}/complete") public ManufacturingDtos.WorkOrderView completeOperation(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@PathVariable UUID operationId,@Valid @RequestBody ManufacturingDtos.CompleteOperationRequest request){return protectCost(jwt,service.completeOperation(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id,operationId,request));}
    @PostMapping("/{id}/pause") public ManufacturingDtos.WorkOrderView pause(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return protectCost(jwt,service.pause(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id));}
    @PostMapping("/{id}/resume") public ManufacturingDtos.WorkOrderView resume(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return protectCost(jwt,service.resume(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id));}
    @PostMapping("/{id}/cancel") public ManufacturingDtos.WorkOrderView cancel(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return protectCost(jwt,service.cancel(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id));}
    @PostMapping("/{id}/close") public ManufacturingDtos.WorkOrderView close(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return protectCost(jwt,service.close(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id));}
    private ManufacturingDtos.WorkOrderView protectCost(Jwt jwt,ManufacturingDtos.WorkOrderView view){return JwtRoleGate.hasAny(jwt, "OWNER", "ADMIN", "MANAGER", "COST_ANALYST")?view:view.withoutCostDetails();}
}
