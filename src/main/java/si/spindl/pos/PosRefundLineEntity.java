package si.spindl.pos;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.util.UUID;

@Entity @Table(name="pos_refund_lines")
public class PosRefundLineEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="refund_id",nullable=false) private PosRefundEntity refund;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="sale_line_id",nullable=false) private PosSaleLineEntity saleLine;
    @Column(nullable=false) private int quantity;
    @Column(nullable=false,length=16) private String disposition;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal subtotal;
    @Column(name="tax_total",nullable=false,precision=14,scale=2) private BigDecimal taxTotal;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal total;
    protected PosRefundLineEntity(){}
    public PosRefundLineEntity(UUID tenantId,PosRefundEntity refund,PosSaleLineEntity saleLine,int quantity,String disposition,BigDecimal subtotal,BigDecimal taxTotal){this.tenantId=tenantId;this.refund=refund;this.saleLine=saleLine;this.quantity=quantity;this.disposition=disposition;this.subtotal=subtotal;this.taxTotal=taxTotal;this.total=subtotal.add(taxTotal);}
    public String getSku(){return saleLine.getSku();} public String getItemName(){return saleLine.getItemName();} public int getQuantity(){return quantity;} public String getDisposition(){return disposition;} public BigDecimal getSubtotal(){return subtotal;} public BigDecimal getTaxTotal(){return taxTotal;} public BigDecimal getTotal(){return total;}
}
