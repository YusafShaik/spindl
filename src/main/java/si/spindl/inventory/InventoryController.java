package si.spindl.inventory;

import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {
    private final InventoryAdjustmentService service;
    private final InventoryCycleCountService cycleCounts;
    private final InventoryWarehouseService warehouseService;

    @GetMapping("/movements")
    public List<InventoryAdjustmentService.MovementView> movements(){return service.recentMovements();}
    @GetMapping("/movements/search")
    public InventoryAdjustmentService.MovementSearchPage searchMovements(@RequestParam(required=false) UUID itemId,@RequestParam(required=false) java.time.LocalDate from,@RequestParam(required=false) java.time.LocalDate to,@RequestParam(required=false) String q,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.searchMovements(itemId,from,to,q,page,size);}
    @GetMapping(value="/movements/export", produces="text/csv")
    public ResponseEntity<byte[]> exportMovements(@RequestParam(required=false) UUID itemId,@RequestParam(required=false) java.time.LocalDate from,@RequestParam(required=false) java.time.LocalDate to,@RequestParam(required=false) String q){
        byte[] csv=service.exportMovements(itemId,from,to,q).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok().contentType(new MediaType("text","csv",java.nio.charset.StandardCharsets.UTF_8)).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=spindl-inventory-movements.csv").body(csv);
    }
    @GetMapping("/warehouses") public List<InventoryWarehouseService.WarehouseView> warehouses(){return warehouseService.list();}
    @GetMapping("/transfers") public List<InventoryWarehouseService.TransferView> transfers(){return warehouseService.transfers();}
    @PostMapping("/warehouses") @ResponseStatus(HttpStatus.CREATED) public InventoryWarehouseService.WarehouseView createWarehouse(@Valid @RequestBody InventoryWarehouseService.CreateWarehouseRequest request){return warehouseService.create(request);}
    @GetMapping("/warehouses/{id}/stock") public List<InventoryWarehouseService.WarehouseStockView> warehouseStock(@PathVariable UUID id){return warehouseService.balances(id);}
    @PostMapping("/transfers") @ResponseStatus(HttpStatus.CREATED) public InventoryWarehouseService.TransferView transfer(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody InventoryWarehouseService.TransferRequest request){return warehouseService.transfer(request,UUID.fromString(jwt.getSubject()));}
    @PostMapping("/transfers/{id}/approve") public InventoryWarehouseService.TransferView approveTransfer(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return warehouseService.approve(id,UUID.fromString(jwt.getSubject()));}
    @PostMapping("/transfers/{id}/dispatch") public InventoryWarehouseService.TransferView dispatchTransfer(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return warehouseService.dispatch(id,UUID.fromString(jwt.getSubject()));}
    @PostMapping("/transfers/{id}/receive") public InventoryWarehouseService.TransferView receiveTransfer(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return warehouseService.receive(id,UUID.fromString(jwt.getSubject()));}
    @PostMapping("/transfers/{id}/cancel") public InventoryWarehouseService.TransferView cancelTransfer(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return warehouseService.cancel(id,UUID.fromString(jwt.getSubject()));}

    @PostMapping("/adjustments")
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryAdjustmentService.MovementView adjust(@Valid @RequestBody InventoryAdjustmentService.AdjustmentRequest request){return service.adjust(request);}

    @GetMapping("/cycle-counts") public java.util.List<InventoryCycleCountService.CycleCountView> cycleCounts(@AuthenticationPrincipal Jwt jwt){return cycleCounts.list(UUID.fromString(jwt.getSubject()));}
    @PostMapping("/cycle-counts") @ResponseStatus(HttpStatus.CREATED) public InventoryCycleCountService.CycleCountView createCycleCount(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody InventoryCycleCountService.CreateCycleCountRequest request){return cycleCounts.create(UUID.fromString(jwt.getSubject()),request);}
    @PatchMapping("/cycle-counts/{id}/lines/{lineId}") public InventoryCycleCountService.CycleCountView recordCount(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@PathVariable UUID lineId,@Valid @RequestBody InventoryCycleCountService.RecordCountRequest request){return cycleCounts.record(UUID.fromString(jwt.getSubject()),id,lineId,request);}
    @PostMapping("/cycle-counts/{id}/submit") public InventoryCycleCountService.CycleCountView submitCycleCount(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return cycleCounts.submit(UUID.fromString(jwt.getSubject()),id);}
    @PostMapping("/cycle-counts/{id}/approve") public InventoryCycleCountService.CycleCountView approveCycleCount(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return cycleCounts.approve(UUID.fromString(jwt.getSubject()),id);}
    @PostMapping("/cycle-counts/{id}/cancel") public InventoryCycleCountService.CycleCountView cancelCycleCount(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return cycleCounts.cancel(UUID.fromString(jwt.getSubject()),id);}
}
