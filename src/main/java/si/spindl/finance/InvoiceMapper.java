package si.spindl.finance;

import si.spindl.finance.InvoiceDtos.InvoiceLineView;
import si.spindl.finance.InvoiceDtos.InvoiceView;

/** Entity and row mapping for InvoiceDtos. The records themselves stay free of persistence types. */
public final class InvoiceMapper {
    private InvoiceMapper() {}

    public static InvoiceLineView toInvoiceLineView(InvoiceLineEntity line) {

            return new InvoiceLineView(line.getId(), line.getSku(), line.getItemName(), line.getQuantity(),line.getCreditedQuantity(),line.getCreditEligibleQuantity(), line.getUnitPrice(), line.getLineTotal(),line.getTaxRate(),line.getTaxAmount(),line.getGrossTotal());
        
    }

    public static InvoiceView toInvoiceView(InvoiceEntity invoice) {

            return new InvoiceView(invoice.getId(), invoice.getInvoiceNumber(), invoice.getStatus(),
                    invoice.getSalesOrder().getId(), invoice.getSalesOrder().getOrderNumber(),
                    invoice.getCustomer().getId(), invoice.getCustomer().getName(), invoice.getDueDate(),
                    invoice.getIssuedAt(),invoice.getSubtotal(),invoice.getTaxCode(),invoice.getTaxRate(),invoice.getTaxTotal(), invoice.getTotal(), invoice.getAmountPaid(),invoice.getCreditTotal(), invoice.getBalance(),
                    invoice.getLines().stream().map(InvoiceMapper::toInvoiceLineView).toList());
        
    }
}
