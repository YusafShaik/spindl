package si.spindl.crm;

import jakarta.validation.Valid;
import si.spindl.sales.SalesDtos.QuoteLineRequest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import java.util.List;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.FutureOrPresent;

/** API contract for LeadService. Mapping to entities lives in the mapper, not here. */
public final class LeadDtos {
    private LeadDtos() {}

    public record CreateLeadRequest(@NotBlank @Size(max=180) String name,@Size(max=180) String company,@Email @Size(max=254) String email,@Size(max=40) String phone,@Size(max=80) String source,UUID ownerUserId,@DecimalMin("0.00") BigDecimal expectedValue,@Size(max=180) String nextActivityTitle,Instant nextActivityAt,UUID branchId) {}

    public record StageRequest(@NotBlank String stage) {}

    public record CreateActivityRequest(@NotBlank String activityType,@NotBlank @Size(max=2000) String body,@FutureOrPresent Instant dueAt) {}

    public record ConvertLeadRequest(@FutureOrPresent LocalDate quoteValidUntil,@Size(max=1000) String quoteNotes,List<@Valid QuoteLineRequest> quoteLines) {}

    public record ActivityView(UUID id,String activityType,String body,Instant dueAt,Instant completedAt,Instant createdAt,UUID actorUserId) {}

    public record LeadView(UUID id,String name,String company,String email,String phone,String source,String stage,UUID ownerUserId,UUID branchId,BigDecimal expectedValue,String nextActivityTitle,Instant nextActivityAt,UUID convertedCustomerId,Instant createdAt,Instant updatedAt,List<ActivityView> activities) {}

    public record LeadConversionView(UUID leadId,UUID customerId,String customerName,boolean customerCreated,UUID quoteId,String quoteNumber) {}
}
