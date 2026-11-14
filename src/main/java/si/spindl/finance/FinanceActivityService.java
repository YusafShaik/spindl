package si.spindl.finance;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.tenant.DevelopmentTenant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class FinanceActivityService {
    private static final Set<String> TYPES=Set.of("SALES_INVOICE","CUSTOMER_PAYMENT","CUSTOMER_CREDIT","CUSTOMER_REFUND","SUPPLIER_BILL","SUPPLIER_PAYMENT","SUPPLIER_CREDIT");
    private final FinanceActivityRepository activities;
    private final DevelopmentTenant tenant;
    public FinanceActivityService(FinanceActivityRepository activities,DevelopmentTenant tenant){this.activities=activities;this.tenant=tenant;}

    @Transactional(readOnly=true)
    public List<ActivityView> list(String requestedType,LocalDate from,LocalDate to){
        if(from!=null&&to!=null&&from.isAfter(to))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"From date must be on or before the to date");
        String type=requestedType==null||requestedType.isBlank()?"ALL":requestedType.trim().toUpperCase(Locale.ROOT);
        if(!type.equals("ALL")&&!TYPES.contains(type))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unsupported transaction type");
        ZoneId zone=ZoneId.systemDefault();
        java.time.Instant start=from==null?null:from.atStartOfDay(zone).toInstant();
        java.time.Instant endExclusive=to==null?null:to.plusDays(1).atStartOfDay(zone).toInstant();
        return activities.findRecentByTenantId(tenant.currentTenantId()).stream()
                .filter(row->type.equals("ALL")||type.equals(row.getType()))
                .filter(row->start==null||!row.getOccurredAt().isBefore(start))
                .filter(row->endExclusive==null||row.getOccurredAt().isBefore(endExclusive))
                .map(ActivityView::from).toList();
    }

    public record ActivityView(UUID id,String type,String reference,String counterparty,java.time.Instant occurredAt,BigDecimal amount,String status,String method,String direction){
        static ActivityView from(FinanceActivityRow row){return new ActivityView(row.getId(),row.getType(),row.getReference(),row.getCounterparty(),row.getOccurredAt(),row.getAmount(),row.getStatus(),row.getMethod(),row.getDirection());}
    }
}
