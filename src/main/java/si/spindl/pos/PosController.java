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
    @GetMapping("/settings") public PosDtos.PosSettingsView settings(){return service.settings();}
    @GetMapping("/registers") public List<PosDtos.RegisterView> registers(@AuthenticationPrincipal Jwt jwt){return service.registers(userId(jwt));}
    @GetMapping("/cashiers") public List<PosDtos.CashierView> cashiers(@AuthenticationPrincipal Jwt jwt,@RequestParam UUID warehouseId){return service.cashiers(userId(jwt),warehouseId);}
    @PostMapping("/registers") public PosDtos.RegisterView createRegister(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody PosDtos.CreateRegisterRequest request){return service.createRegister(userId(jwt),request);}
    @PatchMapping("/registers/{id}/cashier") public PosDtos.RegisterView assignCashier(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody PosDtos.AssignCashierRequest request){return service.assignCashier(userId(jwt),id,request);}
    @GetMapping("/sessions") public List<PosDtos.SessionView> sessions(@AuthenticationPrincipal Jwt jwt){return service.sessions(userId(jwt));}
    @PostMapping("/sessions") public PosDtos.SessionView open(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody PosDtos.OpenSessionRequest request){return service.open(userId(jwt),request);}
    @PostMapping("/sessions/{id}/close") public PosDtos.SessionView close(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody PosDtos.CloseSessionRequest request){return service.close(userId(jwt),id,request);}
    @GetMapping("/sales") public List<PosDtos.SaleView> allSales(@AuthenticationPrincipal Jwt jwt){return service.allSales(userId(jwt));}
    @GetMapping("/sessions/{id}/sales") public List<PosDtos.SaleView> sales(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.sales(userId(jwt),id);}
    @PostMapping("/sessions/{id}/checkout") public PosDtos.SaleView checkout(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody PosDtos.CheckoutRequest request){return service.checkout(userId(jwt),id,request);}
    @PostMapping("/sales/{id}/void") public PosDtos.SaleView voidSale(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody PosDtos.VoidSaleRequest request){return service.voidSale(userId(jwt),id,request);}
    @GetMapping("/sales/{id}/refunds") public List<PosRefundDtos.RefundView> refunds(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return refunds.list(userId(jwt),id);}
    @PostMapping("/sales/{id}/refunds") public PosRefundDtos.RefundView refund(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody PosRefundDtos.RefundRequest request){return refunds.refund(userId(jwt),id,request);}
    private UUID userId(Jwt jwt){return AuthenticatedActor.userId(jwt);}
}
