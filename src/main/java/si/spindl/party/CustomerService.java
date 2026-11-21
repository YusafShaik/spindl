package si.spindl.party;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.common.event.DomainAuditEvent;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.ForbiddenException;
import si.spindl.common.exception.NotFoundException;
import si.spindl.common.text.TextValues;
import si.spindl.finance.InvoiceRepository;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.identity.TenantRolePermissionRepository;
import si.spindl.sales.SalesOrderRepository;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomerService {
    private final CustomerRepository customers;
    private final SalesOrderRepository orders;
    private final InvoiceRepository invoices;
    private final TenantMembershipRepository memberships;
    private final TenantRolePermissionRepository permissions;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<CustomerDtos.CustomerView> list(UUID tenantId, UUID actor, String email, String phone) {
        String role = memberships.findActiveRole(tenantId, actor).orElseThrow();
        boolean all = permissions.allows(tenantId, role, "crm", "customers", "view", "ALL");
        List<CustomerEntity> rows;
        if (email != null && !email.isBlank()) {
            rows = customers.findAllByTenantIdAndEmailIgnoreCaseAndActiveTrue(tenantId, email.trim());
        } else if (phone != null && !phone.isBlank()) {
            rows = customers.findAllByTenantIdAndPhoneAndActiveTrue(tenantId, phone.trim());
        } else {
            rows = all ? customers.findAllByTenantIdAndActiveTrueOrderByName(tenantId)
                    : customers.findAllByTenantIdAndCreatedByAndActiveTrueOrderByName(tenantId, actor);
        }
        if (!all && (email != null || phone != null)) {
            rows = rows.stream().filter(c -> actor.equals(c.getCreatedBy())).toList();
        }
        Map<UUID, Long> orderCounts = new HashMap<>();
        orders.countOrdersGroupedByCustomer(tenantId).forEach(r -> orderCounts.put((UUID) r[0], (Long) r[1]));
        Map<UUID, BigDecimal> balances = new HashMap<>();
        invoices.outstandingGroupedByCustomer(tenantId).forEach(r -> balances.put((UUID) r[0], (BigDecimal) r[1]));
        return rows.stream()
                .map(c -> CustomerMapper.toView(c, orderCounts.getOrDefault(c.getId(), 0L), balances.getOrDefault(c.getId(), BigDecimal.ZERO)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CustomerDtos.CustomerTimelineView> timeline(UUID tenantId, UUID actor, UUID id) {
        CustomerEntity customer = customers.findByTenantIdAndId(tenantId, id)
                .orElseThrow(NotFoundException::new);
        String role = memberships.findActiveRole(tenantId, actor)
                .orElseThrow(ForbiddenException::new);
        boolean all = permissions.allows(tenantId, role, "crm", "customers", "view", "ALL");
        boolean own = permissions.allows(tenantId, role, "crm", "customers", "view", "OWN") && actor.equals(customer.getCreatedBy());
        if (!all && !own) {
            throw new ForbiddenException("You do not have permission to view this customer timeline");
        }
        return customers.findTimeline(tenantId, id).stream()
                .map(row -> new CustomerDtos.CustomerTimelineView(row.getOccurredAt(), row.getEventType(), row.getReference(), row.getStatus(), row.getAmount()))
                .toList();
    }

    @Transactional
    public CustomerDtos.CustomerView create(UUID tenantId, UUID actor, CustomerDtos.CustomerRequest request) {
        if (customers.existsByTenantIdAndCodeIgnoreCase(tenantId, request.code())) {
            throw new ConflictException("Customer code already exists");
        }
        String status = request.status() == null || request.status().isBlank() ? "Active" : request.status().trim();
        CustomerEntity customer = new CustomerEntity(tenantId, request.code().trim(), request.name().trim(), request.email().trim(), status, actor);
        applyProfile(customer, request, actor);
        customer = customers.save(customer);
        eventPublisher.publishEvent(new DomainAuditEvent(tenantId, actor, "CUSTOMER_CREATED", "customer", customer.getId(), Map.of("code", customer.getCode())));
        return CustomerMapper.toView(customer, 0, BigDecimal.ZERO);
    }

    @Transactional
    public CustomerDtos.CustomerView update(UUID tenantId, UUID actor, UUID id, CustomerDtos.CustomerUpdate request) {
        CustomerEntity customer = customers.findByTenantIdAndId(tenantId, id)
                .orElseThrow(NotFoundException::new);
        customer.update(request.name().trim(), request.email().trim(), request.status(), request.active());
        applyProfile(customer, request, customer.getOwnerUserId());
        customer = customers.save(customer);
        eventPublisher.publishEvent(new DomainAuditEvent(tenantId, actor, "CUSTOMER_UPDATED", "customer", id, Map.of("active", request.active())));
        return CustomerMapper.toView(customer, orders.countByTenantIdAndCustomerId(tenantId, id), invoices.outstandingForCustomer(tenantId, id));
    }

    private void applyProfile(CustomerEntity customer, CustomerDtos.CustomerProfile request, UUID owner) {
        customer.applyProfile(
                TextValues.keepOrTrim(request.customerType(), customer.getCustomerType()).toUpperCase(Locale.ROOT),
                TextValues.keepOrTrim(request.contactName(), customer.getContactName()),
                TextValues.keepOrTrim(request.phone(), customer.getPhone()),
                TextValues.keepOrTrim(request.addressLine1(), customer.getAddressLine1()),
                TextValues.keepOrTrim(request.addressLine2(), customer.getAddressLine2()),
                TextValues.keepOrTrim(request.city(), customer.getCity()),
                TextValues.keepOrTrim(request.region(), customer.getRegion()),
                TextValues.keepOrTrim(request.postalCode(), customer.getPostalCode()),
                request.countryCode() == null ? customer.getCountryCode() : request.countryCode().trim().toUpperCase(Locale.ROOT),
                TextValues.keepOrTrim(request.taxId(), customer.getTaxId()),
                request.paymentTermsDays() == null ? customer.getPaymentTermsDays() : request.paymentTermsDays(),
                request.creditLimit() == null ? customer.getCreditLimit() : request.creditLimit(),
                TextValues.keepOrTrim(request.tags(), customer.getTags()),
                request.creditHold() == null ? customer.isCreditHold() : request.creditHold(),
                owner
        );
    }
}
