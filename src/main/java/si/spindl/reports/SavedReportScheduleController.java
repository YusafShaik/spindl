package si.spindl.reports;

import si.spindl.common.security.AuthenticatedActor;
import si.spindl.common.security.JwtRoleGate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@RestController @RequestMapping("/api/report-builder/schedules")
public class SavedReportScheduleController {
    private final SavedReportScheduleService service;
    public SavedReportScheduleController(SavedReportScheduleService service){this.service=service;}
    @GetMapping public List<SavedReportScheduleService.ScheduleView> list(@AuthenticationPrincipal Jwt jwt){configure(jwt);return service.list();}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public SavedReportScheduleService.ScheduleView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody ScheduleRequest request){configure(jwt);return service.create(actor(jwt),new SavedReportScheduleService.CreateRequest(request.reportId(),request.frequency(),request.runAt(),request.weekDay(),request.monthDay(),request.timezone()));}
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void disable(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){configure(jwt);service.disable(actor(jwt),id);}
    @GetMapping("/{id}/runs") public List<SavedReportScheduleService.RunView> history(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){configure(jwt);return service.history(id);}
    private UUID actor(Jwt jwt){return AuthenticatedActor.userId(jwt);}
    private void configure(Jwt jwt){JwtRoleGate.requireAny(jwt, "Only workspace administrators and managers can manage scheduled reports", "OWNER", "ADMIN", "MANAGER");}
    public record ScheduleRequest(@NotNull UUID reportId,@NotBlank String frequency,@NotNull LocalTime runAt,Integer weekDay,Integer monthDay,@NotBlank String timezone){}
}
