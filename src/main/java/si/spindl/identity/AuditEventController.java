package si.spindl.identity;

import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/audit-events")
public class AuditEventController {
    private final AuditEventService service;
    public AuditEventController(AuditEventService service){this.service=service;}
    @GetMapping public AuditEventService.EventPage list(@RequestParam(required=false)String eventType,@RequestParam(required=false)String subjectType,@RequestParam(required=false)UUID actorId,@RequestParam(required=false)UUID subjectId,@RequestParam(required=false)LocalDate from,@RequestParam(required=false)LocalDate to,@RequestParam(required=false)String q,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="50")int size){return service.search(eventType,subjectType,actorId,subjectId,from,to,q,page,size);}
    @GetMapping(value="/export",produces="text/csv") public String export(@RequestParam(required=false)String eventType,@RequestParam(required=false)String subjectType,@RequestParam(required=false)UUID actorId,@RequestParam(required=false)UUID subjectId,@RequestParam(required=false)LocalDate from,@RequestParam(required=false)LocalDate to,@RequestParam(required=false)String q){return service.export(eventType,subjectType,actorId,subjectId,from,to,q);}
}
