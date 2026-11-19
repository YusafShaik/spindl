package si.spindl.party;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.tenant.DevelopmentTenant;
import si.spindl.finance.InvoiceRepository;
import si.spindl.sales.SalesOrderRepository;

import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.identity.TenantRolePermissionRepository;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import java.util.Map;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {
    private final CustomerRepository customers;
    private final DevelopmentTenant tenant;
    private final SalesOrderRepository orders;
    private final InvoiceRepository invoices;
    private final TenantMembershipRepository memberships;
    private final TenantRolePermissionRepository permissions;
    private final TenantAuditEventRepository audit;
    private final CustomerMergeService merges;
    public CustomerController(CustomerRepository customers, DevelopmentTenant tenant, SalesOrderRepository orders, InvoiceRepository invoices,TenantMembershipRepository memberships,TenantRolePermissionRepository permissions,TenantAuditEventRepository audit,CustomerMergeService merges) { this.customers=customers; this.tenant=tenant; this.orders=orders; this.invoices=invoices; this.memberships=memberships;this.permissions=permissions;this.audit=audit;this.merges=merges; }
    @GetMapping public List<CustomerView> list(@AuthenticationPrincipal Jwt jwt,@RequestParam(required=false) String email,@RequestParam(required=false) String phone){var tenantId=tenant.currentTenantId();var actor=UUID.fromString(jwt.getSubject());String role=memberships.findActiveRole(tenantId,actor).orElseThrow();boolean all=permissions.allows(tenantId,role,"crm","customers","view","ALL");List<CustomerEntity> rows;if(email!=null&&!email.isBlank())rows=customers.findAllByTenantIdAndEmailIgnoreCaseAndActiveTrue(tenantId,email.trim());else if(phone!=null&&!phone.isBlank())rows=customers.findAllByTenantIdAndPhoneAndActiveTrue(tenantId,phone.trim());else rows=all?customers.findAllByTenantIdAndActiveTrueOrderByName(tenantId):customers.findAllByTenantIdAndCreatedByAndActiveTrueOrderByName(tenantId,actor);if(!all&&(email!=null||phone!=null))rows=rows.stream().filter(c->actor.equals(c.getCreatedBy())).toList();java.util.Map<UUID,Long> orderCounts=new java.util.HashMap<>();orders.countOrdersGroupedByCustomer(tenantId).forEach(r->orderCounts.put((UUID)r[0],(Long)r[1]));java.util.Map<UUID,java.math.BigDecimal> balances=new java.util.HashMap<>();invoices.outstandingGroupedByCustomer(tenantId).forEach(r->balances.put((UUID)r[0],(java.math.BigDecimal)r[1]));return rows.stream().map(c->CustomerView.from(c,orderCounts.getOrDefault(c.getId(),0L),balances.getOrDefault(c.getId(),java.math.BigDecimal.ZERO))).toList();}
    @GetMapping("/{id}/timeline") public List<CustomerTimelineView> timeline(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){UUID tenantId=tenant.currentTenantId(),actor=UUID.fromString(jwt.getSubject());CustomerEntity customer=customers.findByTenantIdAndId(tenantId,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));String role=memberships.findActiveRole(tenantId,actor).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN));boolean all=permissions.allows(tenantId,role,"crm","customers","view","ALL");boolean own=permissions.allows(tenantId,role,"crm","customers","view","OWN")&&actor.equals(customer.getCreatedBy());if(!all&&!own)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"You do not have permission to view this customer timeline");return customers.findTimeline(tenantId,id).stream().map(row->new CustomerTimelineView(row.getOccurredAt(),row.getEventType(),row.getReference(),row.getStatus(),row.getAmount())).toList();}
    public record CustomerTimelineView(String occurredAt,String eventType,String reference,String status,java.math.BigDecimal amount){}

    @PostMapping("/{sourceId}/merge")
    public CustomerMergeService.MergeResult merge(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID sourceId,@Valid @RequestBody MergeCustomersRequest request){return merges.merge(UUID.fromString(jwt.getSubject()),sourceId,request.targetCustomerId());}
    public record MergeCustomersRequest(@jakarta.validation.constraints.NotNull UUID targetCustomerId){}

    @PostMapping @ResponseStatus(HttpStatus.CREATED) @org.springframework.transaction.annotation.Transactional
    public CustomerView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody CustomerRequest request){
        if(customers.existsByTenantIdAndCodeIgnoreCase(tenant.currentTenantId(),request.code())) throw new ResponseStatusException(HttpStatus.CONFLICT,"Customer code already exists");
        String status = request.status() == null || request.status().isBlank() ? "Active" : request.status().trim();
        CustomerEntity customer=new CustomerEntity(tenant.currentTenantId(),request.code().trim(),request.name().trim(),request.email().trim(),status,UUID.fromString(jwt.getSubject()));applyProfile(customer,request,UUID.fromString(jwt.getSubject()));customer=customers.save(customer);audit.save(new TenantAuditEventEntity(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),"CUSTOMER_CREATED","customer",customer.getId(),Map.of("code",customer.getCode())));return CustomerView.from(customer,0,java.math.BigDecimal.ZERO);
    }
    @PutMapping("/{id}") @org.springframework.transaction.annotation.Transactional public CustomerView update(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody CustomerUpdate request){
        CustomerEntity customer=customers.findByTenantIdAndId(tenant.currentTenantId(),id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        customer.update(request.name().trim(),request.email().trim(),request.status(),request.active()); applyProfile(customer,request,customer.getOwnerUserId());customer=customers.save(customer);audit.save(new TenantAuditEventEntity(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),"CUSTOMER_UPDATED","customer",id,Map.of("active",request.active())));return CustomerView.from(customer,orders.countByTenantIdAndCustomerId(tenant.currentTenantId(),id),invoices.outstandingForCustomer(tenant.currentTenantId(),id));
    }
    private void applyProfile(CustomerEntity customer,CustomerProfile request,UUID owner){customer.applyProfile(value(request.customerType(),customer.getCustomerType()).toUpperCase(java.util.Locale.ROOT),value(request.contactName(),customer.getContactName()),value(request.phone(),customer.getPhone()),value(request.addressLine1(),customer.getAddressLine1()),value(request.addressLine2(),customer.getAddressLine2()),value(request.city(),customer.getCity()),value(request.region(),customer.getRegion()),value(request.postalCode(),customer.getPostalCode()),request.countryCode()==null?customer.getCountryCode():request.countryCode().trim().toUpperCase(java.util.Locale.ROOT),value(request.taxId(),customer.getTaxId()),request.paymentTermsDays()==null?customer.getPaymentTermsDays():request.paymentTermsDays(),request.creditLimit()==null?customer.getCreditLimit():request.creditLimit(),value(request.tags(),customer.getTags()),request.creditHold()==null?customer.isCreditHold():request.creditHold(),owner);}
    private String value(String value,String previous){return value==null?previous:value.isBlank()?null:value.trim();}
    public interface CustomerProfile{String customerType();String contactName();String phone();String addressLine1();String addressLine2();String city();String region();String postalCode();String countryCode();String taxId();Integer paymentTermsDays();java.math.BigDecimal creditLimit();String tags();Boolean creditHold();}
    public record CustomerRequest(@NotBlank @Size(max=64) String code,@NotBlank @Size(max=180) String name,@NotBlank @Email @Size(max=254) String email,String status,@jakarta.validation.constraints.Pattern(regexp="(?i)(COMPANY|INDIVIDUAL)") String customerType,@Size(max=180) String contactName,@Size(max=40) String phone,@Size(max=180) String addressLine1,@Size(max=180) String addressLine2,@Size(max=100) String city,@Size(max=100) String region,@Size(max=24) String postalCode,@jakarta.validation.constraints.Pattern(regexp="[A-Za-z]{2}") String countryCode,@Size(max=80) String taxId,@jakarta.validation.constraints.Min(0) @jakarta.validation.constraints.Max(365) Integer paymentTermsDays,@jakarta.validation.constraints.DecimalMin("0.00") @jakarta.validation.constraints.Digits(integer=12,fraction=2) java.math.BigDecimal creditLimit,@Size(max=1000) String tags,Boolean creditHold) implements CustomerProfile{}
    public record CustomerUpdate(@NotBlank @Size(max=180) String name,@NotBlank @Email @Size(max=254) String email,@NotBlank String status,boolean active,@jakarta.validation.constraints.Pattern(regexp="(?i)(COMPANY|INDIVIDUAL)") String customerType,@Size(max=180) String contactName,@Size(max=40) String phone,@Size(max=180) String addressLine1,@Size(max=180) String addressLine2,@Size(max=100) String city,@Size(max=100) String region,@Size(max=24) String postalCode,@jakarta.validation.constraints.Pattern(regexp="[A-Za-z]{2}") String countryCode,@Size(max=80) String taxId,@jakarta.validation.constraints.Min(0) @jakarta.validation.constraints.Max(365) Integer paymentTermsDays,@jakarta.validation.constraints.DecimalMin("0.00") @jakarta.validation.constraints.Digits(integer=12,fraction=2) java.math.BigDecimal creditLimit,@Size(max=1000) String tags,Boolean creditHold) implements CustomerProfile{}
    public record CustomerView(UUID id,String code,String name,String email,long orders,String outstanding,String status,String initials,String tone,String customerType,String contactName,String phone,String addressLine1,String addressLine2,String city,String region,String postalCode,String countryCode,String taxId,int paymentTermsDays,java.math.BigDecimal creditLimit,String tags,UUID ownerUserId,boolean creditHold){
        static CustomerView from(CustomerEntity c,long orderCount,java.math.BigDecimal balance){String cleaned=c.getName().replaceAll("[^A-Za-z0-9 ]","").trim();String[] words=cleaned.isEmpty()?new String[]{"?"}:cleaned.split("\\s+"); String mark=words.length>1?(""+words[0].charAt(0)+words[1].charAt(0)).toUpperCase():words[0].substring(0,Math.min(2,words[0].length())).toUpperCase();String amount="₹ "+balance.stripTrailingZeros().toPlainString();return new CustomerView(c.getId(),c.getCode(),c.getName(),c.getEmail(),orderCount,amount,c.getStatus(),mark,"lavender",c.getCustomerType(),c.getContactName(),c.getPhone(),c.getAddressLine1(),c.getAddressLine2(),c.getCity(),c.getRegion(),c.getPostalCode(),c.getCountryCode(),c.getTaxId(),c.getPaymentTermsDays(),c.getCreditLimit(),c.getTags(),c.getOwnerUserId(),c.isCreditHold());}
    }
}
