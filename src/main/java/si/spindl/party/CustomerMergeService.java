package si.spindl.party;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.attachments.TenantAttachmentService;
import si.spindl.common.event.DomainAuditEvent;
import si.spindl.crm.LeadService;
import si.spindl.finance.InvoiceService;
import si.spindl.identity.TenantCustomFieldService;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.sales.SalesService;
import si.spindl.tenant.DevelopmentTenant;

import java.util.*;

@Service
@RequiredArgsConstructor
public class CustomerMergeService {
    private final CustomerRepository customers;
    private final TenantMembershipRepository memberships;
    private final SalesService salesService;
    private final InvoiceService invoiceService;
    private final LeadService leadService;
    private final TenantCustomFieldService customFieldService;
    private final TenantAttachmentService attachmentService;
    private final ApplicationEventPublisher eventPublisher;
    private final DevelopmentTenant tenant;

    @Transactional
    public MergeResult merge(UUID actorId, UUID sourceId, UUID targetId) {
        UUID tenantId = tenant.currentTenantId();
        String role = memberships.findActiveRole(tenantId, actorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Workspace membership is inactive"));
        if (!Set.of("OWNER", "ADMIN").contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only workspace owners and admins can merge customers");
        }
        if (sourceId.equals(targetId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose two different customer records");
        }
        List<UUID> lockOrder = List.of(sourceId, targetId).stream().sorted().toList();
        Map<UUID, CustomerEntity> locked = new HashMap<>();
        for (UUID id : lockOrder) {
            locked.put(id, customers.findForUpdate(tenantId, id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found")));
        }
        CustomerEntity source = locked.get(sourceId), target = locked.get(targetId);
        if (!source.isActive() || source.getMergedIntoCustomerId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This customer has already been archived or merged");
        }
        if (!target.isActive() || target.getMergedIntoCustomerId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Choose an active customer as the destination");
        }

        int quoteCount = salesService.reassignCustomerQuotes(tenantId, sourceId, target);
        int orderCount = salesService.reassignCustomerOrders(tenantId, sourceId, target);
        int invoiceCount = invoiceService.reassignCustomer(tenantId, sourceId, target);
        int leadCount = leadService.reassignConvertedCustomer(tenantId, sourceId, targetId);
        int customFieldCount = customFieldService.moveCustomerValues(tenantId, sourceId, targetId, actorId);
        int attachmentCount = attachmentService.moveCustomerAttachments(tenantId, sourceId, targetId);

        source.mergeInto(targetId);
        eventPublisher.publishEvent(new DomainAuditEvent(
                tenantId, actorId, "CUSTOMER_MERGED", "customer", sourceId,
                Map.of(
                        "mergedIntoCustomerId", targetId.toString(),
                        "quotesMoved", quoteCount,
                        "ordersMoved", orderCount,
                        "invoicesMoved", invoiceCount,
                        "leadsReassigned", leadCount,
                        "customFieldsMoved", customFieldCount,
                        "attachmentsMoved", attachmentCount
                )
        ));
        return new MergeResult(sourceId, targetId, quoteCount, orderCount, invoiceCount, leadCount, customFieldCount, attachmentCount);
    }

    public record MergeResult(UUID archivedCustomerId, UUID survivingCustomerId, int quotesMoved, int ordersMoved,
                              int invoicesMoved, int leadsReassigned, int customFieldsMoved, int attachmentsMoved) {}
}
