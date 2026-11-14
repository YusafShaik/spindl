package si.spindl.crm;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController @RequestMapping("/api/leads")
public class LeadController {
    private final LeadService service;
    public LeadController(LeadService service){this.service=service;}
    @GetMapping public List<LeadService.LeadView> list(@AuthenticationPrincipal Jwt jwt){return service.list(UUID.fromString(jwt.getSubject()));}
    @GetMapping("/{id}") public LeadService.LeadView get(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.get(UUID.fromString(jwt.getSubject()),id);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public LeadService.LeadView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody LeadService.CreateLeadRequest request){return service.create(UUID.fromString(jwt.getSubject()),request);}
    @PatchMapping("/{id}/stage") public LeadService.LeadView stage(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody LeadService.StageRequest request){return service.stage(UUID.fromString(jwt.getSubject()),id,request);}
    @PostMapping("/{id}/activities") public LeadService.LeadView activity(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody LeadService.CreateActivityRequest request){return service.addActivity(UUID.fromString(jwt.getSubject()),id,request);}
    @PostMapping("/{id}/convert") public LeadService.LeadConversionView convert(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody LeadService.ConvertLeadRequest request){return service.convert(UUID.fromString(jwt.getSubject()),id,request);}
}
