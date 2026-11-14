package si.spindl.sales;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import si.spindl.sales.SalesDtos.CreateQuoteRequest;
import si.spindl.sales.SalesDtos.QuoteView;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/quotes")
public class SalesQuoteController {
    private final SalesService service;
    public SalesQuoteController(SalesService service){this.service=service;}
    @GetMapping public List<QuoteView> list(){return service.listQuotes();}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public QuoteView create(@Valid @RequestBody CreateQuoteRequest request){return service.createQuote(request);}
    @PostMapping("/{id}/send") public QuoteView send(@PathVariable UUID id){return service.sendQuote(id);}
    @PostMapping("/{id}/accept") public QuoteView accept(@PathVariable UUID id){return service.acceptQuote(id);}
    @PostMapping("/{id}/reject") public QuoteView reject(@PathVariable UUID id){return service.rejectQuote(id);}
    @PostMapping("/{id}/convert") public SalesDtos.SalesOrderView convert(@PathVariable UUID id,@Valid @RequestBody(required=false) SalesDtos.ConvertQuoteRequest request){return service.convertQuote(id,request);}
}
