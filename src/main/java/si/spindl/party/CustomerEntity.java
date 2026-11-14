package si.spindl.party;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "customers", uniqueConstraints = {@UniqueConstraint(name = "uk_customers_tenant_code", columnNames = {"tenant_id", "code"}),@UniqueConstraint(name="uk_customers_tenant_id",columnNames={"tenant_id","id"})})
public class CustomerEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "created_by") private UUID createdBy;
    @Column(name="owner_user_id") private UUID ownerUserId;
    @Column(name="merged_into_customer_id") private UUID mergedIntoCustomerId;
    @Column(nullable = false, length = 64) private String code;
    @Column(nullable = false, length = 180) private String name;
    @Column(nullable = false, length = 254) private String email;
    @Column(nullable = false, length = 32) private String status;
    @Column(name="customer_type",nullable=false,length=16) private String customerType="COMPANY";
    @Column(name="contact_name",length=180) private String contactName;
    @Column(length=40) private String phone;
    @Column(name="address_line1",length=180) private String addressLine1;
    @Column(name="address_line2",length=180) private String addressLine2;
    @Column(length=100) private String city;
    @Column(length=100) private String region;
    @Column(name="postal_code",length=24) private String postalCode;
    @Column(name="country_code",length=2) private String countryCode;
    @Column(name="tax_id",length=80) private String taxId;
    @Column(name="payment_terms_days",nullable=false) private int paymentTermsDays;
    @Column(name="credit_limit",nullable=false,precision=14,scale=2) private java.math.BigDecimal creditLimit=java.math.BigDecimal.ZERO;
    @Column(nullable=false,columnDefinition="text") private String tags="";
    @Column(name="credit_hold",nullable=false) private boolean creditHold;
    @Column(nullable = false) private boolean active = true;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    protected CustomerEntity() {}
    public CustomerEntity(UUID tenantId, String code, String name, String email, String status) { this.tenantId=tenantId; this.code=code; this.name=name; this.email=email; this.status=status; }
    public CustomerEntity(UUID tenantId, String code, String name, String email, String status, UUID createdBy) { this(tenantId,code,name,email,status); this.createdBy=createdBy; }
    public void applyProfile(String type,String contact,String phone,String line1,String line2,String city,String region,String postal,String country,String taxId,int terms,java.math.BigDecimal credit,String tags,boolean creditHold,UUID owner){this.customerType=type;this.contactName=contact;this.phone=phone;this.addressLine1=line1;this.addressLine2=line2;this.city=city;this.region=region;this.postalCode=postal;this.countryCode=country;this.taxId=taxId;this.paymentTermsDays=terms;this.creditLimit=credit;this.tags=tags;this.creditHold=creditHold;this.ownerUserId=owner;}
    @PrePersist void onCreate() { createdAt=Instant.now(); updatedAt=createdAt; }
    @PreUpdate void onUpdate() { updatedAt=Instant.now(); }
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public UUID getCreatedBy(){return createdBy;} public UUID getOwnerUserId(){return ownerUserId;} public UUID getMergedIntoCustomerId(){return mergedIntoCustomerId;} public String getCode(){return code;} public String getName(){return name;} public String getEmail(){return email;} public String getStatus(){return status;} public boolean isActive(){return active;} public String getCustomerType(){return customerType;} public String getContactName(){return contactName;} public String getPhone(){return phone;} public String getAddressLine1(){return addressLine1;} public String getAddressLine2(){return addressLine2;} public String getCity(){return city;} public String getRegion(){return region;} public String getPostalCode(){return postalCode;} public String getCountryCode(){return countryCode;} public String getTaxId(){return taxId;} public int getPaymentTermsDays(){return paymentTermsDays;} public java.math.BigDecimal getCreditLimit(){return creditLimit;} public String getTags(){return tags;} public boolean isCreditHold(){return creditHold;}
    public void update(String name,String email,String status,boolean active){this.name=name;this.email=email;this.status=status;this.active=active;}
    public void mergeInto(UUID targetId){this.mergedIntoCustomerId=targetId;this.active=false;this.status="Merged";}
}
