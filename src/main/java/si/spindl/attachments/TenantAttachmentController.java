package si.spindl.attachments;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import si.spindl.tenant.DevelopmentTenant;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/attachments")
public class TenantAttachmentController {
    private final TenantAttachmentService service;
    private final DevelopmentTenant tenant;
    public TenantAttachmentController(TenantAttachmentService service,DevelopmentTenant tenant){this.service=service;this.tenant=tenant;}

    @GetMapping("/{resource}/{recordId}")
    public List<TenantAttachmentService.AttachmentView> list(@PathVariable String resource,@PathVariable UUID recordId){return service.list(tenant.currentTenantId(),resource,recordId);}

    @PostMapping(value="/{resource}/{recordId}",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public TenantAttachmentService.AttachmentView upload(@AuthenticationPrincipal Jwt jwt,@PathVariable String resource,@PathVariable UUID recordId,
                                                           @RequestHeader(name="Idempotency-Key",required=false) String key,@RequestPart("file") MultipartFile file){
        return service.upload(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),resource,recordId,key,file);
    }

    @GetMapping("/{resource}/{recordId}/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable String resource,@PathVariable UUID recordId,@PathVariable UUID id){
        var file=service.download(tenant.currentTenantId(),resource,recordId,id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(file.mediaType())).contentLength(file.sizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(file.filename(),StandardCharsets.UTF_8).build().toString()).body(file.resource());
    }

    @DeleteMapping("/{resource}/{recordId}/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt,@PathVariable String resource,@PathVariable UUID recordId,@PathVariable UUID id){
        service.delete(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),resource,recordId,id);return ResponseEntity.noContent().build();
    }
}
