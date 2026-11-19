export type MrpRunStatus = 'COMPLETED' | 'APPLIED' | 'ARCHIVED';

export type PlannedOrderActionType = 'PURCHASE_ORDER' | 'WORK_ORDER';

export type PlannedOrderUrgency = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';

export type PlannedOrderStatus = 'PENDING' | 'CONVERTED' | 'DISMISSED';

export type DemandSourceType = 'SALES_ORDER' | 'WORK_ORDER_COMPONENT' | 'SAFETY_STOCK' | 'MULTI_LEVEL_BOM';

export interface MrpRun {
  id: string;
  runNumber: string;
  status: MrpRunStatus;
  planningHorizonWeeks: number;
  totalRecommendations: number;
  totalPlannedSpend: number;
  totalShortageUnits: number;
  notes: string | null;
  createdByName: string;
  createdAt: string;
}

export interface PlannedOrder {
  id: string;
  runId: string;
  runNumber: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  itemType: string;
  actionType: PlannedOrderActionType;
  bomId: string | null;
  bomRevision: string | null;
  supplierId: string | null;
  supplierName: string | null;
  recommendedQuantity: number;
  recommendedOrderDate: string;
  requiredByDate: string;
  leadTimeDays: number;
  estimatedUnitCost: number;
  estimatedTotalCost: number;
  urgency: PlannedOrderUrgency;
  demandSourceType: DemandSourceType;
  demandSourceRef: string | null;
  status: PlannedOrderStatus;
  convertedEntityId: string | null;
  convertedOrderNumber: string | null;
  convertedAt: string | null;
  createdAt: string;
}

export interface TimePhasedBucket {
  bucketLabel: string;
  startDate: string;
  endDate: string;
  grossDemand: number;
  scheduledReceipts: number;
  projectedAvailable: number;
  netRequirements: number;
  plannedOrderReleases: number;
}

export interface TimePhasedMatrixRow {
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  itemType: string;
  onHand: number;
  safetyStock: number;
  leadTimeDays: number;
  actionType: PlannedOrderActionType;
  buckets: TimePhasedBucket[];
}

export interface BomExplosionNode {
  itemId: string;
  sku: string;
  itemName: string;
  level: number;
  itemType: string;
  quantityPerUnit: number;
  scrapPercent: number;
  leadTimeDays: number;
  onHand: number;
  available: number;
  netShortage: number;
  actionType: PlannedOrderActionType;
  children: BomExplosionNode[];
}

export interface MrpMetrics {
  totalRuns: number;
  openShortagesCount: number;
  plannedPurchasesCount: number;
  plannedWorkOrdersCount: number;
  totalProjectedSpend: number;
  convertedOrdersCount: number;
}

export interface CalculateMrpRequest {
  planningHorizonWeeks?: number;
  includeSafetyStock?: boolean;
  notes?: string;
}

export interface BatchConvertRequest {
  orderIds: string[];
}

export interface BatchConvertResponse {
  convertedCount: number;
  failedCount: number;
  createdOrderNumbers: string[];
  purchaseOrdersCreated?: number;
  workOrdersCreated?: number;
  messages: string[];
}

export type MrpPlannedOrder = PlannedOrder;
export type MrpMatrixRow = TimePhasedMatrixRow;
export type BomExplosionTree = BomExplosionNode;
export type BatchConvertResult = BatchConvertResponse;
