export interface ChallanSummary {
  id: string;
  challanNumber: string;
  salesOrderId: string | null;
  orderNumber: string | null;
  customerId: string;
  customerName: string;
  customerCity: string;
  warehouseId: string | null;
  warehouseCode: string;
  status: 'DRAFT' | 'PACKED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  carrierName: string | null;
  carrierMode: 'ROAD' | 'AIR' | 'RAIL' | 'SEA' | 'SELF_PICKUP' | string;
  trackingNumber: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
  driverPhone: string | null;
  ewayBillNumber: string | null;
  ewayBillValidTill: string | null;
  totalPackages: number;
  totalWeightKg: number;
  totalValue: number;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface ChallanPackage {
  id: string;
  packageNumber: string;
  packageType: 'BOX' | 'PALLET' | 'CRATE' | 'BAG' | 'DRUM' | 'CONTAINER' | string;
  weightKg: number;
  dimensionsCm: string | null;
  contentsSummary: string | null;
}

export interface ChallanItem {
  id: string;
  packageId: string | null;
  packageNumber: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  lineTotal: number;
  totalPrice?: number;
  hsnCode: string | null;
}

export interface ChallanDetail {
  summary: ChallanSummary;
  shippingAddress: string;
  notes: string | null;
  podRecipientName: string | null;
  podNotes: string | null;
  packages: ChallanPackage[];
  items: ChallanItem[];
}

export interface LogisticsMetrics {
  activeInTransit: number;
  readyForPickup: number;
  deliveredTotal: number;
  totalWeightKg: number;
  totalDispatchedValue: number;
  onTimeSlaPercent: number;
}
