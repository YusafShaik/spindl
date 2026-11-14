export interface ItemSummary {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  price: string;
  state: string;
  mark: string;
  tone: string;
  unitPrice: number | string;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  itemType: string;
  barcode?: string | null;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  warehouseId: string;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  quantityDelta: number;
  reason: string;
  sourceReference: string;
  createdAt: string;
}

export interface InventoryMovementPage {
  items: InventoryMovement[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export interface WarehouseSummary {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  branchId: string | null;
}

export interface WarehouseStockSummary {
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  onHand: number;
  reservedQuantity: number;
  qualityHoldQuantity: number;
  availableQuantity: number;
}

export interface InventoryTransfer {
  id: string;
  sku: string;
  itemName: string;
  quantity: number;
  sourceCode: string;
  sourceName: string;
  destinationCode: string;
  destinationName: string;
  reason: string;
  reference: string;
  status: string;
  approvedBy: string | null;
  createdAt: string;
  approvedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
}

export interface CycleCountLine {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
}

export interface CycleCountSession {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  createdBy: string;
  createdAt: string;
  submittedAt: string | null;
  postedAt: string | null;
  lines: CycleCountLine[];
}
