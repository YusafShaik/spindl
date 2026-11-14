package si.spindl.finance;

import jakarta.persistence.*;
import si.spindl.party.CustomerEntity;
import si.spindl.sales.SalesOrderEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name="invoices",uniqueConstraints={@UniqueConstraint(name="uk_invoices_tenant_number",columnNames={"tenant_id","invoice_number"}),@UniqueConstraint(name="uk_invoices_tenant_idempotency",columnNames={"tenant_id","idempotency_key"})})
public class InvoiceEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="invoice_number",nullable=false,length=64) private String invoiceNumber;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="sales_order_id",nullable=false) private SalesOrderEntity salesOrder;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="customer_id",nullable=false) private CustomerEntity customer;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(nullable=false,length=24) private String status="unpaid";
    @Column(name="due_date",nullable=false) private LocalDate dueDate;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal total;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal subtotal;
    @Column(name="tax_code",nullable=false,length=24) private String taxCode;
    @Column(name="tax_rate",nullable=false,precision=5,scale=2) private BigDecimal taxRate;
    @Column(name="tax_total",nullable=false,precision=14,scale=2) private BigDecimal taxTotal;
    @Column(name="credit_total",nullable=false,precision=14,scale=2) private BigDecimal creditTotal=BigDecimal.ZERO;
    @Column(name="amount_paid",nullable=false,precision=14,scale=2) private BigDecimal amountPaid=BigDecimal.ZERO;
    @Column(name="issued_at",nullable=false,updatable=false) private Instant issuedAt;
    @OneToMany(mappedBy="invoice",cascade=CascadeType.ALL,orphanRemoval=true) private List<InvoiceLineEntity> lines=new ArrayList<>();
    @OneToMany(mappedBy="invoice",cascade=CascadeType.ALL,orphanRemoval=true) private List<InvoicePaymentEntity> payments=new ArrayList<>();
    protected InvoiceEntity(){}
    public InvoiceEntity(UUID tenantId,String number,SalesOrderEntity order,CustomerEntity customer,String key,LocalDate dueDate,BigDecimal subtotal,String taxCode,BigDecimal taxRate,BigDecimal taxTotal){this.tenantId=tenantId;this.invoiceNumber=number;this.salesOrder=order;this.customer=customer;this.idempotencyKey=key;this.dueDate=dueDate;this.subtotal=subtotal;this.taxCode=taxCode;this.taxRate=taxRate;this.taxTotal=taxTotal;this.total=subtotal.add(taxTotal);}
    public void addLine(UUID tenantId,si.spindl.sales.SalesOrderLineEntity orderLine,int quantity,BigDecimal taxRate){lines.add(new InvoiceLineEntity(tenantId,this,orderLine,quantity,taxRate));}
    public void addPayment(InvoicePaymentEntity payment){payments.add(payment);}
    @PrePersist void onCreate(){issuedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getInvoiceNumber(){return invoiceNumber;} public SalesOrderEntity getSalesOrder(){return salesOrder;} public CustomerEntity getCustomer(){return customer;} public String getIdempotencyKey(){return idempotencyKey;} public String getStatus(){return status;} public LocalDate getDueDate(){return dueDate;} public BigDecimal getTotal(){return total;} public BigDecimal getSubtotal(){return subtotal;} public String getTaxCode(){return taxCode;} public BigDecimal getTaxRate(){return taxRate;} public BigDecimal getTaxTotal(){return taxTotal;} public BigDecimal getCreditTotal(){return creditTotal;} public BigDecimal getAmountPaid(){return amountPaid;} public Instant getIssuedAt(){return issuedAt;} public List<InvoiceLineEntity> getLines(){return lines;} public List<InvoicePaymentEntity> getPayments(){return payments;}
    public BigDecimal getBalance(){return total.subtract(amountPaid).subtract(creditTotal).max(BigDecimal.ZERO);}
    public BigDecimal getAvailableCredit(){return total.subtract(creditTotal);}
    public void recordPayment(BigDecimal amount){if(amount.signum()<=0||amount.compareTo(getBalance())>0)throw new IllegalArgumentException("Payment must be positive and cannot exceed the remaining balance");amountPaid=amountPaid.add(amount);refreshStatus();}
    public void recordCredit(BigDecimal amount){if(amount.signum()<=0||amount.compareTo(getAvailableCredit())>0)throw new IllegalArgumentException("Credit must be positive and cannot exceed the remaining invoice amount");creditTotal=creditTotal.add(amount);refreshStatus();}
    private void refreshStatus(){if(amountPaid.add(creditTotal).compareTo(total)>=0)status=creditTotal.signum()>0?"credited":"paid";else if(amountPaid.signum()>0||creditTotal.signum()>0)status="partially_paid";else status="unpaid";}
}
