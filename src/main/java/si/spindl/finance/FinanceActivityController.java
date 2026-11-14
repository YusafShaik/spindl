package si.spindl.finance;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/transactions")
public class FinanceActivityController {
    private final FinanceActivityService service;
    public FinanceActivityController(FinanceActivityService service){this.service=service;}
    @GetMapping
    public List<FinanceActivityService.ActivityView> list(@RequestParam(defaultValue="ALL") String type,
             @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
             @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to){return service.list(type,from,to);}
}
