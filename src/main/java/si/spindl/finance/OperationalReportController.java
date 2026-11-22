package si.spindl.finance;

import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class OperationalReportController {
    private final OperationalReportService reports;
    private final MarginReportService margins;
    public OperationalReportController(OperationalReportService reports,MarginReportService margins){this.reports=reports;this.margins=margins;}
    @GetMapping("/receivables") public List<OperationalReportDtos.AgingRow> receivables(@RequestParam(required=false)LocalDate dueFrom,@RequestParam(required=false)LocalDate dueTo){return reports.receivables(dueFrom,dueTo);}
    @GetMapping("/payables") public List<OperationalReportDtos.AgingRow> payables(@RequestParam(required=false)LocalDate dueFrom,@RequestParam(required=false)LocalDate dueTo){return reports.payables(dueFrom,dueTo);}
    @GetMapping(value="/receivables/export",produces="text/csv") @ResponseBody public String exportReceivables(@RequestParam(required=false)LocalDate dueFrom,@RequestParam(required=false)LocalDate dueTo){return reports.exportReceivables(dueFrom,dueTo);}
    @GetMapping(value="/payables/export",produces="text/csv") @ResponseBody public String exportPayables(@RequestParam(required=false)LocalDate dueFrom,@RequestParam(required=false)LocalDate dueTo){return reports.exportPayables(dueFrom,dueTo);}
    @GetMapping("/margins") public MarginReportDtos.MarginReport margins(@RequestParam(required=false)LocalDate from,@RequestParam(required=false)LocalDate to){return margins.report(from,to);}
    @GetMapping(value="/margins/export",produces="text/csv") @ResponseBody public String exportMargins(@RequestParam(required=false)LocalDate from,@RequestParam(required=false)LocalDate to){return margins.export(from,to);}
    @GetMapping("/inventory-valuation") public MarginReportDtos.ValuationReport inventoryValuation(){return margins.inventoryValuation();}
    @GetMapping(value="/inventory-valuation/export",produces="text/csv") @ResponseBody public String exportInventoryValuation(){return margins.exportInventoryValuation();}
}
