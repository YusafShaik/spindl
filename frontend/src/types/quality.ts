export interface QualityItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  inspectionRequired: boolean;
  onHand: number;
  heldQuantity: number;
  availableQuantity: number;
}

export interface QualityLot {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  warehouseCode: string;
  warehouseName: string;
  sourceType: string;
  sourceReference: string;
  quantity: number;
  remainingQuantity: number;
  passedQuantity: number;
  rejectedQuantity: number;
  status: string;
  createdAt: string;
}
