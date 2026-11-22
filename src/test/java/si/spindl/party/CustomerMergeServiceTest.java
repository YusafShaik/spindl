package si.spindl.party;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.attachments.TenantAttachmentService;
import si.spindl.common.event.DomainAuditEvent;
import si.spindl.crm.LeadService;
import si.spindl.finance.InvoiceService;
import si.spindl.identity.TenantCustomFieldService;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.sales.SalesService;
import si.spindl.tenant.CurrentTenant;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomerMergeServiceTest {

    @Mock private CustomerRepository customers;
    @Mock private TenantMembershipRepository memberships;
    @Mock private SalesService salesService;
    @Mock private InvoiceService invoiceService;
    @Mock private LeadService leadService;
    @Mock private TenantCustomFieldService customFieldService;
    @Mock private TenantAttachmentService attachmentService;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private CurrentTenant tenant;

    private CustomerMergeService mergeService;
    private final UUID tenantId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        when(tenant.currentTenantId()).thenReturn(tenantId);
        mergeService = new CustomerMergeService(
                customers, memberships, salesService, invoiceService, leadService,
                customFieldService, attachmentService, eventPublisher, tenant
        );
    }

    @Test
    void rejectsMergeWhenNotAdmin() {
        UUID sourceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        when(memberships.findActiveRole(tenantId, actorId)).thenReturn(Optional.of("VIEWER"));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                mergeService.merge(actorId, sourceId, targetId)
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void rejectsMergeWithSameId() {
        UUID id = UUID.randomUUID();
        when(memberships.findActiveRole(tenantId, actorId)).thenReturn(Optional.of("ADMIN"));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                mergeService.merge(actorId, id, id)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void successfulMergeDelegatesToServicesAndPublishesEvent() {
        UUID sourceId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        when(memberships.findActiveRole(tenantId, actorId)).thenReturn(Optional.of("ADMIN"));

        CustomerEntity source = new CustomerEntity(tenantId, "CUST-A", "Source Corp", "a@test.com", "Active", actorId);
        CustomerEntity target = new CustomerEntity(tenantId, "CUST-B", "Target Corp", "b@test.com", "Active", actorId);

        when(customers.findForUpdate(tenantId, sourceId)).thenReturn(Optional.of(source));
        when(customers.findForUpdate(tenantId, targetId)).thenReturn(Optional.of(target));
        when(salesService.reassignCustomerQuotes(tenantId, sourceId, target)).thenReturn(2);
        when(salesService.reassignCustomerOrders(tenantId, sourceId, target)).thenReturn(3);
        when(invoiceService.reassignCustomer(tenantId, sourceId, target)).thenReturn(4);
        when(leadService.reassignConvertedCustomer(tenantId, sourceId, targetId)).thenReturn(1);
        when(customFieldService.moveCustomerValues(tenantId, sourceId, targetId, actorId)).thenReturn(5);
        when(attachmentService.moveCustomerAttachments(tenantId, sourceId, targetId)).thenReturn(6);

        CustomerMergeDtos.MergeResult result = mergeService.merge(actorId, sourceId, targetId);

        assertEquals(sourceId, result.archivedCustomerId());
        assertEquals(targetId, result.survivingCustomerId());
        assertEquals(2, result.quotesMoved());
        assertEquals(3, result.ordersMoved());
        assertEquals(4, result.invoicesMoved());
        assertEquals(1, result.leadsReassigned());
        assertEquals(5, result.customFieldsMoved());
        assertEquals(6, result.attachmentsMoved());

        verify(eventPublisher).publishEvent(any(DomainAuditEvent.class));
    }
}
