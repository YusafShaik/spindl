package si.spindl.purchasing;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.common.event.DomainAuditEvent;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SupplierService {
    private final SupplierRepository suppliers;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<SupplierController.SupplierView> list(UUID tenantId) {
        return suppliers.findAllByTenantIdAndActiveTrueOrderByName(tenantId)
                .stream()
                .map(SupplierController.SupplierView::from)
                .toList();
    }

    @Transactional
    public SupplierController.SupplierView create(UUID tenantId, UUID actorId, SupplierController.SupplierRequest request) {
        String code = request.code().trim();
        if (suppliers.existsByTenantIdAndCodeIgnoreCase(tenantId, code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Supplier code already exists");
        }
        SupplierEntity supplier = new SupplierEntity(tenantId, code, request.name().trim(), request.email().trim());
        apply(supplier, request);
        supplier = suppliers.save(supplier);
        eventPublisher.publishEvent(new DomainAuditEvent(tenantId, actorId, "SUPPLIER_CREATED", "supplier", supplier.getId(), Map.of("code", code)));
        return SupplierController.SupplierView.from(supplier);
    }

    @Transactional
    public SupplierController.SupplierView update(UUID tenantId, UUID actorId, UUID id, SupplierController.SupplierUpdate request) {
        SupplierEntity supplier = suppliers.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Supplier not found"));
        supplier.update(
                request.name().trim(),
                request.email().trim(),
                request.status() == null ? supplier.getStatus() : request.status().trim(),
                request.active() != null ? request.active() : request.status() == null ? supplier.isActive() : !"Inactive".equalsIgnoreCase(request.status())
        );
        apply(supplier, request);
        supplier = suppliers.save(supplier);
        eventPublisher.publishEvent(new DomainAuditEvent(tenantId, actorId, "SUPPLIER_UPDATED", "supplier", id, Map.of("active", supplier.isActive())));
        return SupplierController.SupplierView.from(supplier);
    }

    private void apply(SupplierEntity supplier, SupplierController.SupplierProfile request) {
        supplier.updateProfile(
                value(request.contactName(), supplier.getContactName()),
                value(request.phone(), supplier.getPhone()),
                value(request.addressLine1(), supplier.getAddressLine1()),
                value(request.addressLine2(), supplier.getAddressLine2()),
                value(request.city(), supplier.getCity()),
                value(request.region(), supplier.getRegion()),
                value(request.postalCode(), supplier.getPostalCode()),
                request.countryCode() == null ? supplier.getCountryCode() : request.countryCode().trim().toUpperCase(Locale.ROOT),
                value(request.taxId(), supplier.getTaxId()),
                request.paymentTermsDays() == null ? supplier.getPaymentTermsDays() : request.paymentTermsDays(),
                request.leadTimeDays() == null ? supplier.getLeadTimeDays() : request.leadTimeDays(),
                request.rating() == null ? supplier.getRating() : request.rating(),
                value(request.notes(), supplier.getNotes())
        );
    }

    private String value(String value, String previous) {
        return value == null ? previous : value.isBlank() ? null : value.trim();
    }
}
