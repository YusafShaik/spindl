export type EcoStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'IMPLEMENTED' | 'REJECTED';

export type EcoSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export type ChangeType = 'ADD' | 'REMOVE' | 'QUANTITY_CHANGE';

export type DepartmentType = 'ENGINEERING' | 'MANUFACTURING' | 'QUALITY' | 'FINANCE';

export type SignOffStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface EcoSummary {
  id: string;
  ecoNumber: string;
  title: string;
  reason: string;
  changeSeverity: EcoSeverity;
  finishedItemId: string;
  finishedSku: string;
  finishedItemName: string;
  baseBomId: string | null;
  baseRevision: string;
  targetRevision: string;
  status: EcoStatus;
  effectiveCutoverDate: string;
  signOffsCompleted: number;
  totalSignOffs: number;
  createdByName: string;
  createdAt: string;
  implementedAt: string | null;
}

export interface EcoDiffLine {
  id: string;
  changeType: ChangeType;
  componentItemId: string;
  componentSku: string;
  componentName: string;
  componentUnit: string;
  oldQuantity: number;
  newQuantity: number;
  oldScrapPercent: number;
  newScrapPercent: number;
  notes: string | null;
}

export interface EcoSignOff {
  id: string;
  department: DepartmentType;
  status: SignOffStatus;
  approverName: string | null;
  signOffRole: string | null;
  comments: string | null;
  approvedAt: string | null;
}

export interface EcoDetail {
  id: string;
  ecoNumber: string;
  title: string;
  reason: string;
  changeSeverity: EcoSeverity;
  finishedItemId: string;
  finishedSku: string;
  finishedItemName: string;
  baseBomId: string | null;
  baseRevision: string;
  targetRevision: string;
  status: EcoStatus;
  effectiveCutoverDate: string;
  implementationNotes: string | null;
  implementedBomId: string | null;
  implementedBomRevision: string | null;
  createdByName: string;
  createdAt: string;
  implementedAt: string | null;
  diffLines: EcoDiffLine[];
  signOffs: EcoSignOff[];
}

export interface EngineeringMetrics {
  activeEcos: number;
  pendingSignOffs: number;
  approvedPendingCutover: number;
  implementedRevisions: number;
  criticalSeverityCount: number;
}

export interface CreateDiffLineRequest {
  changeType: ChangeType;
  componentItemId: string;
  oldQuantity: number;
  newQuantity: number;
  oldScrapPercent: number;
  newScrapPercent: number;
  notes?: string;
}

export interface CreateEcoRequest {
  title: string;
  reason: string;
  changeSeverity?: EcoSeverity;
  finishedItemId: string;
  baseBomId?: string;
  targetRevision?: string;
  effectiveCutoverDate: string;
  diffLines?: CreateDiffLineRequest[];
  proposedLines?: CreateDiffLineRequest[];
}

export interface SignOffRequest {
  department: DepartmentType;
  action?: 'APPROVE' | 'REJECT';
  status?: 'APPROVED' | 'REJECTED' | string;
  signOffRole?: string;
  comments?: string;
}

export interface ImplementEcoRequest {
  implementationNotes?: string;
  existingInventoryDisposition?: string;
}

export type EngineeringChangeOrder = EcoSummary;
export type EcoMetrics = EngineeringMetrics;
export type ChangeSeverity = EcoSeverity;
export type ProposedBomLineInput = CreateDiffLineRequest;
export type ProposeEcoRequest = CreateEcoRequest;
export type SubmitSignOffRequest = SignOffRequest;
