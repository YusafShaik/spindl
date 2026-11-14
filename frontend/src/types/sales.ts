export interface QuoteLineSummary {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantity: number;
  unitPrice: number | string;
}

export interface SalesQuote {
  id: string;
  quoteNumber: string;
  status: string;
  customerId: string;
  customerName: string;
  validUntil: string | null;
  notes: string | null;
  createdAt: string;
  total: number | string;
  lines: QuoteLineSummary[];
}

export interface SalesOrderLine {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantity: number;
  shippedQuantity: number;
  invoicedQuantity: number;
  invoiceableQuantity: number;
  reservedQuantity: number;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  unitPrice: number | string;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  status: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  createdAt: string;
  total: number | string;
  lines: SalesOrderLine[];
}

export interface InvoiceLineSummary {
  id: string;
  sku: string;
  itemName: string;
  quantity: number;
  creditedQuantity: number;
  creditEligibleQuantity: number;
  unitPrice: number | string;
  lineTotal: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  grossTotal: number | string;
}

export interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  dueDate: string | null;
  issuedAt: string;
  subtotal: number | string;
  taxCode: string;
  taxRate: number | string;
  taxTotal: number | string;
  total: number | string;
  amountPaid: number | string;
  creditTotal: number | string;
  balance: number | string;
  lines: InvoiceLineSummary[];
}

export interface CustomerCreditLine {
  id: string;
  invoiceLineId: string;
  sku: string;
  itemName: string;
  quantity: number;
  disposition: string;
  warehouseName: string;
  subtotal: number | string;
  taxAmount: number | string;
  total: number | string;
}

export interface CustomerCreditNote {
  id: string;
  creditNumber: string;
  invoiceNumber: string;
  customerName: string;
  reason: string;
  subtotal: number | string;
  taxTotal: number | string;
  total: number | string;
  refundDue: number | string;
  amountRefunded: number | string;
  refundBalance: number | string;
  issuedAt: string;
  lines: CustomerCreditLine[];
}
