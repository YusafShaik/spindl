package si.spindl.pos;

import si.spindl.common.security.AuthenticatedActor;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/pos")
public class PosController {
    private final PosService service;
    private final PosRefundService refunds;
    public PosController(PosService service,PosRefundService refunds){this.service=service;this.refunds=refunds;}
    @GetMapping("/settings") public PosService.PosSettingsView settings(){return service.settings();}
    @GetMapping("/registers") public List<PosService.RegisterView> registers(@AuthenticationPrincipal Jwt jwt){return service.registers(userId(jwt));}
    @GetMapping("/cashiers") public List<PosService.CashierView> cashiers(@AuthenticationPrincipal Jwt jwt,@RequestParam UUID warehouseId){return service.cashiers(userId(jwt),warehouseId);}
    @PostMapping("/registers") public PosService.RegisterView createRegister(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody PosService.CreateRegisterRequest request){return service.createRegister(userId(jwt),request);}
    @PatchMapping("/registers/{id}/cashier") public PosService.RegisterView assignCashier(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody PosService.AssignCashierRequest request){return service.assignCashier(userId(jwt),id,request);}
    @GetMapping("/sessions") public List<PosService.SessionView> sessions(@AuthenticationPrincipal Jwt jwt){return service.sessions(userId(jwt));}
    @PostMapping("/sessions") public PosService.SessionView open(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody PosService.OpenSessionRequest request){return service.open(userId(jwt),request);}
    @PostMapping("/sessions/{id}/close") public PosService.SessionView close(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody PosService.CloseSessionRequest request){return service.close(userId(jwt),id,request);}
    @GetMapping("/sales") public List<PosService.SaleView> allSales(@AuthenticationPrincipal Jwt jwt){return service.allSales(userId(jwt));}
    @GetMapping("/sessions/{id}/sales") public List<PosService.SaleView> sales(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.sales(userId(jwt),id);}
    @PostMapping("/sessions/{id}/checkout") public PosService.SaleView checkout(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody PosService.CheckoutRequest request){return service.checkout(userId(jwt),id,request);}
    @PostMapping("/sales/{id}/void") public PosService.SaleView voidSale(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody PosService.VoidSaleRequest request){return service.voidSale(userId(jwt),id,request);}
    @GetMapping("/sales/{id}/refunds") public List<PosRefundService.RefundView> refunds(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return refunds.list(userId(jwt),id);}
    @PostMapping("/sales/{id}/refunds") public PosRefundService.RefundView refund(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody PosRefundService.RefundRequest request){return refunds.refund(userId(jwt),id,request);}
    private UUID userId(Jwt jwt){return AuthenticatedActor.userId(jwt);}
}
