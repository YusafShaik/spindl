package si.spindl.purchasing;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="suppliers", uniqueConstraints=@UniqueConstraint(name="uk_suppliers_tenant_code", columnNames={"tenant_id","code"}))
public class SupplierEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id", nullable=false) private UUID tenantId;
    @Column(nullable=false, length=64) private String code;
    @Column(nullable=false, length=180) private String name;
    @Column(nullable=false, length=254) private String email;
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
    @Column(name="lead_time_days",nullable=false) private int leadTimeDays;
    @Column(precision=2,scale=1) private java.math.BigDecimal rating;
    @Column(length=1000) private String notes;
    @Column(nullable=false, length=32) private String status="Active";
    @Column(nullable=false) private boolean active=true;
    @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;
    @Column(name="updated_at", nullable=false) private Instant updatedAt;

    protected SupplierEntity() {}
    public SupplierEntity(UUID tenantId,String code,String name,String email){this.tenantId=tenantId;this.code=code;this.name=name;this.email=email;}
    public void updateProfile(String contact,String phone,String line1,String line2,String city,String region,String postal,String country,String taxId,int terms,int leadTime,java.math.BigDecimal rating,String notes){this.contactName=contact;this.phone=phone;this.addressLine1=line1;this.addressLine2=line2;this.city=city;this.region=region;this.postalCode=postal;this.countryCode=country;this.taxId=taxId;this.paymentTermsDays=terms;this.leadTimeDays=leadTime;this.rating=rating;this.notes=notes;}
    public void update(String name,String email,String status,boolean active){this.name=name;this.email=email;this.status=status;this.active=active;}
    @PrePersist void onCreate(){createdAt=Instant.now();updatedAt=createdAt;}
    @PreUpdate void onUpdate(){updatedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getCode(){return code;} public String getName(){return name;} public String getEmail(){return email;} public String getStatus(){return status;} public boolean isActive(){return active;} public String getContactName(){return contactName;} public String getPhone(){return phone;} public String getAddressLine1(){return addressLine1;} public String getAddressLine2(){return addressLine2;} public String getCity(){return city;} public String getRegion(){return region;} public String getPostalCode(){return postalCode;} public String getCountryCode(){return countryCode;} public String getTaxId(){return taxId;} public int getPaymentTermsDays(){return paymentTermsDays;} public int getLeadTimeDays(){return leadTimeDays;} public java.math.BigDecimal getRating(){return rating;} public String getNotes(){return notes;}
}
