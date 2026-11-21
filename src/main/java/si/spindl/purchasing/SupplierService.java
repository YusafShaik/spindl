package si.spindl.purchasing;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.common.event.DomainAuditEvent;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import si.spindl.common.text.TextValues;

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
    public List<SupplierDtos.SupplierView> list(UUID tenantId) {
        return suppliers.findAllByTenantIdAndActiveTrueOrderByName(tenantId)
                .stream()
                .map(SupplierMapper::toView)
                .toList();
    }

    @Transactional
    public SupplierDtos.SupplierView create(UUID tenantId, UUID actorId, SupplierDtos.SupplierRequest request) {
        String code = request.code().trim();
        if (suppliers.existsByTenantIdAndCodeIgnoreCase(tenantId, code)) {
            throw new ConflictException("Supplier code already exists");
        }
        SupplierEntity supplier = new SupplierEntity(tenantId, code, request.name().trim(), request.email().trim());
        apply(supplier, request);
        supplier = suppliers.save(supplier);
        eventPublisher.publishEvent(new DomainAuditEvent(tenantId, actorId, "SUPPLIER_CREATED", "supplier", supplier.getId(), Map.of("code", code)));
        return SupplierMapper.toView(supplier);
    }

    @Transactional
    public SupplierDtos.SupplierView update(UUID tenantId, UUID actorId, UUID id, SupplierDtos.SupplierUpdate request) {
        SupplierEntity supplier = suppliers.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Supplier not found"));
        supplier.update(
                request.name().trim(),
                request.email().trim(),
                request.status() == null ? supplier.getStatus() : request.status().trim(),
                request.active() != null ? request.active() : request.status() == null ? supplier.isActive() : !"Inactive".equalsIgnoreCase(request.status())
        );
        apply(supplier, request);
        supplier = suppliers.save(supplier);
        eventPublisher.publishEvent(new DomainAuditEvent(tenantId, actorId, "SUPPLIER_UPDATED", "supplier", id, Map.of("active", supplier.isActive())));
        return SupplierMapper.toView(supplier);
    }

    private void apply(SupplierEntity supplier, SupplierDtos.SupplierProfile request) {
        supplier.updateProfile(
                TextValues.keepOrTrim(request.contactName(), supplier.getContactName()),
                TextValues.keepOrTrim(request.phone(), supplier.getPhone()),
                TextValues.keepOrTrim(request.addressLine1(), supplier.getAddressLine1()),
                TextValues.keepOrTrim(request.addressLine2(), supplier.getAddressLine2()),
                TextValues.keepOrTrim(request.city(), supplier.getCity()),
                TextValues.keepOrTrim(request.region(), supplier.getRegion()),
                TextValues.keepOrTrim(request.postalCode(), supplier.getPostalCode()),
                request.countryCode() == null ? supplier.getCountryCode() : request.countryCode().trim().toUpperCase(Locale.ROOT),
                TextValues.keepOrTrim(request.taxId(), supplier.getTaxId()),
                request.paymentTermsDays() == null ? supplier.getPaymentTermsDays() : request.paymentTermsDays(),
                request.leadTimeDays() == null ? supplier.getLeadTimeDays() : request.leadTimeDays(),
                request.rating() == null ? supplier.getRating() : request.rating(),
                TextValues.keepOrTrim(request.notes(), supplier.getNotes())
        );
    }
}
