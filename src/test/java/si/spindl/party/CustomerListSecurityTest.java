package si.spindl.party;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import si.spindl.common.exception.ForbiddenException;
import si.spindl.common.presentation.TenantCurrency;
import si.spindl.finance.InvoiceRepository;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.identity.TenantRolePermissionRepository;
import si.spindl.sales.SalesOrderRepository;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerListSecurityTest {

    @Mock private CustomerRepository customers;
    @Mock private SalesOrderRepository orders;
    @Mock private InvoiceRepository invoices;
    @Mock private TenantMembershipRepository memberships;
    @Mock private TenantRolePermissionRepository permissions;
    @Mock private ApplicationEventPublisher events;
    @Mock private TenantCurrency currency;

    private CustomerService service;

    @BeforeEach
    void setUp() {
        service = new CustomerService(customers, orders, invoices, memberships, permissions, events, currency);
    }

    @Test
    void listWithoutMembershipIsForbidden() {
        UUID tenantId = UUID.randomUUID();
        UUID actor = UUID.randomUUID();
        when(memberships.findActiveRole(tenantId, actor)).thenReturn(Optional.empty());

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> service.list(tenantId, actor, null, null));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }
}
