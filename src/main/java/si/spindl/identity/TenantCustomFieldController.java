package si.spindl.identity;

import si.spindl.common.security.AuthenticatedActor;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.CurrentTenant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import tools.jackson.databind.JsonNode;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

@RestController
@RequestMapping("/api/custom-fields")
public class TenantCustomFieldController {
    private final TenantCustomFieldService service;
    private final CustomFieldCsvImportService imports;
    private final CurrentTenant tenant;
    public TenantCustomFieldController(TenantCustomFieldService service,CustomFieldCsvImportService imports,CurrentTenant tenant){this.service=service;this.imports=imports;this.tenant=tenant;}

    @GetMapping
    public List<TenantCustomFieldService.FieldView> list(@RequestParam String resource){return service.list(tenant.currentTenantId(),resource);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public TenantCustomFieldService.FieldView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody TenantCustomFieldService.CreateFieldRequest request){
        return service.create(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),request);
    }
    @PostMapping("/{id}/publish")
    public TenantCustomFieldService.FieldView publish(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){
        return service.publish(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id);
    }
    @GetMapping("/{resource}/{recordId}")
    public Map<String,JsonNode> values(@PathVariable String resource,@PathVariable UUID recordId){return service.getValues(tenant.currentTenantId(),resource,recordId);}
    @PutMapping("/{resource}/{recordId}")
    public Map<String,JsonNode> putValues(@AuthenticationPrincipal Jwt jwt,@PathVariable String resource,@PathVariable UUID recordId,
                                          @Valid @RequestBody TenantCustomFieldService.PutValuesRequest request){
        return service.putValues(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),resource,recordId,request);
    }

    @PostMapping(value="/{resource}/import/preview",consumes="multipart/form-data")
    public CustomFieldCsvImportService.Preview previewImport(@PathVariable String resource,@RequestParam("file") MultipartFile file)throws IOException{return imports.preview(resource,file.getBytes());}

    @PostMapping(value="/{resource}/import/commit",consumes="multipart/form-data")
    public CustomFieldCsvImportService.CommitResult commitImport(@AuthenticationPrincipal Jwt jwt,@PathVariable String resource,
            @RequestHeader("Idempotency-Key") String key,@RequestParam("file") MultipartFile file)throws IOException{return imports.commit(resource,key,file.getBytes(),AuthenticatedActor.userId(jwt));}
}
