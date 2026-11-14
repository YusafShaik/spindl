package si.spindl.sales;

import jakarta.persistence.*;
import si.spindl.catalog.WarehouseEntity;
import java.util.UUID;

@Entity
@Table(name="sales_shipment_lines")
public class SalesShipmentLineEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="shipment_id",nullable=false) private SalesShipmentEntity shipment;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="sales_order_line_id",nullable=false) private SalesOrderLineEntity salesOrderLine;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="warehouse_id",nullable=false) private WarehouseEntity warehouse;
    @Column(nullable=false) private int quantity;
    protected SalesShipmentLineEntity(){}
    SalesShipmentLineEntity(UUID tenantId,SalesShipmentEntity shipment,SalesOrderLineEntity orderLine,int quantity){this.tenantId=tenantId;this.shipment=shipment;this.salesOrderLine=orderLine;this.warehouse=orderLine.getWarehouse();this.quantity=quantity;}
    public int getQuantity(){return quantity;} public WarehouseEntity getWarehouse(){return warehouse;}
}
