package si.spindl.pos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Digits;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import java.util.List;
import jakarta.validation.constraints.DecimalMax;

/** API contract for PosService. Mapping to entities lives in the mapper, not here. */
public final class PosDtos {
    private PosDtos() {}

    public record CreateRegisterRequest(@NotNull UUID warehouseId,@NotNull UUID cashierUserId,@NotBlank @Size(max=32) String code,@NotBlank @Size(max=120) String name) {}

    public record AssignCashierRequest(@NotNull UUID cashierUserId) {}

    public record OpenSessionRequest(@NotNull UUID registerId,@NotNull @DecimalMin("0.00") @Digits(integer=12,fraction=2) BigDecimal openingFloat) {}

    public record CloseSessionRequest(@NotNull @DecimalMin("0.00") @Digits(integer=12,fraction=2) BigDecimal countedCash) {}

    public record CheckoutLineRequest(@NotNull UUID itemId,@Positive int quantity,@jakarta.validation.constraints.DecimalMin("0.00") @Digits(integer=12,fraction=2) BigDecimal unitPriceOverride,@jakarta.validation.constraints.DecimalMin("0.00") @jakarta.validation.constraints.DecimalMax("99.99") @Digits(integer=3,fraction=2) BigDecimal discountPercent) {}

    public record TenderRequest(@NotBlank @Pattern(regexp="(?i)CASH|CARD|UPI|OTHER") String method,@NotNull @DecimalMin(value="0.01") @Digits(integer=12,fraction=2) BigDecimal amount,@Size(max=120) String reference) {}

    public record VoidSaleRequest(@NotBlank @Size(max=120) String idempotencyKey,@NotBlank @Size(max=300) String reason) {}

    public record CheckoutRequest(@NotBlank @Size(max=120) String idempotencyKey,UUID customerId,@NotEmpty List<@Valid CheckoutLineRequest> lines,@NotEmpty List<@Valid TenderRequest> tenders) {}

    public record CashierView(UUID userId,String name,String email,String role) {}

    public record RegisterView(UUID id,String code,String name,UUID warehouseId,String warehouseCode,String warehouseName,UUID branchId,UUID assignedCashierUserId) {}

    public record SessionView(UUID id,String status,BigDecimal openingFloat,BigDecimal expectedCash,BigDecimal countedCash,BigDecimal cashVariance,Instant openedAt,Instant closedAt,UUID cashierUserId,UUID registerId,String registerCode,String registerName,UUID branchId,String warehouseName) {}

    public record SaleLineView(UUID saleLineId,String sku,String itemName,int quantity,int refundedQuantity,int refundableQuantity,BigDecimal refundedSubtotal,BigDecimal refundedTaxTotal,BigDecimal listUnitPrice,BigDecimal discountPercent,BigDecimal unitPrice,BigDecimal subtotal,BigDecimal taxTotal,BigDecimal total) {}

    public record TenderView(String method,BigDecimal amount,String reference) {}

    public record PosSettingsView(String taxCode,BigDecimal taxRate) {}

    public record SaleView(UUID id,UUID sessionId,String receiptNumber,String status,UUID customerId,BigDecimal subtotal,String taxCode,BigDecimal taxRate,BigDecimal taxTotal,BigDecimal total,BigDecimal refundedTotal,Instant postedAt,List<SaleLineView> lines,List<TenderView> tenders) {}
}
