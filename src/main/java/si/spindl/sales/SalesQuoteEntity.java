package si.spindl.sales;

import jakarta.persistence.*;
import si.spindl.party.CustomerEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name="sales_quotes",uniqueConstraints=@UniqueConstraint(name="uk_sales_quotes_tenant_number",columnNames={"tenant_id","quote_number"}))
public class SalesQuoteEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="quote_number",nullable=false,length=64) private String quoteNumber;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="customer_id",nullable=false) private CustomerEntity customer;
    @Column(nullable=false,length=24) private String status="draft";
    @Column(name="valid_until") private LocalDate validUntil;
    @Column(length=1000) private String notes;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    @OneToMany(mappedBy="quote",cascade=CascadeType.ALL,orphanRemoval=true) private List<SalesQuoteLineEntity> lines=new ArrayList<>();
    protected SalesQuoteEntity(){}
    public SalesQuoteEntity(UUID tenantId,String quoteNumber,CustomerEntity customer,LocalDate validUntil,String notes){this.tenantId=tenantId;this.quoteNumber=quoteNumber;this.customer=customer;this.validUntil=validUntil;this.notes=notes;}
    public void addLine(UUID tenantId,si.spindl.catalog.ItemEntity item,int quantity,java.math.BigDecimal unitPrice){lines.add(new SalesQuoteLineEntity(tenantId,this,item,quantity,unitPrice));}
    @PrePersist void onCreate(){createdAt=Instant.now();updatedAt=createdAt;}
    @PreUpdate void onUpdate(){updatedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getQuoteNumber(){return quoteNumber;} public CustomerEntity getCustomer(){return customer;} public String getStatus(){return status;} public LocalDate getValidUntil(){return validUntil;} public String getNotes(){return notes;} public Instant getCreatedAt(){return createdAt;} public List<SalesQuoteLineEntity> getLines(){return lines;}
    public void send(){if(!status.equals("draft"))throw new IllegalStateException("Only draft quotes can be sent");if(validUntil!=null&&validUntil.isBefore(LocalDate.now()))throw new IllegalStateException("Quote validity date has passed");status="sent";}
    public void accept(){if(!status.equals("sent"))throw new IllegalStateException("Only sent quotes can be accepted");if(validUntil!=null&&validUntil.isBefore(LocalDate.now()))throw new IllegalStateException("Quote has expired");status="accepted";}
    public void reject(){if(!status.equals("sent"))throw new IllegalStateException("Only sent quotes can be rejected");status="rejected";}
    public java.math.BigDecimal getTotal(){return lines.stream().map(line->line.getUnitPrice().multiply(java.math.BigDecimal.valueOf(line.getQuantity()))).reduce(java.math.BigDecimal.ZERO,java.math.BigDecimal::add);}
}
