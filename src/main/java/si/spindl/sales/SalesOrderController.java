package si.spindl.sales;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import si.spindl.sales.SalesDtos.DispatchRequest;
import si.spindl.sales.SalesDtos.SalesOrderView;
import si.spindl.sales.SalesDtos.ShipmentView;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sales-orders")
public class SalesOrderController {
    private final SalesService service;
    public SalesOrderController(SalesService service){this.service=service;}
    @GetMapping public List<SalesOrderView> list(){return service.listOrders();}
    @PostMapping("/{id}/dispatch") public ShipmentView dispatch(@PathVariable UUID id,@Valid @RequestBody DispatchRequest request){return service.dispatch(id,request);}
}
