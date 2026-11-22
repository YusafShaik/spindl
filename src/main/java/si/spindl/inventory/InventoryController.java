package si.spindl.inventory;

import si.spindl.common.security.AuthenticatedActor;

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
    public List<InventoryAdjustmentDtos.MovementView> movements(){return service.recentMovements();}
    @GetMapping("/movements/search")
    public InventoryAdjustmentDtos.MovementSearchPage searchMovements(@RequestParam(required=false) UUID itemId,@RequestParam(required=false) java.time.LocalDate from,@RequestParam(required=false) java.time.LocalDate to,@RequestParam(required=false) String q,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.searchMovements(itemId,from,to,q,page,size);}
    @GetMapping(value="/movements/export", produces="text/csv")
    public ResponseEntity<byte[]> exportMovements(@RequestParam(required=false) UUID itemId,@RequestParam(required=false) java.time.LocalDate from,@RequestParam(required=false) java.time.LocalDate to,@RequestParam(required=false) String q){
        byte[] csv=service.exportMovements(itemId,from,to,q).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok().contentType(new MediaType("text","csv",java.nio.charset.StandardCharsets.UTF_8)).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=spindl-inventory-movements.csv").body(csv);
    }
    @GetMapping("/warehouses") public List<InventoryWarehouseDtos.WarehouseView> warehouses(){return warehouseService.list();}
    @GetMapping("/transfers") public List<InventoryWarehouseDtos.TransferView> transfers(){return warehouseService.transfers();}
    @PostMapping("/warehouses") @ResponseStatus(HttpStatus.CREATED) public InventoryWarehouseDtos.WarehouseView createWarehouse(@Valid @RequestBody InventoryWarehouseDtos.CreateWarehouseRequest request){return warehouseService.create(request);}
    @GetMapping("/warehouses/{id}/stock") public List<InventoryWarehouseDtos.WarehouseStockView> warehouseStock(@PathVariable UUID id){return warehouseService.balances(id);}
    @PostMapping("/transfers") @ResponseStatus(HttpStatus.CREATED) public InventoryWarehouseDtos.TransferView transfer(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody InventoryWarehouseDtos.TransferRequest request){return warehouseService.transfer(request,AuthenticatedActor.userId(jwt));}
    @PostMapping("/transfers/{id}/approve") public InventoryWarehouseDtos.TransferView approveTransfer(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return warehouseService.approve(id,AuthenticatedActor.userId(jwt));}
    @PostMapping("/transfers/{id}/dispatch") public InventoryWarehouseDtos.TransferView dispatchTransfer(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return warehouseService.dispatch(id,AuthenticatedActor.userId(jwt));}
    @PostMapping("/transfers/{id}/receive") public InventoryWarehouseDtos.TransferView receiveTransfer(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return warehouseService.receive(id,AuthenticatedActor.userId(jwt));}
    @PostMapping("/transfers/{id}/cancel") public InventoryWarehouseDtos.TransferView cancelTransfer(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return warehouseService.cancel(id,AuthenticatedActor.userId(jwt));}

    @PostMapping("/adjustments")
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryAdjustmentDtos.MovementView adjust(@Valid @RequestBody InventoryAdjustmentDtos.AdjustmentRequest request){return service.adjust(request);}

    @GetMapping("/cycle-counts") public java.util.List<InventoryCycleCountDtos.CycleCountView> cycleCounts(@AuthenticationPrincipal Jwt jwt){return cycleCounts.list(AuthenticatedActor.userId(jwt));}
    @PostMapping("/cycle-counts") @ResponseStatus(HttpStatus.CREATED) public InventoryCycleCountDtos.CycleCountView createCycleCount(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody InventoryCycleCountDtos.CreateCycleCountRequest request){return cycleCounts.create(AuthenticatedActor.userId(jwt),request);}
    @PatchMapping("/cycle-counts/{id}/lines/{lineId}") public InventoryCycleCountDtos.CycleCountView recordCount(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@PathVariable UUID lineId,@Valid @RequestBody InventoryCycleCountDtos.RecordCountRequest request){return cycleCounts.record(AuthenticatedActor.userId(jwt),id,lineId,request);}
    @PostMapping("/cycle-counts/{id}/submit") public InventoryCycleCountDtos.CycleCountView submitCycleCount(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return cycleCounts.submit(AuthenticatedActor.userId(jwt),id);}
    @PostMapping("/cycle-counts/{id}/approve") public InventoryCycleCountDtos.CycleCountView approveCycleCount(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return cycleCounts.approve(AuthenticatedActor.userId(jwt),id);}
    @PostMapping("/cycle-counts/{id}/cancel") public InventoryCycleCountDtos.CycleCountView cancelCycleCount(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return cycleCounts.cancel(AuthenticatedActor.userId(jwt),id);}
}
