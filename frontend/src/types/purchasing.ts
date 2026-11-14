export interface PurchaseOrderLine {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  billedQuantity: number;
  billableQuantity: number;
  unitPrice: number | string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  status: string;
  supplierId: string;
  supplierName: string;
  notes: string | null;
  createdAt: string;
  total: number | string;
  lines: PurchaseOrderLine[];
}

export interface SupplierSummary {
  id: string;
  code: string;
  name: string;
  email: string | null;
  status: string;
  contactName: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  taxId: string | null;
  paymentTermsDays: number;
  leadTimeDays: number;
  rating: number | string | null;
  notes: string | null;
}

export interface SupplierBillLine {
  id: string;
  sku: string;
  itemName: string;
  quantity: number;
  creditedQuantity: number;
  creditableQuantity: number;
  unitPrice: number | string;
  lineTotal: number | string;
}

export interface SupplierBill {
  id: string;
  billNumber: string;
  status: string;
  purchaseOrderId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  dueDate: string | null;
  issuedAt: string;
  total: number | string;
  amountPaid: number | string;
  amountCredited: number | string;
  balance: number | string;
  lines: SupplierBillLine[];
}

export interface SupplierCreditNote {
  id: string;
  creditNumber: string;
  supplierBillId: string;
  billNumber: string;
  purchaseOrderId: string;
  orderNumber: string;
  supplierName: string;
  reason: string;
  total: number | string;
  creditedUnits: number;
  issuedAt: string;
}

export interface PurchaseRequisitionLine {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantity: number;
}

export interface PurchaseRequisition {
  id: string;
  requisitionNumber: string;
  status: string;
  needByDate: string | null;
  purchaseOrderNumber: string | null;
  lines: PurchaseRequisitionLine[];
}

export interface ReorderSuggestion {
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  availableQuantity: number;
  reorderThreshold: number;
  incomingQuantity: number;
  suggestedQuantity: number;
}
