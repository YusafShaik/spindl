package si.spindl.pos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import java.util.List;

/** API contract for PosRefundService. Mapping to entities lives in the mapper, not here. */
public final class PosRefundDtos {
    private PosRefundDtos() {}

    public record RefundLineRequest(@NotNull UUID saleLineId,@Positive int quantity,@NotBlank @Pattern(regexp="(?i)RESTOCK|QUARANTINE|SCRAP") String disposition) {}

    public record RefundTenderRequest(@NotBlank @Pattern(regexp="(?i)CASH|CARD|UPI|OTHER") String method,@NotNull @DecimalMin("0.01") @Digits(integer=12,fraction=2) BigDecimal amount,@Size(max=120) String reference) {}

    public record RefundRequest(@NotBlank @Size(max=120) String idempotencyKey,@NotNull UUID sessionId,@NotBlank @Size(max=300) String reason,@NotEmpty List<@Valid RefundLineRequest> lines,@NotEmpty List<@Valid RefundTenderRequest> tenders) {}

    public record RefundLineView(String sku,String itemName,int quantity,String disposition,BigDecimal subtotal,BigDecimal taxTotal,BigDecimal total) {}

    public record RefundTenderView(String method,BigDecimal amount,String reference) {}

    public record RefundView(UUID id,UUID saleId,String receiptNumber,String refundNumber,String reason,BigDecimal subtotal,BigDecimal taxTotal,BigDecimal total,Instant createdAt,List<RefundLineView> lines,List<RefundTenderView> tenders) {}
}
