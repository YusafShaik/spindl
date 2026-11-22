package si.spindl.finance;

import si.spindl.finance.CustomerCreditNoteDtos.CreditNoteLineView;
import si.spindl.finance.CustomerCreditNoteDtos.CreditNoteView;

/** Entity and row mapping for CustomerCreditNoteDtos. The records themselves stay free of persistence types. */
public final class CustomerCreditNoteMapper {
    private CustomerCreditNoteMapper() {}

    public static CreditNoteView toCreditNoteView(CustomerCreditNoteEntity note) {

            return new CreditNoteView(note.getId(), note.getCreditNumber(), note.getInvoice().getInvoiceNumber(), note.getInvoice().getCustomer().getName(), note.getReason(), note.getSubtotal(), note.getTaxTotal(), note.getTotal(), note.getRefundDue(), note.getAmountRefunded(), note.getRefundBalance(), note.getIssuedAt(), note.getLines().stream().map(line -> new CreditNoteLineView(line.getId(), line.getInvoiceLine().getId(), line.getSku(), line.getItemName(), line.getQuantity(), line.getDisposition(), line.getWarehouse().getName(), line.getSubtotal(), line.getTaxAmount(), line.getLineTotal())).toList());
        
    }
}
