package si.spindl.purchasing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.tenant.DevelopmentTenant;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.Map;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {
    private final SupplierRepository suppliers;
    private final DevelopmentTenant tenant;
    private final TenantAuditEventRepository audit;
    public SupplierController(SupplierRepository suppliers,DevelopmentTenant tenant,TenantAuditEventRepository audit){this.suppliers=suppliers;this.tenant=tenant;this.audit=audit;}

    @GetMapping public List<SupplierView> list(){return suppliers.findAllByTenantIdAndActiveTrueOrderByName(tenant.currentTenantId()).stream().map(SupplierView::from).toList();}

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    @org.springframework.transaction.annotation.Transactional public SupplierView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody SupplierRequest request){
        String code=request.code().trim(); UUID tenantId=tenant.currentTenantId();
        if(suppliers.existsByTenantIdAndCodeIgnoreCase(tenantId,code)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Supplier code already exists");
        SupplierEntity supplier=new SupplierEntity(tenantId,code,request.name().trim(),request.email().trim());
        apply(supplier,request);
        supplier=suppliers.save(supplier);audit.save(new TenantAuditEventEntity(tenantId,UUID.fromString(jwt.getSubject()),"SUPPLIER_CREATED","supplier",supplier.getId(),Map.of("code",code)));return SupplierView.from(supplier);
    }

    @PutMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional public SupplierView update(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody SupplierUpdate request){
        SupplierEntity supplier=suppliers.findByTenantIdAndId(tenant.currentTenantId(),id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Supplier not found"));
        supplier.update(request.name().trim(),request.email().trim(),request.status()==null?supplier.getStatus():request.status().trim(),request.active()!=null?request.active():request.status()==null?supplier.isActive():!"Inactive".equalsIgnoreCase(request.status()));
        apply(supplier,request);
        supplier=suppliers.save(supplier);audit.save(new TenantAuditEventEntity(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),"SUPPLIER_UPDATED","supplier",id,Map.of("active",supplier.isActive())));return SupplierView.from(supplier);
    }

    private void apply(SupplierEntity supplier,SupplierProfile request){
        supplier.updateProfile(value(request.contactName(),supplier.getContactName()),value(request.phone(),supplier.getPhone()),value(request.addressLine1(),supplier.getAddressLine1()),value(request.addressLine2(),supplier.getAddressLine2()),value(request.city(),supplier.getCity()),value(request.region(),supplier.getRegion()),value(request.postalCode(),supplier.getPostalCode()),request.countryCode()==null?supplier.getCountryCode():request.countryCode().trim().toUpperCase(java.util.Locale.ROOT),value(request.taxId(),supplier.getTaxId()),request.paymentTermsDays()==null?supplier.getPaymentTermsDays():request.paymentTermsDays(),request.leadTimeDays()==null?supplier.getLeadTimeDays():request.leadTimeDays(),request.rating()==null?supplier.getRating():request.rating(),value(request.notes(),supplier.getNotes()));
    }
    private String value(String value,String previous){return value==null?previous:value.isBlank()?null:value.trim();}

    public interface SupplierProfile{String contactName();String phone();String addressLine1();String addressLine2();String city();String region();String postalCode();String countryCode();String taxId();Integer paymentTermsDays();Integer leadTimeDays();BigDecimal rating();String notes();}
    public record SupplierRequest(@NotBlank @Size(max=64) String code,@NotBlank @Size(max=180) String name,@NotBlank @Email @Size(max=254) String email,@Size(max=180) String contactName,@Size(max=40) String phone,@Size(max=180) String addressLine1,@Size(max=180) String addressLine2,@Size(max=100) String city,@Size(max=100) String region,@Size(max=24) String postalCode,@Pattern(regexp="[A-Za-z]{2}") String countryCode,@Size(max=80) String taxId,@Min(0) @Max(365) Integer paymentTermsDays,@Min(0) @Max(3650) Integer leadTimeDays,@DecimalMin("0.0") @DecimalMax("5.0") @Digits(integer=1,fraction=1) BigDecimal rating,@Size(max=1000) String notes)implements SupplierProfile{}
    public record SupplierUpdate(@NotBlank @Size(max=180) String name,@NotBlank @Email @Size(max=254) String email,String status,Boolean active,@Size(max=180) String contactName,@Size(max=40) String phone,@Size(max=180) String addressLine1,@Size(max=180) String addressLine2,@Size(max=100) String city,@Size(max=100) String region,@Size(max=24) String postalCode,@Pattern(regexp="[A-Za-z]{2}") String countryCode,@Size(max=80) String taxId,@Min(0) @Max(365) Integer paymentTermsDays,@Min(0) @Max(3650) Integer leadTimeDays,@DecimalMin("0.0") @DecimalMax("5.0") @Digits(integer=1,fraction=1) BigDecimal rating,@Size(max=1000) String notes)implements SupplierProfile{}
    public record SupplierView(UUID id,String code,String name,String email,String status,String contactName,String phone,String addressLine1,String addressLine2,String city,String region,String postalCode,String countryCode,String taxId,int paymentTermsDays,int leadTimeDays,BigDecimal rating,String notes){static SupplierView from(SupplierEntity s){return new SupplierView(s.getId(),s.getCode(),s.getName(),s.getEmail(),s.getStatus(),s.getContactName(),s.getPhone(),s.getAddressLine1(),s.getAddressLine2(),s.getCity(),s.getRegion(),s.getPostalCode(),s.getCountryCode(),s.getTaxId(),s.getPaymentTermsDays(),s.getLeadTimeDays(),s.getRating(),s.getNotes());}}
}
