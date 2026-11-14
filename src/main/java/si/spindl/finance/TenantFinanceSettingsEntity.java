package si.spindl.finance;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.Year;
import java.util.Locale;
import java.util.UUID;

@Entity
@Table(name="tenant_finance_settings")
public class TenantFinanceSettingsEntity {
    @Id @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="tax_code",nullable=false,length=24) private String taxCode="NONE";
    @Column(name="tax_rate",nullable=false,precision=5,scale=2) private BigDecimal taxRate=BigDecimal.ZERO;
    @Column(name="invoice_prefix",nullable=false,length=8) private String invoicePrefix="INV";
    @Column(name="next_invoice_number",nullable=false) private long nextInvoiceNumber=1;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected TenantFinanceSettingsEntity(){}
    public UUID getTenantId(){return tenantId;} public String getTaxCode(){return taxCode;} public BigDecimal getTaxRate(){return taxRate;} public String getInvoicePrefix(){return invoicePrefix;} public long getNextInvoiceNumber(){return nextInvoiceNumber;}
    public String allocateInvoiceNumber(){long allocated=nextInvoiceNumber;nextInvoiceNumber=Math.addExact(nextInvoiceNumber,1);return invoicePrefix+"-"+Year.now()+"-"+String.format(Locale.ROOT,"%06d",allocated);}
    public void update(String taxCode,BigDecimal taxRate,String invoicePrefix){this.taxCode=taxCode;this.taxRate=taxRate;this.invoicePrefix=invoicePrefix;}
    @PreUpdate void touch(){updatedAt=Instant.now();}
}
