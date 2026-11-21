package si.spindl.quality;

import si.spindl.common.security.AuthenticatedActor;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController @RequestMapping("/api/quality")
public class QualityController {
    private final QualityService service;
    public QualityController(QualityService service){this.service=service;}
    @GetMapping("/items") public List<QualityService.ItemQualityView> items(){return service.items();}
    @PatchMapping("/items/{id}/inspection-required") public QualityService.ItemQualityView setInspectionRequired(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@RequestBody @Valid QualityService.SetInspectionRequest request){return service.setInspectionRequired(AuthenticatedActor.userId(jwt),id,request);}
    @GetMapping("/lots") public List<QualityService.QualityLotView> lots(){return service.lots();}
    @PostMapping("/lots/{id}/inspections") public QualityService.QualityLotView inspect(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@RequestBody @Valid QualityService.InspectRequest request){return service.inspect(AuthenticatedActor.userId(jwt),id,request);}
}
