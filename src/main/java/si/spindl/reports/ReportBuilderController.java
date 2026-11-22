package si.spindl.reports;

import si.spindl.common.security.AuthenticatedActor;
import si.spindl.common.security.JwtRoleGate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.CurrentTenant;
import java.util.List;
import java.util.UUID;

@RestController @RequestMapping("/api/report-builder")
public class ReportBuilderController {
    private final ReportBuilderService service;private final CurrentTenant tenant;
    public ReportBuilderController(ReportBuilderService service,CurrentTenant tenant){this.service=service;this.tenant=tenant;}
    @GetMapping("/sources") public List<ReportBuilderDtos.SourceView> sources(){return service.sources();}
    @GetMapping("/definitions") public List<ReportBuilderDtos.ReportView> list(){return service.list();}
    @PostMapping("/definitions") @ResponseStatus(HttpStatus.CREATED) public ReportBuilderDtos.ReportView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody CreateReportRequest request){requireConfigurator(jwt);List<ReportBuilderDtos.ReportFilter> filters=request.filters()==null?List.of():request.filters().stream().map(filter->new ReportBuilderDtos.ReportFilter(filter.field(),filter.operator(),filter.value())).toList();List<ReportBuilderDtos.ReportMetricInput> metrics=request.metrics()==null?List.of():request.metrics().stream().map(metric->new ReportBuilderDtos.ReportMetricInput(metric.function(),metric.field())).toList();return service.create(AuthenticatedActor.userId(jwt),new ReportBuilderDtos.CreateRequest(request.name(),request.dataSource(),request.columns(),filters,request.groupBy(),metrics));}
    @DeleteMapping("/definitions/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){requireConfigurator(jwt);service.delete(AuthenticatedActor.userId(jwt),id);}
    @GetMapping("/definitions/{id}/run") public ReportBuilderDtos.RunResult run(@PathVariable UUID id,@RequestParam(required=false) String q,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size){return service.run(id,q,page,size);}
    private void requireConfigurator(Jwt jwt){JwtRoleGate.requireAny(jwt, "Only workspace administrators and managers can manage saved reports", "OWNER", "ADMIN", "MANAGER");}
    public record CreateReportRequest(@NotBlank @Size(max=120) String name,@NotBlank @Size(max=32) String dataSource,@NotEmpty @Size(max=12) List<@NotBlank String> columns,@Size(max=8) List<@Valid ReportFilterRequest> filters,@Size(max=64) String groupBy,@Size(max=4) List<@Valid ReportMetricRequest> metrics){}
    public record ReportFilterRequest(@NotBlank String field,@NotBlank String operator,@NotBlank @Size(max=120) String value){}
    public record ReportMetricRequest(@NotBlank String function,@NotBlank String field){}
}
