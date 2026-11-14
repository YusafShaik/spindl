package si.spindl.imports;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/imports")
public class ImportController {
    private final CsvImportService service;
    public ImportController(CsvImportService service){this.service=service;}

    @PostMapping("/{resource}/preview")
    public CsvImportService.PreviewResult preview(@PathVariable String resource,@RequestParam("file") MultipartFile file) throws IOException{return service.preview(resource,file.getBytes());}

    @PostMapping("/{resource}/commit")
    public CsvImportService.CommitResult commit(@PathVariable String resource,@RequestHeader("Idempotency-Key") String idempotencyKey,@RequestParam("file") MultipartFile file,@AuthenticationPrincipal Jwt jwt) throws IOException{return service.commit(resource,idempotencyKey,file.getBytes(),UUID.fromString(jwt.getSubject()));}

    @GetMapping(value="/{resource}/export",produces="text/csv")
    public ResponseEntity<byte[]> export(@PathVariable String resource,@AuthenticationPrincipal Jwt jwt){
        String filename="spindl-"+resource.toLowerCase(java.util.Locale.ROOT)+".csv";
        byte[] csv=service.export(resource,UUID.fromString(jwt.getSubject())).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok().contentType(new MediaType("text","csv",java.nio.charset.StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename="+filename).body(csv);
    }
}
