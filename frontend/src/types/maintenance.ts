export interface AssetSummary {
  id: string;
  code: string;
  name: string;
  workCenterId: string | null;
  workCenterCode: string | null;
  workCenterName: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  status: 'OPERATIONAL' | 'UNDER_MAINTENANCE' | 'DECOMMISSIONED' | string;
  meterHours: number;
  totalMaintenanceCost?: number;
  installationDate: string | null;
  warrantyExpiry: string | null;
  lastServiceDate: string | null;
  nextServiceDueDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface MaintenanceChecklistItem {
  step: string;
  done: boolean;
}

export interface MaintenanceSchedule {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  title: string;
  frequencyType: 'CALENDAR_DAYS' | 'METER_HOURS' | string;
  frequencyInterval: number;
  lastPerformedAt: string | null;
  nextDueDate: string | null;
  checklist: string; // JSON string of MaintenanceChecklistItem[]
  active: boolean;
  createdAt: string;
}

export interface PartConsumed {
  id: string;
  partSource: 'INTERNAL' | 'EXTERNAL' | string;
  itemId?: string | null;
  sku?: string | null;
  itemName?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  externalPartName?: string | null;
  externalPartNumber?: string | null;
  supplierName?: string | null;
  invoiceReference?: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: string;
}

export interface MaintenanceWorkOrder {
  id: string;
  orderNumber: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  workCenterId: string | null;
  workCenterName: string | null;
  scheduleId: string | null;
  scheduleTitle: string | null;
  type: 'PREVENTIVE' | 'BREAKDOWN' | string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY' | string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
  technicianType?: 'INTERNAL' | 'EXTERNAL' | string;
  assignedTechnicianUserId: string | null;
  assignedTechnicianName: string | null;
  externalContractorName?: string | null;
  externalInvoiceRef?: string | null;
  laborCost?: number;
  partsCost?: number;
  totalCost?: number;
  failureSymptom: string | null;
  rootCause: string | null;
  resolutionNotes: string | null;
  downtimeMinutes: number;
  scheduledDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  partsConsumed: PartConsumed[];
}

export interface MaintenanceMetrics {
  totalAssets: number;
  operationalAssets: number;
  underMaintenanceAssets: number;
  openWorkOrders: number;
  criticalBreakdowns: number;
  availabilityPercent: number;
  mtbfHours: number;
  mttrMinutes: number;
  totalPartsConsumedCount: number;
  totalPartsConsumedValue: number;
  totalMaintenanceExpenditure?: number;
}
