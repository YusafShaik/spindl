import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  Factory,
  FileText,
  Filter,
  GitBranch,
  Layers,
  Lock,
  Package,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  User,
  Warehouse as WarehouseIcon,
  Wrench,
  X
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import { formatAuditLabel } from '../../lib/utils/audit-format';
import { CustomFieldEditor } from '../customers/CustomFieldEditor';
import type { ItemSummary, WarehouseSummary } from '../../types/inventory';

export interface BomLine {
  id: string;
  componentItemId: string;
  itemName: string;
  sku: string;
  quantityPerUnit: number;
  scrapAllowancePercent: number;
  alternativeGroup: string | null;
  shortageQuantity: number;
}

export interface RoutingOperation {
  id: string;
  key?: string;
  sequence: number;
  name: string;
  workCenterId: string;
  workCenterCode: string;
  workCenterName: string;
  setupMinutes: number;
  runMinutesPerUnit: number;
  skillRequirements: string | null;
  status: string;
  operatorUserId?: string | null;
  startedAt?: string | null;
  producedQuantity?: number;
  scrapQuantity?: number;
  reworkQuantity?: number;
  actualSetupMinutes?: number | null;
  actualRunMinutes?: number | null;
  downtimeMinutes?: number;
  downtimeReason?: string | null;
}

export interface ManufacturingBom {
  id: string;
  finishedItemId: string;
  finishedSku: string;
  finishedItemName: string;
  revision: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  lines: BomLine[];
  operations: RoutingOperation[];
}

export interface WorkCenter {
  id: string;
  code: string;
  name: string;
  description: string | null;
  laborRatePerHour: number | null;
  overheadRatePerHour: number | null;
  active: boolean;
}

export interface WorkMaterial {
  id: string;
  sku: string;
  itemName: string;
  warehouseName: string;
  requiredQuantity: number;
  issuedQuantity: number;
  returnedQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  unit: string;
}

export interface WorkOrder {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  finishedSku: string;
  finishedItemName: string;
  finishedItemId: string;
  bomRevision: string;
  targetQuantity: number;
  goodQuantity: number;
  scrapQuantity: number;
  reworkQuantity: number;
  dueDate: string | null;
  outputWarehouseId: string;
  outputWarehouseName: string;
  materialCostMethod: string;
  estimatedMaterialCost: number;
  actualMaterialCost: number;
  materialCostVariance: number;
  estimatedLaborCost: number;
  actualLaborCost: number;
  estimatedOverheadCost: number;
  actualOverheadCost: number;
  unpricedMaterialLines: number;
  materials: WorkMaterial[];
  operations: RoutingOperation[];
}

export interface QueueCard {
  id: string;
  workOrderId: string;
  sequence: number;
  orderNumber: string;
  finishedSku: string;
  finishedItemName: string;
  name: string;
  targetQuantity: number;
  dueDate: string | null;
  priority: string;
  status: string;
  operatorUserId: string | null;
}

export interface Operator {
  userId: string;
  name: string;
  email: string;
}

export interface HistoryEvent {
  id: string;
  eventType: string;
  previousStatus: string | null;
  newStatus: string | null;
  actorUserId: string;
  createdAt: string;
}

interface BomDraftLine {
  key: string;
  componentItemId: string;
  quantityPerUnit: number | string;
  scrapAllowancePercent: number | string;
  alternativeGroup: string;
}

interface RoutingDraftLine {
  key: string;
  sequence: number | string;
  name: string;
  workCenterId: string;
  setupMinutes: number | string;
  runMinutesPerUnit: number | string;
  skillRequirements: string;
}

type ManufacturingItem = ItemSummary & { active?: boolean };
type ManufacturingRequest = (path: string, method?: string, payload?: unknown) => Promise<unknown>;

interface ManufacturingPanelProps {
  items: ManufacturingItem[];
  boms: ManufacturingBom[];
  workOrders: WorkOrder[];
  workCenters: WorkCenter[];
  loading: boolean;
  request: ManufacturingRequest;
  notify: (message: string) => void;
  role?: string;
}

type ProductionSubTab = 'work-orders' | 'boms' | 'work-centers' | 'dispatch';

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isQueueCard(value: unknown): value is QueueCard {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.workOrderId === 'string' &&
    typeof value.sequence === 'number' &&
    typeof value.orderNumber === 'string' &&
    typeof value.finishedSku === 'string' &&
    typeof value.finishedItemName === 'string' &&
    typeof value.name === 'string' &&
    typeof value.targetQuantity === 'number' &&
    (typeof value.dueDate === 'string' || value.dueDate === null) &&
    typeof value.priority === 'string' &&
    typeof value.status === 'string' &&
    (typeof value.operatorUserId === 'string' || value.operatorUserId === null)
  );
}

function isOperator(value: unknown): value is Operator {
  return isRecord(value) && typeof value.userId === 'string' && typeof value.name === 'string' && typeof value.email === 'string';
}

function isHistoryEvent(value: unknown): value is HistoryEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.eventType === 'string' &&
    (typeof value.previousStatus === 'string' || value.previousStatus === null) &&
    (typeof value.newStatus === 'string' || value.newStatus === null) &&
    typeof value.actorUserId === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ManufacturingPanel({
  items,
  boms,
  workOrders,
  workCenters,
  loading,
  request,
  notify,
  role
}: ManufacturingPanelProps) {
  const canManage = role !== undefined && ['OWNER', 'ADMIN', 'MANAGER'].includes(role);
  const canViewCosts = role !== undefined && ['OWNER', 'ADMIN', 'MANAGER', 'COST_ANALYST'].includes(role);

  // Sub-Navigation Tab State
  const [activeTab, setActiveTab] = useState<ProductionSubTab>('work-orders');

  // Warehouses Store
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [outputWarehouseId, setOutputWarehouseId] = useState('');

  // UI Filtering & Search State
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderPriorityFilter, setOrderPriorityFilter] = useState('ALL');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Linear Work Order Workspace Selection & Sub-Tabs
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderSubTab, setOrderSubTab] = useState<'routing' | 'materials' | 'cost'>('routing');
  const [issuingMaterial, setIssuingMaterial] = useState<{ order: WorkOrder; material: WorkMaterial } | null>(null);
  const [returningMaterial, setReturningMaterial] = useState<{ order: WorkOrder; material: WorkMaterial } | null>(null);
  const [bulkIssuing, setBulkIssuing] = useState(false);

  const [bomSearch, setBomSearch] = useState('');
  const [bomStatusFilter, setBomStatusFilter] = useState('ALL');

  const [workCenterSearch, setWorkCenterSearch] = useState('');
  const [workCenterStatusFilter, setWorkCenterStatusFilter] = useState('ALL');

  const [dispatchStationFilter, setDispatchStationFilter] = useState('ALL');
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState<'ALL' | 'READY' | 'IN_PROGRESS' | 'QUEUED'>('ALL');
  const [dispatchSearch, setDispatchSearch] = useState('');

  // Modal Dialog States
  const [isPlanOrderModalOpen, setIsPlanOrderModalOpen] = useState(false);
  const [isBomModalOpen, setIsBomModalOpen] = useState(false);
  const [isWorkCenterModalOpen, setIsWorkCenterModalOpen] = useState(false);
  const [outputOrder, setOutputOrder] = useState<WorkOrder | null>(null);
  const [historyBom, setHistoryBom] = useState<ManufacturingBom | null>(null);
  const [historyRows, setHistoryRows] = useState<HistoryEvent[]>([]);

  // BOM Form & Draft Lines
  const [editingBom, setEditingBom] = useState<ManufacturingBom | null>(null);
  const [finishedItemId, setFinishedItemId] = useState('');
  const [revision, setRevision] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [draftLines, setDraftLines] = useState<BomDraftLine[]>([
    { key: crypto.randomUUID(), componentItemId: '', quantityPerUnit: 1, scrapAllowancePercent: 0, alternativeGroup: '' }
  ]);
  const [routingLines, setRoutingLines] = useState<RoutingDraftLine[]>([]);

  // Plan Order Form State
  const [selectedBomId, setSelectedBomId] = useState('');
  const [materialWarehouses, setMaterialWarehouses] = useState<Record<string, string>>({});
  const [alternativeSelections, setAlternativeSelections] = useState<Record<string, string>>({});

  // Station Queue & Operator State
  const [queueCenterId, setQueueCenterId] = useState<string | null>(null);
  const [centerQueue, setCenterQueue] = useState<QueueCard[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Async Busy Indicators
  const [saving, setSaving] = useState(false);
  const [workCenterSaving, setWorkCenterSaving] = useState(false);

  // Load Warehouses
  useEffect(() => {
    let current = true;
    apiFetch(`${API}/inventory/warehouses`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Could not load warehouses'))))
      .then((data: WarehouseSummary[]) => {
        if (current) {
          setWarehouses(data);
          setOutputWarehouseId(data.find((row) => row.isDefault)?.id || data[0]?.id || '');
        }
      })
      .catch((err) => notify(messageFrom(err)));
    return () => {
      current = false;
    };
  }, []);

  // Bulk Issue All Available Materials for a Work Order
  const issueAllAvailableMaterials = async (order: WorkOrder): Promise<void> => {
    const unissued = order.materials.filter(
      (m) => m.requiredQuantity > m.issuedQuantity && m.availableQuantity > 0
    );
    if (unissued.length === 0) {
      notify('No pending materials with available stock in source warehouse.');
      return;
    }
    setBulkIssuing(true);
    setSaving(true);
    try {
      for (const m of unissued) {
        const qtyToIssue = Math.min(m.requiredQuantity - m.issuedQuantity, m.availableQuantity);
        if (qtyToIssue > 0) {
          await request(`/work-orders/${order.id}/materials/${m.id}/issue`, 'POST', {
            quantity: qtyToIssue,
            idempotencyKey: crypto.randomUUID()
          });
        }
      }
      notify(`Successfully issued available materials to ${order.orderNumber}`);
    } catch (err) {
      notify(messageFrom(err));
    } finally {
      setBulkIssuing(false);
      setSaving(false);
    }
  };

  // Request Runner
  const run = async (path: string, method = 'POST', payload?: unknown): Promise<unknown | null> => {
    setSaving(true);
    try {
      const saved = await request(path, method, payload);
      notify('Manufacturing record updated');
      return saved;
    } catch (error: unknown) {
      notify(messageFrom(error));
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Reset BOM Form
  const resetBomForm = () => {
    setEditingBom(null);
    setFinishedItemId('');
    setRevision('');
    setEffectiveFrom('');
    setEffectiveTo('');
    setDraftLines([
      { key: crypto.randomUUID(), componentItemId: '', quantityPerUnit: 1, scrapAllowancePercent: 0, alternativeGroup: '' }
    ]);
    setRoutingLines([]);
    setIsBomModalOpen(false);
  };

  // Open Edit BOM Modal
  const editBom = (bom: ManufacturingBom): void => {
    setEditingBom(bom);
    setFinishedItemId(bom.finishedItemId);
    setRevision(bom.revision);
    setEffectiveFrom(bom.effectiveFrom);
    setEffectiveTo(bom.effectiveTo || '');
    setDraftLines(
      bom.lines.map((line) => ({
        key: line.id,
        componentItemId: line.componentItemId,
        quantityPerUnit: line.quantityPerUnit,
        scrapAllowancePercent: line.scrapAllowancePercent,
        alternativeGroup: line.alternativeGroup || ''
      }))
    );
    setRoutingLines(
      (bom.operations || []).map((op) => ({
        key: op.id,
        sequence: op.sequence,
        name: op.name,
        workCenterId: op.workCenterId,
        setupMinutes: op.setupMinutes,
        runMinutesPerUnit: op.runMinutesPerUnit,
        skillRequirements: op.skillRequirements || ''
      }))
    );
    setIsBomModalOpen(true);
  };

  // Submit BOM (Create or Edit Draft)
  const submitBom = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const lines = draftLines.map((line) => ({
      componentItemId: line.componentItemId,
      quantityPerUnit: Number(line.quantityPerUnit),
      scrapAllowancePercent: Number(line.scrapAllowancePercent),
      alternativeGroup: line.alternativeGroup?.trim() || null
    }));
    const operations = routingLines.map((line) => ({
      sequence: Number(line.sequence),
      name: line.name,
      workCenterId: line.workCenterId,
      setupMinutes: Number(line.setupMinutes),
      runMinutesPerUnit: Number(line.runMinutesPerUnit),
      skillRequirements: line.skillRequirements || null
    }));

    setSaving(true);
    try {
      let bomId: string;
      if (editingBom) {
        bomId = editingBom.id;
        await request(`/boms/${bomId}`, 'PUT', { effectiveFrom, effectiveTo: effectiveTo || null, lines });
        await request(`/boms/${bomId}/routing`, 'PUT', { operations });
      } else {
        const saved = await request('/boms', 'POST', {
          finishedItemId,
          revision,
          effectiveFrom: effectiveFrom || null,
          effectiveTo: effectiveTo || null,
          lines
        });
        if (!isRecord(saved) || typeof saved.id !== 'string') throw new Error('Invalid BOM response');
        bomId = saved.id;
        if (operations.length) await request(`/boms/${bomId}/routing`, 'PUT', { operations });
      }
      resetBomForm();
      notify(editingBom ? 'Draft BOM and routing updated' : 'BOM revision created successfully');
    } catch (error: unknown) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  // Create Work Center
  const createWorkCenter = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setWorkCenterSaving(true);
    try {
      await request('/work-centers', 'POST', {
        code: form.get('code'),
        name: form.get('name'),
        description: form.get('description') || null,
        laborRatePerHour: Number(form.get('laborRatePerHour') || 0),
        overheadRatePerHour: Number(form.get('overheadRatePerHour') || 0)
      });
      element.reset();
      setIsWorkCenterModalOpen(false);
      notify('Work center created successfully');
    } catch (error: unknown) {
      notify(messageFrom(error));
    } finally {
      setWorkCenterSaving(false);
    }
  };

  // Station Queue Viewer
  const showQueue = async (center: WorkCenter): Promise<void> => {
    if (queueCenterId === center.id) {
      setQueueCenterId(null);
      setCenterQueue([]);
      return;
    }
    setQueueCenterId(center.id);
    setQueueLoading(true);
    try {
      const [queue, operatorList] = await Promise.all([
        request(`/work-centers/${center.id}/queue`),
        request('/work-centers/operators')
      ]);
      if (!Array.isArray(queue) || !queue.every(isQueueCard) || !Array.isArray(operatorList) || !operatorList.every(isOperator)) {
        throw new Error('Invalid work center queue response');
      }
      setCenterQueue(queue);
      setOperators(operatorList);
    } catch (error: unknown) {
      notify(messageFrom(error));
      setCenterQueue([]);
    } finally {
      setQueueLoading(false);
    }
  };

  // Assign Operator to Queue Job Card
  const assignOperator = async (card: QueueCard, operatorUserId: string): Promise<void> => {
    if (!queueCenterId) return;
    try {
      await request(`/work-orders/${card.workOrderId}/operations/${card.id}/assign`, 'PATCH', {
        operatorUserId: operatorUserId || null
      });
      const queue = await request(`/work-centers/${queueCenterId}/queue`);
      if (!Array.isArray(queue) || !queue.every(isQueueCard)) throw new Error('Invalid work center queue response');
      setCenterQueue(queue);
      notify(operatorUserId ? 'Job card assigned to operator' : 'Job card unassigned');
    } catch (error: unknown) {
      notify(messageFrom(error));
    }
  };

  // Show BOM History
  const showHistory = async (bom: ManufacturingBom): Promise<void> => {
    try {
      const history = await request(`/boms/${bom.id}/history`);
      if (!Array.isArray(history) || !history.every(isHistoryEvent)) throw new Error('Invalid BOM history response');
      setHistoryBom(bom);
      setHistoryRows(history);
    } catch (error: unknown) {
      notify(messageFrom(error));
    }
  };

  // Active Approved BOMs
  const activeBoms = useMemo(() => boms.filter((bom) => bom.status === 'APPROVED'), [boms]);

  const chosenBomLines = (bom?: ManufacturingBom): BomLine[] => {
    const rows = bom?.lines || [];
    const defaults: Record<string, string> = {};
    for (const line of rows) {
      if (line.alternativeGroup && !defaults[line.alternativeGroup]) {
        defaults[line.alternativeGroup] = line.componentItemId;
      }
    }
    return rows.filter((line) => !line.alternativeGroup || (alternativeSelections[line.alternativeGroup] || defaults[line.alternativeGroup]) === line.componentItemId);
  };

  // Submit Work Order
  const submitWorkOrder = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const selected = activeBoms.find((bom) => bom.id === form.get('bomId'));
    const chosen = chosenBomLines(selected);

    const saved = await run('/work-orders', 'POST', {
      bomId: form.get('bomId'),
      targetQuantity: Number(form.get('targetQuantity')),
      idempotencyKey: crypto.randomUUID(),
      plannedStart: form.get('plannedStart') || null,
      dueDate: form.get('dueDate') || null,
      priority: form.get('priority'),
      outputWarehouseId: form.get('outputWarehouseId'),
      selectedAlternateComponentIds: chosen.filter((line) => line.alternativeGroup).map((line) => line.componentItemId),
      materialAllocations: chosen.map((line) => ({
        componentItemId: line.componentItemId,
        warehouseId: form.get('materialWarehouse-' + line.componentItemId)
      }))
    });

    if (saved) {
      formElement.reset();
      setSelectedBomId('');
      setMaterialWarehouses({});
      setAlternativeSelections({});
      setIsPlanOrderModalOpen(false);
    }
  };

  // Output Submission
  const submitOutput = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!outputOrder) return;
    const form = new FormData(event.currentTarget);
    const byproductId = form.get('byproductItemId');
    const byproductQty = Number(form.get('byproductQuantity') || 0);

    const saved = await run(`/work-orders/${outputOrder.id}/output`, 'POST', {
      goodQuantity: Number(form.get('goodQuantity') || 0),
      scrapQuantity: Number(form.get('scrapQuantity') || 0),
      reworkQuantity: Number(form.get('reworkQuantity') || 0),
      byproducts:
        byproductId && byproductQty > 0
          ? [
              {
                itemId: byproductId,
                warehouseId: form.get('byproductWarehouseId'),
                quantity: byproductQty
              }
            ]
          : [],
      idempotencyKey: crypto.randomUUID()
    });

    if (saved) {
      setOutputOrder(null);
    }
  };

  // Telemetry Calculations
  const today = new Date().toISOString().slice(0, 10);
  const openOrders = useMemo(() => workOrders.filter((o) => ['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(o.status)), [workOrders]);
  const inProgressOrders = useMemo(() => workOrders.filter((o) => o.status === 'IN_PROGRESS'), [workOrders]);
  const releasedOrders = useMemo(() => workOrders.filter((o) => o.status === 'RELEASED'), [workOrders]);
  const lateOrders = useMemo(() => openOrders.filter((o) => o.dueDate && o.dueDate < today), [openOrders, today]);
  const materialBlocked = useMemo(() => workOrders.filter((o) => o.status === 'DRAFT' && o.materials.some((l) => l.shortageQuantity > 0)), [workOrders]);

  const allRoutingOperations = useMemo(() => workOrders.flatMap((order) => order.operations || []), [workOrders]);
  const completedOperations = useMemo(() => allRoutingOperations.filter((op) => op.status === 'COMPLETED').length, [allRoutingOperations]);
  const activeOperationsCount = useMemo(() => allRoutingOperations.filter((op) => op.status === 'IN_PROGRESS').length, [allRoutingOperations]);
  const activeWorkCenters = useMemo(() => workCenters.filter((wc) => wc.active), [workCenters]);

  // Filtered Lists
  const visibleOrders = useMemo(() => {
    let result = workOrders;
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.finishedSku.toLowerCase().includes(q) ||
          o.finishedItemName.toLowerCase().includes(q)
      );
    }
    if (orderStatusFilter !== 'ALL') {
      result = result.filter((o) => o.status === orderStatusFilter);
    }
    if (orderPriorityFilter !== 'ALL') {
      result = result.filter((o) => o.priority === orderPriorityFilter);
    }
    return result;
  }, [workOrders, orderSearch, orderStatusFilter, orderPriorityFilter]);

  const filteredBoms = useMemo(() => {
    let result = boms;
    if (bomSearch.trim()) {
      const q = bomSearch.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.finishedSku.toLowerCase().includes(q) ||
          b.finishedItemName.toLowerCase().includes(q) ||
          b.revision.toLowerCase().includes(q)
      );
    }
    if (bomStatusFilter !== 'ALL') {
      result = result.filter((b) => b.status === bomStatusFilter);
    }
    return result;
  }, [boms, bomSearch, bomStatusFilter]);

  const filteredWorkCenters = useMemo(() => {
    let result = workCenters;
    if (workCenterSearch.trim()) {
      const q = workCenterSearch.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }
    if (workCenterStatusFilter === 'ACTIVE') {
      result = result.filter((c) => c.active);
    } else if (workCenterStatusFilter === 'INACTIVE') {
      result = result.filter((c) => !c.active);
    }
    return result;
  }, [workCenters, workCenterSearch, workCenterStatusFilter]);

  const allJobCards = useMemo(() => {
    const list: Array<{ operation: RoutingOperation; order: WorkOrder; prevIncomplete: boolean }> = [];
    workOrders.forEach((wo) => {
      (wo.operations || []).forEach((op) => {
        if (op.status === 'IN_PROGRESS' || op.status === 'PENDING') {
          const prevIncomplete = (wo.operations || []).some(
            (prev) => prev.sequence < op.sequence && prev.status !== 'COMPLETED'
          );
          list.push({ operation: op, order: wo, prevIncomplete });
        }
      });
    });
    return list;
  }, [workOrders]);

  const filteredJobCards = useMemo(() => {
    let list = allJobCards;
    if (dispatchStationFilter !== 'ALL') {
      list = list.filter((item) => item.operation.workCenterId === dispatchStationFilter);
    }
    if (dispatchStatusFilter === 'READY') {
      list = list.filter((item) => item.operation.status === 'PENDING' && !item.prevIncomplete);
    } else if (dispatchStatusFilter === 'IN_PROGRESS') {
      list = list.filter((item) => item.operation.status === 'IN_PROGRESS');
    } else if (dispatchStatusFilter === 'QUEUED') {
      list = list.filter((item) => item.operation.status === 'PENDING' && item.prevIncomplete);
    }
    if (dispatchSearch.trim()) {
      const q = dispatchSearch.toLowerCase();
      list = list.filter(
        (item) =>
          item.operation.name.toLowerCase().includes(q) ||
          item.operation.workCenterCode.toLowerCase().includes(q) ||
          item.operation.workCenterName.toLowerCase().includes(q) ||
          item.order.orderNumber.toLowerCase().includes(q) ||
          item.order.finishedSku.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allJobCards, dispatchStationFilter, dispatchStatusFilter, dispatchSearch]);

  const readyJobCardsCount = useMemo(
    () => allJobCards.filter((item) => item.operation.status === 'PENDING' && !item.prevIncomplete).length,
    [allJobCards]
  );
  const inProgressJobCardsCount = useMemo(
    () => allJobCards.filter((item) => item.operation.status === 'IN_PROGRESS').length,
    [allJobCards]
  );
  const queuedJobCardsCount = useMemo(
    () => allJobCards.filter((item) => item.operation.status === 'PENDING' && item.prevIncomplete).length,
    [allJobCards]
  );

  const shopFloorJobCards = filteredJobCards;

  // CSV Exporters
  const exportWorkOrdersCsv = () => {
    const headers = ['Order #', 'SKU', 'Item Name', 'Revision', 'Target Qty', 'Good Qty', 'Scrap Qty', 'Status', 'Priority', 'Due Date', 'Output Warehouse'];
    const rows = visibleOrders.map((o) => [
      o.orderNumber,
      o.finishedSku,
      o.finishedItemName,
      o.bomRevision,
      o.targetQuantity,
      o.goodQuantity,
      o.scrapQuantity,
      o.status,
      o.priority,
      o.dueDate || '—',
      o.outputWarehouseName
    ]);
    downloadCsv(`spindl-work-orders-${today}.csv`, headers, rows);
    notify('Work orders exported as CSV');
  };

  const exportBomsCsv = () => {
    const headers = ['SKU', 'Finished Item', 'Revision', 'Status', 'Effective From', 'Effective To', 'Components Count', 'Routing Ops Count'];
    const rows = filteredBoms.map((b) => [
      b.finishedSku,
      b.finishedItemName,
      b.revision,
      b.status,
      b.effectiveFrom,
      b.effectiveTo || '—',
      b.lines.length,
      b.operations.length
    ]);
    downloadCsv(`spindl-boms-${today}.csv`, headers, rows);
    notify('Bills of material exported as CSV');
  };

  const exportWorkCentersCsv = () => {
    const headers = ['Code', 'Name', 'Description', 'Labor Rate / Hr', 'Overhead Rate / Hr', 'Status'];
    const rows = filteredWorkCenters.map((c) => [
      c.code,
      c.name,
      c.description || '—',
      c.laborRatePerHour != null ? c.laborRatePerHour : 'Restricted',
      c.overheadRatePerHour != null ? c.overheadRatePerHour : 'Restricted',
      c.active ? 'ACTIVE' : 'INACTIVE'
    ]);
    downloadCsv(`spindl-work-centers-${today}.csv`, headers, rows);
    notify('Work centers exported as CSV');
  };

  const isDetailView = Boolean(selectedOrderId && workOrders.some((o) => o.id === selectedOrderId));
  const activeOrder = isDetailView ? workOrders.find((o) => o.id === selectedOrderId)! : null;

  return (
    <div className="reports-screen-layout production-screen-layout">
      {isDetailView && activeOrder ? (
        (() => {
          const order = activeOrder;
          const completedOps = (order.operations || []).filter((op) => op.status === 'COMPLETED').length;
          const totalOps = (order.operations || []).length;
          const pctOps = totalOps > 0 ? Math.round((completedOps / totalOps) * 100) : 0;
          const pctUnits = order.targetQuantity > 0 ? Math.min(100, Math.round((order.goodQuantity / order.targetQuantity) * 100)) : 0;
          const isPastDue = order.dueDate && order.dueDate < today && !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(order.status);
          const hasShortages = order.materials.some((m) => m.shortageQuantity > 0);
          const allOpsCompleted = totalOps > 0 && completedOps === totalOps;
          const totalIssuedMaterials = order.materials.filter((m) => m.issuedQuantity >= m.requiredQuantity).length;

          return (
            <div className="production-linear-container">
              {/* Linear Top Breadcrumbs & Actions Bar */}
              <div className="production-linear-header">
                <div className="production-linear-breadcrumbs">
                  <button
                    type="button"
                    className="crumb-link"
                    onClick={() => setSelectedOrderId(null)}
                    title="Return to Work Orders register"
                  >
                    <ArrowLeft size={13} />
                    <span>Work Orders</span>
                  </button>
                  <span className="crumb-sep">/</span>
                  <span className="crumb-current">{order.orderNumber}</span>

                  <select
                    className="production-order-select"
                    style={{ height: '26px', fontSize: '11.5px', marginLeft: '4px' }}
                    value={selectedOrderId || ''}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    aria-label="Switch active work order"
                  >
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.orderNumber} — {wo.finishedSku}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="production-linear-actions">
                  {order.status === 'DRAFT' && canManage && (
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={saving || hasShortages}
                      onClick={() => run(`/work-orders/${order.id}/release`)}
                      style={{ height: '28px', fontSize: '12px' }}
                      title={hasShortages ? 'Resolve material shortages before releasing to floor' : ''}
                    >
                      Check Stock & Release
                    </button>
                  )}

                  {['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(order.status) && canManage && (
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => setOutputOrder(order)}
                      disabled={!allOpsCompleted}
                      title={!allOpsCompleted ? 'Complete all shop floor routing operations before recording output' : ''}
                      style={{ height: '28px', fontSize: '12px' }}
                    >
                      <Package size={13} />
                      <span>Record Output</span>
                    </button>
                  )}

                  {order.status === 'IN_PROGRESS' && (
                    <button
                      type="button"
                      className="mini-action muted"
                      onClick={() => run(`/work-orders/${order.id}/pause`)}
                      style={{ height: '28px', fontSize: '11.5px' }}
                    >
                      <Pause size={12} />
                      <span>Pause</span>
                    </button>
                  )}

                  {order.status === 'PAUSED' && (
                    <button
                      type="button"
                      className="mini-action"
                      onClick={() => run(`/work-orders/${order.id}/resume`)}
                      style={{ height: '28px', fontSize: '11.5px' }}
                    >
                      <Play size={12} />
                      <span>Resume</span>
                    </button>
                  )}

                  {order.status === 'COMPLETED' && canManage && (
                    <button
                      type="button"
                      className="mini-action"
                      onClick={() => run(`/work-orders/${order.id}/close`)}
                      style={{ height: '28px', fontSize: '11.5px' }}
                    >
                      <Check size={12} />
                      <span>Close Order</span>
                    </button>
                  )}

                  {['DRAFT', 'RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(order.status) && canManage && (
                    <button
                      type="button"
                      className="mini-action muted"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to cancel work order ${order.orderNumber}?`)) {
                          run(`/work-orders/${order.id}/cancel`);
                        }
                      }}
                      style={{ height: '28px', fontSize: '11.5px' }}
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>

              {/* 2-Column Linear Split Grid (Main ~70% / Sidebar ~30%) */}
              <div className="production-linear-grid">
                {/* Left Main Content */}
                <div className="production-linear-main">
                  {/* Title & Description Block */}
                  <div className="production-linear-title-block">
                    <div className="production-linear-ref-row">
                      <span className="order-number-pill" style={{ fontWeight: 600 }}>{order.orderNumber}</span>
                      <Status label={formatAuditLabel(order.status)} />
                      <span className={`priority-tag priority-${order.priority.toLowerCase()}`}>
                        {order.priority}
                      </span>
                      <span className="revision-tag">Rev {order.bomRevision}</span>
                      {isPastDue && <span className="past-due-badge">Past Due</span>}
                    </div>

                    <h1 className="production-linear-h1">{order.finishedSku}</h1>
                    <p className="production-linear-desc">{order.finishedItemName}</p>
                  </div>

                  {/* Linear Sub-Tabs */}
                  <div className="production-linear-tabs">
                    <button
                      type="button"
                      className={`production-linear-tab ${orderSubTab === 'routing' ? 'active' : ''}`}
                      onClick={() => setOrderSubTab('routing')}
                    >
                      <Wrench size={13} />
                      <span>Shop Floor Routing</span>
                      <span className="production-linear-tab-count">{totalOps}</span>
                    </button>

                    <button
                      type="button"
                      className={`production-linear-tab ${orderSubTab === 'materials' ? 'active' : ''}`}
                      onClick={() => setOrderSubTab('materials')}
                    >
                      <Boxes size={13} />
                      <span>Component Materials</span>
                      <span className="production-linear-tab-count">
                        {totalIssuedMaterials}/{order.materials.length}
                      </span>
                    </button>

                    {canViewCosts && (
                      <button
                        type="button"
                        className={`production-linear-tab ${orderSubTab === 'cost' ? 'active' : ''}`}
                        onClick={() => setOrderSubTab('cost')}
                      >
                        <FileText size={13} />
                        <span>Cost & Variance</span>
                      </button>
                    )}
                  </div>

                  {/* SUB-TAB 1: SHOP FLOOR ROUTING PIPELINE */}
                  {orderSubTab === 'routing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="linear-routing-list">
                        {order.operations && order.operations.length > 0 ? (
                          order.operations.map((op) => {
                            const isOpPending = op.status === 'PENDING';
                            const isOpInProgress = op.status === 'IN_PROGRESS';
                            const isOpCompleted = op.status === 'COMPLETED';
                            const prevIncomplete = order.operations.some(
                              (prev) => prev.sequence < op.sequence && prev.status !== 'COMPLETED'
                            );
                            const plannedRunTime = Math.ceil(Number(op.runMinutesPerUnit) * order.targetQuantity);

                            return (
                              <div
                                key={op.id}
                                className={`linear-routing-item ${op.status.toLowerCase()}`}
                              >
                                <div className="linear-routing-row">
                                  <div className="linear-routing-left">
                                    <div className="linear-routing-status-icon">
                                      {isOpCompleted ? (
                                        <CheckCircle2 size={16} color="var(--sp-success)" />
                                      ) : isOpInProgress ? (
                                        <Activity size={16} color="var(--sp-brand)" className="spin" />
                                      ) : prevIncomplete ? (
                                        <Lock size={13} color="var(--sp-text-muted)" />
                                      ) : (
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid var(--sp-border-hover)' }} />
                                      )}
                                    </div>

                                    <div className="linear-routing-body">
                                      <div className="linear-routing-title-line">
                                        <span className="sequence-badge">OP {String(op.sequence).padStart(2, '0')}</span>
                                        <span className="station-code-pill">{op.workCenterCode}</span>
                                        <span className="linear-routing-op-name">{op.name}</span>
                                      </div>
                                      <div className="linear-routing-meta-line">
                                        <span>{op.workCenterName}</span>
                                        {op.skillRequirements && (
                                          <>
                                            <span>·</span>
                                            <span>Skill: {op.skillRequirements}</span>
                                          </>
                                        )}
                                        <span>·</span>
                                        <span>Planned: {op.setupMinutes}m setup + {plannedRunTime}m run</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="linear-routing-right">
                                    <Status label={formatAuditLabel(op.status)} />

                                    {isOpPending && ['RELEASED', 'IN_PROGRESS'].includes(order.status) && (
                                      prevIncomplete ? (
                                        <span
                                          className="linear-routing-locked-tag"
                                          title="Complete previous routing operations before starting this station"
                                        >
                                          <Lock size={11} />
                                          <span>Locked</span>
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="button button-primary"
                                          disabled={saving}
                                          onClick={() => run(`/work-orders/${order.id}/operations/${op.id}/start`)}
                                          style={{ height: '26px', padding: '0 10px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                        >
                                          <Play size={11} />
                                          <span>Start Job Card</span>
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>

                                {/* Operation Active Execution Form */}
                                {isOpInProgress && (
                                  <div className="production-op-active-card" style={{ margin: '4px 16px 14px 16px' }}>
                                    <div className="production-op-active-header">
                                      <Activity size={13} className="spin" />
                                      <span>Station active · Started {op.startedAt ? new Date(op.startedAt).toLocaleTimeString() : 'recently'} · Log operational output</span>
                                    </div>

                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        const form = new FormData(e.currentTarget);
                                        run(`/work-orders/${order.id}/operations/${op.id}/complete`, 'POST', {
                                          producedQuantity: Number(form.get('producedQuantity')),
                                          scrapQuantity: Number(form.get('scrapQuantity')),
                                          reworkQuantity: Number(form.get('reworkQuantity') || 0),
                                          actualSetupMinutes: Number(form.get('actualSetupMinutes')),
                                          actualRunMinutes: Number(form.get('actualRunMinutes')),
                                          downtimeMinutes: Number(form.get('downtimeMinutes')),
                                          downtimeReason: form.get('downtimeReason') || null,
                                          idempotencyKey: crypto.randomUUID()
                                        });
                                      }}
                                      style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                                    >
                                      <div className="production-op-form-grid">
                                        <div className="production-form-field">
                                          <label>Produced (Good)</label>
                                          <input
                                            name="producedQuantity"
                                            type="number"
                                            min="0"
                                            max={order.targetQuantity}
                                            defaultValue={order.targetQuantity}
                                            required
                                          />
                                        </div>

                                        <div className="production-form-field">
                                          <label>Scrap Units</label>
                                          <input
                                            name="scrapQuantity"
                                            type="number"
                                            min="0"
                                            max={order.targetQuantity}
                                            defaultValue="0"
                                            required
                                          />
                                        </div>

                                        <div className="production-form-field">
                                          <label>Rework Units</label>
                                          <input
                                            name="reworkQuantity"
                                            type="number"
                                            min="0"
                                            max={order.targetQuantity}
                                            defaultValue="0"
                                            required
                                          />
                                        </div>

                                        <div className="production-form-field">
                                          <label>Setup (min)</label>
                                          <input
                                            name="actualSetupMinutes"
                                            type="number"
                                            min="0"
                                            defaultValue={op.setupMinutes}
                                            required
                                          />
                                        </div>

                                        <div className="production-form-field">
                                          <label>Run (min)</label>
                                          <input
                                            name="actualRunMinutes"
                                            type="number"
                                            min="0"
                                            defaultValue={plannedRunTime}
                                            required
                                          />
                                        </div>

                                        <div className="production-form-field">
                                          <label>Downtime (min)</label>
                                          <input
                                            name="downtimeMinutes"
                                            type="number"
                                            min="0"
                                            defaultValue="0"
                                          />
                                        </div>

                                        <div className="production-form-field" style={{ gridColumn: 'span 2' }}>
                                          <label>Downtime Reason</label>
                                          <input
                                            name="downtimeReason"
                                            maxLength={240}
                                            placeholder="Explain cause if downtime recorded…"
                                          />
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                                        <button
                                          type="submit"
                                          className="button button-primary"
                                          disabled={saving}
                                          style={{ height: '30px', fontSize: '12px' }}
                                        >
                                          <Check size={13} />
                                          <span>Complete Operation & Advance Step</span>
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                )}

                                {/* Operation Completed Summary */}
                                {isOpCompleted && (
                                  <div style={{ padding: '0 16px 12px 50px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                                    <CheckCircle2 size={13} color="var(--sp-success)" />
                                    <span>
                                      <b>{op.producedQuantity} units completed</b> · {op.scrapQuantity} scrap · {op.reworkQuantity} rework · {op.actualSetupMinutes ?? 0}m setup · {op.actualRunMinutes ?? 0}m run
                                      {op.downtimeMinutes ? ` · ${op.downtimeMinutes}m downtime (${op.downtimeReason})` : ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                            No shop floor operations defined for this work order revision.
                          </div>
                        )}
                      </div>

                      {/* Rework Disposition Bar if rework exists */}
                      {order.reworkQuantity > 0 && ['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(order.status) && (
                        <div style={{ background: 'var(--sp-warning-soft)', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--sp-warning)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--sp-text)' }}>
                            <b>{order.reworkQuantity} Units Awaiting Rework Disposition</b>
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)' }}>Log inspected rework into good units or scrap.</div>
                          </div>

                          <form
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = new FormData(e.currentTarget);
                              const good = Number(form.get('goodQuantity') || 0);
                              const scrap = Number(form.get('scrapQuantity') || 0);
                              if (good + scrap === 0) {
                                notify('Enter reworked good or scrap quantity');
                                return;
                              }
                              run(`/work-orders/${order.id}/rework/disposition`, 'POST', {
                                quantity: good + scrap,
                                goodQuantity: good,
                                scrapQuantity: scrap,
                                idempotencyKey: crypto.randomUUID()
                              });
                              e.currentTarget.reset();
                            }}
                          >
                            <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              Good:
                              <input name="goodQuantity" type="number" min="0" max={order.reworkQuantity} defaultValue="0" className="warehouse-count-input" style={{ width: '56px', height: '26px' }} />
                            </label>
                            <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              Scrap:
                              <input name="scrapQuantity" type="number" min="0" max={order.reworkQuantity} defaultValue="0" className="warehouse-count-input" style={{ width: '56px', height: '26px' }} />
                            </label>
                            <button className="button button-primary" style={{ height: '26px', fontSize: '11.5px' }} disabled={saving}>
                              Complete Rework
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-TAB 2: COMPONENT MATERIALS */}
                  {orderSubTab === 'materials' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--sp-text-secondary)', fontWeight: 500 }}>
                          {order.materials.length} components allocated from warehouse inventory
                        </span>

                        {['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(order.status) && canManage && (
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => issueAllAvailableMaterials(order)}
                            disabled={saving || bulkIssuing || !order.materials.some((m) => m.requiredQuantity > m.issuedQuantity && m.availableQuantity > 0)}
                            style={{ height: '28px', fontSize: '11.5px' }}
                            title="Issue all allocated materials that currently have available stock in the source warehouse"
                          >
                            <Sparkles size={12} />
                            <span>{bulkIssuing ? 'Issuing…' : 'Issue All Available Stock'}</span>
                          </button>
                        )}
                      </div>

                      <div className="sales-table-card">
                        <div className="sales-table-scroll">
                          <table className="sales-table">
                            <thead>
                              <tr>
                                <th style={{ width: '28%' }}>COMPONENT ITEM</th>
                                <th style={{ width: '18%' }}>SOURCE WAREHOUSE</th>
                                <th style={{ width: '12%', textAlign: 'right' }}>REQUIRED</th>
                                <th style={{ width: '12%', textAlign: 'right' }}>ISSUED</th>
                                <th style={{ width: '12%', textAlign: 'right' }}>IN STOCK</th>
                                <th style={{ width: '10%' }}>ALLOCATION</th>
                                {['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(order.status) && (
                                  <th style={{ width: '8%', textAlign: 'right' }}>ACTIONS</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {order.materials.map((material) => {
                                const pendingIssue = Math.max(0, material.requiredQuantity - material.issuedQuantity);
                                const isFullyIssued = pendingIssue === 0;
                                const hasWarehouseStock = material.availableQuantity >= pendingIssue;
                                const shortageQty = material.shortageQuantity > 0 ? material.shortageQuantity : (!hasWarehouseStock ? pendingIssue - material.availableQuantity : 0);

                                return (
                                  <tr key={material.id} className="sales-row">
                                    <td style={{ maxWidth: '240px' }}>
                                      <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px' }}>{material.sku}</div>
                                      <div style={{ color: 'var(--sp-text-secondary)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '230px' }}>
                                        {material.itemName}
                                      </div>
                                    </td>
                                    <td style={{ color: 'var(--sp-text-secondary)', fontSize: '12px' }}>{material.warehouseName}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                                      {material.requiredQuantity} {material.unit}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                                      <span style={{ fontWeight: 600, color: isFullyIssued ? 'var(--sp-success)' : 'var(--sp-text)' }}>
                                        {material.issuedQuantity}
                                      </span>
                                      {material.returnedQuantity > 0 && (
                                        <small style={{ color: 'var(--sp-text-muted)' }}> ({material.returnedQuantity} ret)</small>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                                      {material.availableQuantity}
                                    </td>
                                    <td>
                                      {isFullyIssued ? (
                                        <span className="production-mat-status-tag complete">Fully Issued</span>
                                      ) : shortageQty > 0 ? (
                                        <span className="production-mat-status-tag shortage">Shortage: {shortageQty}</span>
                                      ) : (
                                        <span className="production-mat-status-tag ok">Ready ({pendingIssue})</span>
                                      )}
                                    </td>
                                    {['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(order.status) && (
                                      <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                          {!isFullyIssued && (
                                            <button
                                              type="button"
                                              className="mini-action"
                                              disabled={saving || material.availableQuantity === 0}
                                              onClick={() => setIssuingMaterial({ order, material })}
                                              style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                                              title={material.availableQuantity === 0 ? 'No stock available in warehouse' : 'Issue component'}
                                            >
                                              Issue
                                            </button>
                                          )}
                                          {material.issuedQuantity > material.returnedQuantity && (
                                            <button
                                              type="button"
                                              className="mini-action muted"
                                              disabled={saving}
                                              onClick={() => setReturningMaterial({ order, material })}
                                              style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                                              title="Return unused components to warehouse"
                                            >
                                              Return
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 3: COSTING & FINANCIAL TELEMETRY */}
                  {orderSubTab === 'cost' && canViewCosts && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="production-cost-strip">
                        <div className="production-cost-item">
                          <span className="label">EST. MATERIAL</span>
                          <span className="val">{formatCurrency(order.estimatedMaterialCost)}</span>
                        </div>
                        <div className="production-cost-item">
                          <span className="label">ACTUAL ISSUED</span>
                          <span className="val">{formatCurrency(order.actualMaterialCost)}</span>
                        </div>
                        <div className="production-cost-item">
                          <span className="label">COST VARIANCE</span>
                          <span
                            className="val"
                            style={{
                              color: order.materialCostVariance > 0
                                ? 'var(--sp-danger)'
                                : order.materialCostVariance < 0 && order.actualMaterialCost > 0
                                ? 'var(--sp-success)'
                                : 'var(--sp-text)'
                            }}
                          >
                            {formatCurrency(order.materialCostVariance)}
                          </span>
                        </div>
                        <div className="production-cost-item">
                          <span className="label">LABOR (ACTUAL / EST)</span>
                          <span className="val">
                            {formatCurrency(order.actualLaborCost)} / {formatCurrency(order.estimatedLaborCost)}
                          </span>
                        </div>
                        <div className="production-cost-item">
                          <span className="label">OVERHEAD (ACTUAL / EST)</span>
                          <span className="val">
                            {formatCurrency(order.actualOverheadCost)} / {formatCurrency(order.estimatedOverheadCost)}
                          </span>
                        </div>
                      </div>

                      <div className="reports-note-box" style={{ margin: 0, fontSize: '12px' }}>
                        Cost telemetry tracks standard BOM item issue valuations, machine hourly rates, and operator labor accumulated across shop floor operations.
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Sidebar: Linear Properties Inspector */}
                <div className="production-linear-sidebar">
                  {/* 1. Properties Card */}
                  <div className="production-sidebar-card">
                    <span className="production-sidebar-card-title">Properties</span>

                    <div className="production-sidebar-prop-row">
                      <span className="production-sidebar-prop-label">Status</span>
                      <span className="production-sidebar-prop-val">
                        <Status label={formatAuditLabel(order.status)} />
                      </span>
                    </div>

                    <div className="production-sidebar-prop-row">
                      <span className="production-sidebar-prop-label">Priority</span>
                      <span className="production-sidebar-prop-val">
                        <span className={`priority-tag priority-${order.priority.toLowerCase()}`}>
                          {order.priority}
                        </span>
                      </span>
                    </div>

                    <div className="production-sidebar-prop-row">
                      <span className="production-sidebar-prop-label">BOM Revision</span>
                      <span className="production-sidebar-prop-val">
                        <span className="revision-tag">Rev {order.bomRevision}</span>
                      </span>
                    </div>

                    <div className="production-sidebar-prop-row">
                      <span className="production-sidebar-prop-label">Destination</span>
                      <span className="production-sidebar-prop-val">
                        <WarehouseIcon size={12} style={{ color: 'var(--sp-text-muted)' }} />
                        <span>{order.outputWarehouseName}</span>
                      </span>
                    </div>
                  </div>

                  {/* 2. Execution Telemetry Card */}
                  <div className="production-sidebar-card">
                    <span className="production-sidebar-card-title">Execution Progress</span>

                    <div className="production-sidebar-progress-group">
                      <div className="production-sidebar-progress-header">
                        <span>Units Produced ({order.goodQuantity} / {order.targetQuantity})</span>
                        <span className="val">{pctUnits}%</span>
                      </div>
                      <div className="production-cell-progress-bar" style={{ maxWidth: '100%' }}>
                        <div className="production-cell-progress-fill" style={{ width: `${pctUnits}%` }} />
                      </div>
                    </div>

                    <div className="production-sidebar-progress-group">
                      <div className="production-sidebar-progress-header">
                        <span>Routing Steps ({completedOps} / {totalOps} ops)</span>
                        <span className="val">{pctOps}%</span>
                      </div>
                      <div className="production-cell-progress-bar" style={{ maxWidth: '100%' }}>
                        <div className="production-cell-progress-fill" style={{ width: `${pctOps}%` }} />
                      </div>
                    </div>

                    <div className="production-sidebar-prop-row" style={{ paddingTop: '4px' }}>
                      <span className="production-sidebar-prop-label">Target Completion</span>
                      <span className="production-sidebar-prop-val">
                        <Calendar size={12} style={{ color: 'var(--sp-text-muted)' }} />
                        <span>{order.dueDate || 'Unscheduled'}</span>
                        {isPastDue ? (
                          <span className="past-due-badge" style={{ fontSize: '9px', padding: '1px 4px' }}>Overdue</span>
                        ) : (
                          <span style={{ fontSize: '10.5px', color: 'var(--sp-success)' }}>On Schedule</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* 3. Metadata & Attributes Card */}
                  <div className="production-sidebar-card">
                    <span className="production-sidebar-card-title">Order Attributes</span>
                    <CustomFieldEditor resource="work_orders" recordId={order.id} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        <>
      {/* 1. Executive Telemetry Strip — Quiet Monochrome Linear Cards */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">ACTIVE WORK ORDERS</span>
            <Factory size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">{openOrders.length} Active</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{inProgressOrders.length} in production</span> · {releasedOrders.length} released to floor
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">ROUTING PROGRESS</span>
            <GitBranch size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">
            {completedOperations} / {allRoutingOperations.length} Steps
          </div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{activeOperationsCount} active</span> running across stations
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">SCHEDULE & CRITICALITY</span>
            <Clock size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">
            {lateOrders.length > 0 ? `${lateOrders.length} Past Due` : 'On Schedule'}
          </div>
          <div className="sales-metric-sub">
            {materialBlocked.length > 0 ? (
              <span className="sales-sub-warning">{materialBlocked.length} component shortages</span>
            ) : (
              'All component allocations fulfilled'
            )}
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">BOM & CAPACITY</span>
            <Layers size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">{activeBoms.length} Approved BOMs</div>
          <div className="sales-metric-sub">
            {activeWorkCenters.length} active stations across shop floor
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'work-orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('work-orders')}
          >
            <ClipboardList size={13} />
            <span>Work Orders</span>
            <span className="sales-subnav-badge">{workOrders.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'boms' ? 'active' : ''}`}
            onClick={() => setActiveTab('boms')}
          >
            <Layers size={13} />
            <span>Bills of Material</span>
            <span className="sales-subnav-badge">{boms.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'work-centers' ? 'active' : ''}`}
            onClick={() => setActiveTab('work-centers')}
          >
            <Factory size={13} />
            <span>Work Centers</span>
            <span className="sales-subnav-badge">{workCenters.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'dispatch' ? 'active' : ''}`}
            onClick={() => setActiveTab('dispatch')}
          >
            <Activity size={13} />
            <span>Shop Floor Dispatch</span>
            <span className="sales-subnav-badge">{allJobCards.length}</span>
          </button>
        </div>

        <div className="sales-subnav-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void run('/work-orders')}
            disabled={loading || saving}
            title="Refresh manufacturing data"
            style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
          >
            <RefreshCw size={13} className={loading || saving ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {canManage && activeTab === 'boms' && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                resetBomForm();
                setIsBomModalOpen(true);
              }}
              style={{ height: '30px', fontSize: '12.5px' }}
            >
              <Plus size={13} />
              <span>Create BOM</span>
            </button>
          )}

          {canManage && activeTab === 'work-centers' && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsWorkCenterModalOpen(true)}
              style={{ height: '30px', fontSize: '12.5px' }}
            >
              <Plus size={13} />
              <span>Add Work Center</span>
            </button>
          )}

          {canManage && activeTab === 'work-orders' && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsPlanOrderModalOpen(true)}
              disabled={activeBoms.length === 0}
              title={activeBoms.length === 0 ? 'Approve a BOM revision before planning work orders' : ''}
              style={{ height: '30px', fontSize: '12.5px' }}
            >
              <Plus size={13} />
              <span>Plan Work Order</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. TAB 1: WORK ORDERS */}
      {activeTab === 'work-orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Master Work Orders Register Table View */}
              {/* Action Control Bar */}
              <div className="sales-toolbar">
                <div className="sales-pill-group">
                  <button
                    type="button"
                    className={`sales-pill-btn ${orderStatusFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setOrderStatusFilter('ALL')}
                  >
                    <span>All</span>
                    <span className="sales-pill-count">{workOrders.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${orderStatusFilter === 'RELEASED' ? 'active' : ''}`}
                    onClick={() => setOrderStatusFilter('RELEASED')}
                  >
                    <span>Released</span>
                    <span className="sales-pill-count">{workOrders.filter((o) => o.status === 'RELEASED').length}</span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${orderStatusFilter === 'IN_PROGRESS' ? 'active' : ''}`}
                    onClick={() => setOrderStatusFilter('IN_PROGRESS')}
                  >
                    <span>In Progress</span>
                    <span className="sales-pill-count">{workOrders.filter((o) => o.status === 'IN_PROGRESS').length}</span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${orderStatusFilter === 'DRAFT' ? 'active' : ''}`}
                    onClick={() => setOrderStatusFilter('DRAFT')}
                  >
                    <span>Draft</span>
                    <span className="sales-pill-count">{workOrders.filter((o) => o.status === 'DRAFT').length}</span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${orderStatusFilter === 'COMPLETED' ? 'active' : ''}`}
                    onClick={() => setOrderStatusFilter('COMPLETED')}
                  >
                    <span>Completed</span>
                    <span className="sales-pill-count">{workOrders.filter((o) => o.status === 'COMPLETED').length}</span>
                  </button>

                  <select
                    className="warehouse-select-input"
                    style={{ height: '28px', fontSize: '11.5px', padding: '0 8px' }}
                    value={orderPriorityFilter}
                    onChange={(e) => setOrderPriorityFilter(e.target.value)}
                    aria-label="Filter priority"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="NORMAL">Normal</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="sales-search-box">
                    <Search size={13} className="sales-search-icon" />
                    <input
                      type="text"
                      placeholder="Filter order #, SKU, or item…"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="sales-search-input"
                    />
                    {orderSearch ? (
                      <button
                        type="button"
                        className="sales-search-clear"
                        onClick={() => setOrderSearch('')}
                        aria-label="Clear search"
                      >
                        <X size={12} />
                      </button>
                    ) : (
                      <span className="sales-search-kbd">/</span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={exportWorkOrdersCsv}
                    disabled={visibleOrders.length === 0}
                    style={{ height: '30px', fontSize: '12px' }}
                    title="Export Work Orders as CSV"
                  >
                    <Download size={13} />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Master Work Orders Table */}
              <div className="sales-table-card">
                <div className="sales-table-scroll">
                  <table className="sales-table">
                    <thead>
                      <tr>
                        <th style={{ width: '4%' }}></th>
                        <th style={{ width: '16%' }}>WORK ORDER #</th>
                        <th style={{ width: '18%' }}>PRODUCT</th>
                        <th style={{ width: '12%' }}>DESTINATION</th>
                        <th style={{ width: '13%' }}>OUTPUT PROGRESS</th>
                        <th style={{ width: '17%' }}>ROUTING STATUS</th>
                        <th style={{ width: '8%' }}>DUE DATE</th>
                        <th style={{ width: '8%' }}>STATUS</th>
                        <th style={{ width: '8%', textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.length > 0 ? (
                        visibleOrders.map((order) => {
                          const isExpanded = !!expandedOrders[order.id];
                          const completedOps = (order.operations || []).filter((op) => op.status === 'COMPLETED').length;
                          const totalOps = (order.operations || []).length;
                          const pctOps = totalOps > 0 ? Math.round((completedOps / totalOps) * 100) : 0;
                          const pctUnits = order.targetQuantity > 0 ? Math.min(100, Math.round((order.goodQuantity / order.targetQuantity) * 100)) : 0;
                          const isPastDue = order.dueDate && order.dueDate < today && !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(order.status);
                          const activeOp = (order.operations || []).find((op) => op.status === 'IN_PROGRESS');
                          const nextPendingOp = (order.operations || []).find((op) => op.status === 'PENDING');

                          return (
                            <Fragment key={order.id}>
                              <tr
                                className="sales-row production-clickable-row"
                                onClick={() => setSelectedOrderId(order.id)}
                              >
                                <td>
                                  <button
                                    type="button"
                                    className="production-expand-btn"
                                    aria-label={isExpanded ? 'Collapse inline preview' : 'Expand inline preview'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedOrders((prev) => ({ ...prev, [order.id]: !prev[order.id] }));
                                    }}
                                  >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <button
                                      type="button"
                                      className="order-number-pill interactive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrderId(order.id);
                                      }}
                                      title={`Open Work Order ${order.orderNumber}`}
                                    >
                                      <span>{order.orderNumber}</span>
                                      <ArrowUpRight size={11} className="order-link-arrow" />
                                    </button>
                                    <span className="revision-tag">Rev {order.bomRevision}</span>
                                    <span className={`priority-tag priority-${order.priority.toLowerCase()}`}>
                                      {order.priority}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px' }}>{order.finishedSku}</div>
                                </td>
                                <td style={{ color: 'var(--sp-text-secondary)', fontSize: '12px' }}>
                                  <span className="station-code-pill" style={{ fontSize: '10.5px' }}>
                                    {order.outputWarehouseName}
                                  </span>
                                </td>
                                <td>
                                  <div className="production-cell-progress">
                                    <div style={{ fontSize: '11.5px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                      {order.goodQuantity} / {order.targetQuantity} units
                                    </div>
                                    <div className="production-cell-progress-bar">
                                      <div className="production-cell-progress-fill" style={{ width: `${pctUnits}%` }} />
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontSize: '11.5px', color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                                    {completedOps} / {totalOps} ops done ({pctOps}%)
                                  </div>
                                </td>
                                <td style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)', whiteSpace: 'nowrap' }}>
                                  {order.dueDate || '—'}
                                  {isPastDue && (
                                    <div style={{ color: 'var(--sp-danger)', fontSize: '10px', fontWeight: 600 }}>Past Due</div>
                                  )}
                                </td>
                                <td>
                                  <Status label={formatAuditLabel(order.status)} />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    className="mini-action"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOrderId(order.id);
                                    }}
                                    style={{ height: '24px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    title="Open execution workspace"
                                  >
                                    <ExternalLink size={11} />
                                    <span>Manage</span>
                                  </button>
                                </td>
                              </tr>

                              {/* Inline Quick Preview */}
                              {isExpanded && (
                                <tr className="sales-row" style={{ background: 'var(--sp-surface-subtle)' }}>
                                  <td colSpan={9} style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                                          <Wrench size={12} />
                                          <span>Routing Operations Sequence:</span>
                                        </div>
                                        <button
                                          type="button"
                                          className="mini-action"
                                          onClick={() => setSelectedOrderId(order.id)}
                                          style={{ height: '24px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                          <ExternalLink size={11} />
                                          <span>Open Workspace</span>
                                        </button>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        {order.operations?.map((op) => (
                                          <div
                                            key={op.id}
                                            style={{
                                              padding: '6px 10px',
                                              borderRadius: '5px',
                                              background: 'var(--sp-surface)',
                                              border: '1px solid var(--sp-border)',
                                              fontSize: '11px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '6px'
                                            }}
                                          >
                                            <span className="sequence-badge">OP {op.sequence}</span>
                                            <span style={{ fontWeight: 600 }}>{op.name}</span>
                                            <span style={{ color: 'var(--sp-text-muted)' }}>({op.workCenterCode})</span>
                                            <Status label={formatAuditLabel(op.status)} />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="empty-cell">
                            No production work orders found matching criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
        </div>
      )}

      {/* 4. TAB 2: BILLS OF MATERIAL */}
      {activeTab === 'boms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${bomStatusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setBomStatusFilter('ALL')}
              >
                <span>All Revisions</span>
                <span className="sales-pill-count">{boms.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${bomStatusFilter === 'APPROVED' ? 'active' : ''}`}
                onClick={() => setBomStatusFilter('APPROVED')}
              >
                <span>Approved</span>
                <span className="sales-pill-count">{boms.filter((b) => b.status === 'APPROVED').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${bomStatusFilter === 'DRAFT' ? 'active' : ''}`}
                onClick={() => setBomStatusFilter('DRAFT')}
              >
                <span>Draft</span>
                <span className="sales-pill-count">{boms.filter((b) => b.status === 'DRAFT').length}</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box">
                <Search size={13} className="sales-search-icon" />
                <input
                  type="text"
                  placeholder="Filter finished SKU, item, revision…"
                  value={bomSearch}
                  onChange={(e) => setBomSearch(e.target.value)}
                  className="sales-search-input"
                />
                {bomSearch ? (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => setBomSearch('')}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <span className="sales-search-kbd">/</span>
                )}
              </div>

              <button
                type="button"
                className="button button-secondary"
                onClick={exportBomsCsv}
                disabled={filteredBoms.length === 0}
                style={{ height: '30px', fontSize: '12px' }}
                title="Export BOMs as CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>FINISHED ITEM</th>
                    <th style={{ width: '9%' }}>REVISION</th>
                    <th style={{ width: '26%' }}>COMPONENTS RECIPE</th>
                    <th style={{ width: '18%' }}>ROUTING OPERATIONS</th>
                    <th style={{ width: '11%' }}>EFFECTIVE PERIOD</th>
                    <th style={{ width: '6%' }}>STATUS</th>
                    <th style={{ width: '5%', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBoms.length > 0 ? (
                    filteredBoms.map((bom) => (
                      <tr key={bom.id} className="sales-row">
                        <td style={{ maxWidth: '240px' }}>
                          <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px' }}>{bom.finishedSku}</div>
                          <div className="production-subline" style={{ color: 'var(--sp-text-secondary)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '230px' }}>
                            {bom.finishedItemName}
                          </div>
                        </td>
                        <td>
                          <span className="revision-tag">{bom.revision}</span>
                        </td>
                        <td style={{ maxWidth: '230px' }}>
                          <div className="truncate-text" style={{ maxWidth: '220px', fontSize: '11.5px', color: 'var(--sp-text-secondary)' }} title={bom.lines.map((l) => `${l.sku} × ${l.quantityPerUnit}`).join(', ')}>
                            {bom.lines.map((l) => `${l.sku} × ${l.quantityPerUnit}${l.scrapAllowancePercent > 0 ? ` (+${l.scrapAllowancePercent}%)` : ''}`).join(', ')}
                          </div>
                        </td>
                        <td style={{ maxWidth: '180px' }}>
                          {bom.operations && bom.operations.length > 0 ? (
                            <span style={{ fontSize: '11.5px', color: 'var(--sp-text)', display: 'inline-block', maxWidth: '175px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bom.operations.map((op) => op.workCenterCode).join(' → ')}>
                              {bom.operations.length} ops ({bom.operations.map((op) => op.workCenterCode).join(' → ')})
                            </span>
                          ) : (
                            <span style={{ color: 'var(--sp-text-muted)', fontSize: '11.5px' }}>No routing defined</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--sp-text-secondary)', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                          {bom.effectiveFrom} {bom.effectiveTo ? `– ${bom.effectiveTo}` : '— Active'}
                        </td>
                        <td>
                          <Status label={formatAuditLabel(bom.status)} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            {bom.status === 'DRAFT' && canManage && (
                              <>
                                <button type="button" className="mini-action" disabled={saving} onClick={() => editBom(bom)}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="mini-action"
                                  disabled={saving}
                                  onClick={() => {
                                    const active = boms.find(
                                      (cand) => cand.finishedItemId === bom.finishedItemId && cand.status === 'APPROVED'
                                    );
                                    if (
                                      active &&
                                      !window.confirm(
                                        `Approving Rev ${bom.revision} will supersede approved Rev ${active.revision}. Continue?`
                                      )
                                    ) {
                                      return;
                                    }
                                    run(`/boms/${bom.id}/approve`);
                                  }}
                                >
                                  Approve
                                </button>
                              </>
                            )}
                            <button type="button" className="mini-action muted" disabled={saving} onClick={() => showHistory(bom)}>
                              History
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        No bills of material found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: WORK CENTERS */}
      {activeTab === 'work-centers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${workCenterStatusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setWorkCenterStatusFilter('ALL')}
              >
                <span>All</span>
                <span className="sales-pill-count">{workCenters.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${workCenterStatusFilter === 'ACTIVE' ? 'active' : ''}`}
                onClick={() => setWorkCenterStatusFilter('ACTIVE')}
              >
                <span>Active</span>
                <span className="sales-pill-count">{workCenters.filter((c) => c.active).length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${workCenterStatusFilter === 'INACTIVE' ? 'active' : ''}`}
                onClick={() => setWorkCenterStatusFilter('INACTIVE')}
              >
                <span>Inactive</span>
                <span className="sales-pill-count">{workCenters.filter((c) => !c.active).length}</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box">
                <Search size={13} className="sales-search-icon" />
                <input
                  type="text"
                  placeholder="Filter station code, name, description…"
                  value={workCenterSearch}
                  onChange={(e) => setWorkCenterSearch(e.target.value)}
                  className="sales-search-input"
                />
                {workCenterSearch ? (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => setWorkCenterSearch('')}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <span className="sales-search-kbd">/</span>
                )}
              </div>

              <button
                type="button"
                className="button button-secondary"
                onClick={exportWorkCentersCsv}
                disabled={filteredWorkCenters.length === 0}
                style={{ height: '30px', fontSize: '12px' }}
                title="Export Work Centers as CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '12%' }}>STATION CODE</th>
                    <th style={{ width: '22%' }}>WORK CENTER NAME</th>
                    <th style={{ width: '28%' }}>DESCRIPTION & CAPABILITY</th>
                    <th style={{ width: '11%', textAlign: 'right' }}>LABOR / HOUR</th>
                    <th style={{ width: '11%', textAlign: 'right' }}>OVERHEAD / HOUR</th>
                    <th style={{ width: '6%' }}>STATUS</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkCenters.length > 0 ? (
                    filteredWorkCenters.map((center) => (
                      <tr key={center.id} className="sales-row">
                        <td>
                          <span className="station-code-pill">{center.code}</span>
                        </td>
                        <td>
                          <b style={{ color: 'var(--sp-text)', fontSize: '12.5px' }}>{center.name}</b>
                        </td>
                        <td style={{ color: 'var(--sp-text-secondary)', maxWidth: '280px' }}>
                          <span className="truncate-text" style={{ maxWidth: '260px', fontSize: '11.5px' }} title={center.description || ''}>
                            {center.description || '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                          {center.laborRatePerHour == null ? 'Restricted' : formatCurrency(center.laborRatePerHour)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                          {center.overheadRatePerHour == null ? 'Restricted' : formatCurrency(center.overheadRatePerHour)}
                        </td>
                        <td>
                          <Status label={center.active ? 'Active' : 'Inactive'} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            <button
                              type="button"
                              className="mini-action muted"
                              onClick={() => showQueue(center)}
                              style={{ height: '24px', padding: '0 7px', fontSize: '11px' }}
                            >
                              {queueCenterId === center.id ? 'Hide' : 'Queue'}
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                className="mini-action"
                                disabled={saving}
                                onClick={() => run(`/work-centers/${center.id}/active`, 'PATCH', { active: !center.active })}
                                style={{ height: '24px', padding: '0 7px', fontSize: '11px' }}
                              >
                                {center.active ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        No work centers configured. Create one to define shop floor routings.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Embedded Station Queue Drawer */}
          {queueCenterId && (
            <div className="work-center-queue" style={{ margin: '16px', background: 'var(--sp-surface-subtle)', borderRadius: '8px', border: '1px solid var(--sp-border)' }}>
              <div className="job-card-heading">
                <div>
                  <h3 style={{ margin: 0, fontSize: '13px' }}>
                    {workCenters.find((c) => c.id === queueCenterId)?.name} Station Queue
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                    Pending and active routing operations assigned to this station.
                  </p>
                </div>
                <span className="reports-subnav-badge">{centerQueue.length} job cards</span>
              </div>

              {queueLoading ? (
                <p className="empty-cell">Loading station queue…</p>
              ) : centerQueue.length > 0 ? (
                <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                  {centerQueue.map((card) => (
                    <div key={card.id} className="production-job-card" style={{ background: 'var(--sp-surface)' }}>
                      <div className="production-job-top">
                        <div>
                          <span className="sequence-badge">OP {String(card.sequence).padStart(2, '0')} · {card.orderNumber}</span>
                          <b style={{ marginLeft: '8px', fontSize: '13px' }}>{card.finishedSku} · {card.finishedItemName}</b>
                          <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                            {card.name} · Target {card.targetQuantity} {card.dueDate ? `· Due ${card.dueDate}` : ''} · Priority: {card.priority}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Status label={formatAuditLabel(card.status)} />
                          {canManage && card.status === 'PENDING' && (
                            <select
                              aria-label={`Assign ${card.orderNumber} operation ${card.sequence}`}
                              value={card.operatorUserId || ''}
                              onChange={(e) => assignOperator(card, e.target.value)}
                              className="warehouse-select-input"
                              style={{ height: '28px', fontSize: '11px' }}
                            >
                              <option value="">Unassigned</option>
                              {operators.map((op) => (
                                <option key={op.userId} value={op.userId}>
                                  {op.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '10px 0 0' }}>
                  No pending or active job cards currently queued at this work station.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 4: SHOP FLOOR DISPATCH */}
      {activeTab === 'dispatch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Dispatch Linear Toolbar */}
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${dispatchStatusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setDispatchStatusFilter('ALL')}
              >
                <span>All</span>
                <span className="sales-pill-count">{allJobCards.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${dispatchStatusFilter === 'READY' ? 'active' : ''}`}
                onClick={() => setDispatchStatusFilter('READY')}
              >
                <span>Ready to Run</span>
                <span className="sales-pill-count">{readyJobCardsCount}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${dispatchStatusFilter === 'IN_PROGRESS' ? 'active' : ''}`}
                onClick={() => setDispatchStatusFilter('IN_PROGRESS')}
              >
                <span>Active</span>
                <span className="sales-pill-count">{inProgressJobCardsCount}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${dispatchStatusFilter === 'QUEUED' ? 'active' : ''}`}
                onClick={() => setDispatchStatusFilter('QUEUED')}
              >
                <span>Queued</span>
                <span className="sales-pill-count">{queuedJobCardsCount}</span>
              </button>
            </div>

            <div className="warehouse-location-picker">
              <label htmlFor="station-filter" className="warehouse-picker-label">
                <Factory size={13} />
                <span>Station:</span>
              </label>
              <select
                id="station-filter"
                className="warehouse-select-input"
                style={{ height: '30px', fontSize: '12px' }}
                value={dispatchStationFilter}
                onChange={(e) => setDispatchStationFilter(e.target.value)}
              >
                <option value="ALL">All Stations ({workCenters.length})</option>
                {workCenters.map((wc) => (
                  <option key={wc.id} value={wc.id}>
                    {wc.code} — {wc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sales-search-box">
              <Search size={13} className="sales-search-icon" />
              <input
                type="text"
                className="sales-search-input"
                placeholder="Search operation, station, order #..."
                value={dispatchSearch}
                onChange={(e) => setDispatchSearch(e.target.value)}
              />
              {dispatchSearch && (
                <button
                  type="button"
                  className="sales-search-clear"
                  onClick={() => setDispatchSearch('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Linear Dispatch Queue Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '8%' }}>OP #</th>
                    <th style={{ width: '22%' }}>JOB CARD & WORK CENTER</th>
                    <th style={{ width: '16%' }}>WORK ORDER #</th>
                    <th style={{ width: '16%' }}>PRODUCT</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>PLANNED DURATION</th>
                    <th style={{ width: '8%' }}>PRIORITY</th>
                    <th style={{ width: '8%' }}>STATUS</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobCards.length > 0 ? (
                    filteredJobCards.map(({ operation: op, order, prevIncomplete }) => {
                      const plannedRunTime = Math.ceil(Number(op.runMinutesPerUnit) * order.targetQuantity);
                      const isReadyToStart = op.status === 'PENDING' && !prevIncomplete && ['RELEASED', 'IN_PROGRESS'].includes(order.status);
                      const isQueued = op.status === 'PENDING' && prevIncomplete;
                      const isActive = op.status === 'IN_PROGRESS';

                      return (
                        <tr key={op.id} className="sales-row">
                          <td>
                            <span className="sequence-badge">OP {String(op.sequence).padStart(2, '0')}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '12.5px' }}>{op.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                              <span className="station-code-pill" style={{ fontSize: '10px' }}>{op.workCenterCode}</span>
                              <span>{op.workCenterName}</span>
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="order-number-pill interactive"
                              onClick={() => setSelectedOrderId(order.id)}
                              title={`Open Work Order ${order.orderNumber}`}
                            >
                              <span>{order.orderNumber}</span>
                              <ArrowUpRight size={11} className="order-link-arrow" />
                            </button>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px' }}>{order.finishedSku}</div>
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '1px' }}>Target: {order.targetQuantity} units</div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)' }}>
                              {op.setupMinutes + plannedRunTime}m
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)' }}>
                              {op.setupMinutes}m setup · {plannedRunTime}m run
                            </div>
                          </td>
                          <td>
                            <span className={`priority-tag priority-${order.priority.toLowerCase()}`}>
                              {order.priority}
                            </span>
                          </td>
                          <td>
                            <Status label={isActive ? 'In Progress' : isQueued ? 'Queued' : 'Ready'} />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isActive ? (
                              <button
                                type="button"
                                className="mini-action primary"
                                onClick={() => setSelectedOrderId(order.id)}
                                style={{ height: '24px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Open order workspace to log output and complete operation"
                              >
                                <ExternalLink size={10} />
                                <span>Log Output</span>
                              </button>
                            ) : isReadyToStart ? (
                              <button
                                type="button"
                                className="button button-primary"
                                disabled={saving}
                                onClick={() => run(`/work-orders/${order.id}/operations/${op.id}/start`)}
                                style={{ height: '24px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Start job card execution at station"
                              >
                                <Play size={10} />
                                <span>Start Job</span>
                              </button>
                            ) : isQueued ? (
                              <span
                                className="linear-routing-locked-tag"
                                title="Sequence locked: complete earlier routing operations before starting this station"
                              >
                                <Lock size={10} />
                                <span>Locked</span>
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="empty-cell">
                        No operations currently matching dispatch criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* 7. MODALS */}

      {/* MODAL 1: PLAN WORK ORDER */}
      {isPlanOrderModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsPlanOrderModalOpen(false)}>
          <div className="record-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>Plan Production Work Order</h2>
                <p>Choose an approved BOM recipe to snapshot components and routings.</p>
              </div>
              <button type="button" onClick={() => setIsPlanOrderModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={submitWorkOrder} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label>
                Approved BOM revision
                <select
                  name="bomId"
                  required
                  value={selectedBomId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedBomId(id);
                    const main = warehouses.find((w) => w.isDefault) || warehouses[0];
                    const bom = activeBoms.find((b) => b.id === id);
                    const groups: string[] = [
                      ...new Set(
                        (bom?.lines || []).map((l) => l.alternativeGroup).filter((g): g is string => Boolean(g))
                      )
                    ];
                    const choices: Record<string, string> = Object.fromEntries(
                      groups.map((g) => [g, bom?.lines.find((l) => l.alternativeGroup === g)?.componentItemId || ''])
                    );
                    setAlternativeSelections(choices);
                    setMaterialWarehouses(
                      Object.fromEntries(
                        (bom?.lines || [])
                          .filter((l) => !l.alternativeGroup || choices[l.alternativeGroup] === l.componentItemId)
                          .map((l) => [l.componentItemId, main?.id || ''])
                      )
                    );
                  }}
                >
                  <option value="" disabled>
                    Select BOM revision…
                  </option>
                  {activeBoms.map((bom) => (
                    <option key={bom.id} value={bom.id}>
                      {bom.finishedSku} · {bom.finishedItemName} (Rev {bom.revision})
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Target quantity
                  <input name="targetQuantity" type="number" min="1" step="1" required defaultValue="1" />
                </label>

                <label>
                  Priority
                  <select name="priority" defaultValue="NORMAL">
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </label>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Planned start
                  <input name="plannedStart" type="date" defaultValue={today} />
                </label>

                <label>
                  Due date
                  <input name="dueDate" type="date" />
                </label>
              </div>

              <label>
                Finished goods output warehouse
                <select
                  name="outputWarehouseId"
                  value={outputWarehouseId}
                  onChange={(e) => setOutputWarehouseId(e.target.value)}
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </label>

              {/* Material Warehouse Allocations */}
              {selectedBomId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <b style={{ fontSize: '12px', color: 'var(--sp-text)' }}>Component Sourcing Locations</b>
                  {chosenBomLines(activeBoms.find((b) => b.id === selectedBomId)).map((line) => (
                    <label key={line.componentItemId} style={{ fontSize: '11.5px' }}>
                      {line.sku} · {line.itemName} (Per unit: {line.quantityPerUnit})
                      <select
                        name={`materialWarehouse-${line.componentItemId}`}
                        value={materialWarehouses[line.componentItemId] || ''}
                        onChange={(e) =>
                          setMaterialWarehouses((curr) => ({ ...curr, [line.componentItemId]: e.target.value }))
                        }
                        required
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.code})
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              <div className="reports-note-box" style={{ margin: 0, fontSize: '11.5px' }}>
                Creating the work order preserves the exact BOM recipe snapshot. Component quantities are verified and reserved upon release.
              </div>

              <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsPlanOrderModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving || !selectedBomId}
                >
                  {saving ? 'Creating…' : 'Create Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE / EDIT BOM */}
      {isBomModalOpen && (
        <div className="modal-backdrop" onClick={resetBomForm}>
          <div className="record-modal" style={{ width: 'min(640px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>{editingBom ? 'Edit Draft BOM Revision' : 'Create New BOM Revision'}</h2>
                <p>
                  {editingBom
                    ? 'Draft components and operations can be altered until approved.'
                    : 'Specify finished item recipe and optional work center routings.'}
                </p>
              </div>
              <button type="button" onClick={resetBomForm}>
                ×
              </button>
            </div>

            <form onSubmit={submitBom} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
                <label>
                  Finished manufactured item
                  <select
                    name="finishedItemId"
                    required
                    disabled={!!editingBom}
                    value={finishedItemId}
                    onChange={(e) => setFinishedItemId(e.target.value)}
                  >
                    <option value="" disabled>
                      Select finished item…
                    </option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} · {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Revision code
                  <input
                    name="revision"
                    required
                    maxLength={24}
                    placeholder="e.g. REV-A"
                    disabled={!!editingBom}
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    style={{ textTransform: 'uppercase' }}
                  />
                </label>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Effective from
                  <input
                    name="effectiveFrom"
                    type="date"
                    required
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                  />
                </label>

                <label>
                  Effective to (optional)
                  <input
                    name="effectiveTo"
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                  />
                </label>
              </div>

              {/* Component Lines Builder */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <b style={{ fontSize: '12px', color: 'var(--sp-text)' }}>Component Recipe Lines</b>
                  <button
                    type="button"
                    className="mini-action"
                    onClick={() =>
                      setDraftLines((curr) => [
                        ...curr,
                        { key: crypto.randomUUID(), componentItemId: '', quantityPerUnit: 1, scrapAllowancePercent: 0, alternativeGroup: '' }
                      ])
                    }
                  >
                    <Plus size={11} /> Add Component
                  </button>
                </div>

                {draftLines.map((line, index) => (
                  <div key={line.key} className="bom-draft-row">
                    <label style={{ flex: 2 }}>
                      Component
                      <select
                        required
                        value={line.componentItemId}
                        onChange={(e) =>
                          setDraftLines((curr) =>
                            curr.map((r, i) => (i === index ? { ...r, componentItemId: e.target.value } : r))
                          )
                        }
                      >
                        <option value="" disabled>Choose component…</option>
                        {items
                          .filter((it) => it.id !== finishedItemId)
                          .map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.sku} · {it.name}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label style={{ width: '80px' }}>
                      Qty / Unit
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={line.quantityPerUnit}
                        onChange={(e) =>
                          setDraftLines((curr) =>
                            curr.map((r, i) => (i === index ? { ...r, quantityPerUnit: e.target.value } : r))
                          )
                        }
                      />
                    </label>

                    <label style={{ width: '80px' }}>
                      Scrap %
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        required
                        value={line.scrapAllowancePercent}
                        onChange={(e) =>
                          setDraftLines((curr) =>
                            curr.map((r, i) => (i === index ? { ...r, scrapAllowancePercent: e.target.value } : r))
                          )
                        }
                      />
                    </label>

                    {draftLines.length > 1 && (
                      <button
                        type="button"
                        className="warehouse-clear-btn"
                        style={{ alignSelf: 'flex-end', marginBottom: '6px' }}
                        onClick={() => setDraftLines((curr) => curr.filter((_, i) => i !== index))}
                        title="Remove component line"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Routing Operations Builder */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <b style={{ fontSize: '12px', color: 'var(--sp-text)' }}>Routing Operations & Work Centers</b>
                  <button
                    type="button"
                    className="mini-action"
                    disabled={!workCenters.some((c) => c.active)}
                    onClick={() =>
                      setRoutingLines((curr) => [
                        ...curr,
                        {
                          key: crypto.randomUUID(),
                          sequence: (curr.length + 1) * 10,
                          name: '',
                          workCenterId: workCenters.find((c) => c.active)?.id || '',
                          setupMinutes: 0,
                          runMinutesPerUnit: 0,
                          skillRequirements: ''
                        }
                      ])
                    }
                  >
                    <Plus size={11} /> Add Operation
                  </button>
                </div>

                {routingLines.map((op, index) => (
                  <div key={op.key} className="bom-draft-row" style={{ flexWrap: 'wrap' }}>
                    <label style={{ width: '60px' }}>
                      Seq
                      <input
                        type="number"
                        min="1"
                        required
                        value={op.sequence}
                        onChange={(e) =>
                          setRoutingLines((curr) =>
                            curr.map((r, i) => (i === index ? { ...r, sequence: e.target.value } : r))
                          )
                        }
                      />
                    </label>

                    <label style={{ flex: 1.5 }}>
                      Operation name
                      <input
                        required
                        maxLength={120}
                        placeholder="e.g. Rough CNC Milling"
                        value={op.name}
                        onChange={(e) =>
                          setRoutingLines((curr) =>
                            curr.map((r, i) => (i === index ? { ...r, name: e.target.value } : r))
                          )
                        }
                      />
                    </label>

                    <label style={{ flex: 1.2 }}>
                      Work station
                      <select
                        required
                        value={op.workCenterId}
                        onChange={(e) =>
                          setRoutingLines((curr) =>
                            curr.map((r, i) => (i === index ? { ...r, workCenterId: e.target.value } : r))
                          )
                        }
                      >
                        <option value="" disabled>Choose station…</option>
                        {workCenters
                          .filter((c) => c.active)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} · {c.name}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label style={{ width: '70px' }}>
                      Setup (m)
                      <input
                        type="number"
                        min="0"
                        required
                        value={op.setupMinutes}
                        onChange={(e) =>
                          setRoutingLines((curr) =>
                            curr.map((r, i) => (i === index ? { ...r, setupMinutes: e.target.value } : r))
                          )
                        }
                      />
                    </label>

                    <label style={{ width: '70px' }}>
                      Run (m)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={op.runMinutesPerUnit}
                        onChange={(e) =>
                          setRoutingLines((curr) =>
                            curr.map((r, i) => (i === index ? { ...r, runMinutesPerUnit: e.target.value } : r))
                          )
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="warehouse-clear-btn"
                      style={{ alignSelf: 'flex-end', marginBottom: '6px' }}
                      onClick={() => setRoutingLines((curr) => curr.filter((_, i) => i !== index))}
                      title="Remove routing operation"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={resetBomForm}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving || !finishedItemId || !revision}
                >
                  {saving ? 'Saving…' : editingBom ? 'Update Draft' : 'Save Draft BOM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD WORK CENTER */}
      {isWorkCenterModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsWorkCenterModalOpen(false)}>
          <div className="record-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>New Work Station / Center</h2>
                <p>Register a manufacturing cell, machining center, or assembly station.</p>
              </div>
              <button type="button" onClick={() => setIsWorkCenterModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={createWorkCenter} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <label>
                  Station code
                  <input
                    name="code"
                    required
                    maxLength={40}
                    placeholder="e.g. CNC-02"
                    style={{ textTransform: 'uppercase' }}
                    autoFocus
                  />
                </label>

                <label>
                  Work center name
                  <input
                    name="name"
                    required
                    maxLength={120}
                    placeholder="e.g. 5-Axis Milling Station"
                  />
                </label>
              </div>

              <label>
                Description & capability
                <input
                  name="description"
                  maxLength={500}
                  placeholder="e.g. High-tolerance aerospace titanium profiling cell"
                />
              </label>

              {canViewCosts && (
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label>
                    Labor rate / hour ($)
                    <input name="laborRatePerHour" type="number" min="0" step="0.01" defaultValue="0" />
                  </label>

                  <label>
                    Overhead rate / hour ($)
                    <input name="overheadRatePerHour" type="number" min="0" step="0.01" defaultValue="0" />
                  </label>
                </div>
              )}

              <div className="reports-note-box" style={{ margin: 0, fontSize: '11.5px' }}>
                Work center hourly rates are snapshotted onto work orders at plan time to compute labor and burden variances.
              </div>

              <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsWorkCenterModalOpen(false)}
                  disabled={workCenterSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={workCenterSaving}
                >
                  {workCenterSaving ? 'Creating…' : 'Create Work Center'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RECORD OUTPUT */}
      {outputOrder && (
        <div className="modal-backdrop" onClick={() => setOutputOrder(null)}>
          <div className="record-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>Record Production Output</h2>
                <p>
                  Receive finished goods into inventory for {outputOrder.orderNumber} ({outputOrder.finishedSku}).
                </p>
              </div>
              <button type="button" onClick={() => setOutputOrder(null)}>
                ×
              </button>
            </div>

            <form onSubmit={submitOutput} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <label>
                  Good units
                  <input
                    name="goodQuantity"
                    type="number"
                    min="0"
                    defaultValue={Math.max(0, outputOrder.targetQuantity - outputOrder.goodQuantity)}
                    required
                  />
                </label>

                <label>
                  Scrap units
                  <input name="scrapQuantity" type="number" min="0" defaultValue="0" required />
                </label>

                <label>
                  Rework units
                  <input name="reworkQuantity" type="number" min="0" defaultValue="0" required />
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--sp-border-subtle)', paddingTop: '10px' }}>
                <b style={{ fontSize: '12px', color: 'var(--sp-text)' }}>Optional Byproduct Recovery</b>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
                  <label>
                    Byproduct catalog item
                    <select name="byproductItemId" defaultValue="">
                      <option value="">None</option>
                      {items
                        .filter((it) => it.id !== outputOrder.finishedItemId && it.active)
                        .map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.sku} · {it.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label>
                    Byproduct quantity
                    <input name="byproductQuantity" type="number" min="0" defaultValue="0" />
                  </label>
                </div>

                <label>
                  Byproduct destination warehouse
                  <select name="byproductWarehouseId" defaultValue={outputOrder.outputWarehouseId}>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="reports-note-box" style={{ margin: 0, fontSize: '11.5px' }}>
                Good finished goods are immediately posted to the {outputOrder.outputWarehouseName} ledger. If all target units are met, the order moves to completed status.
              </div>

              <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setOutputOrder(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving}
                >
                  {saving ? 'Recording…' : 'Record Output'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: BOM REVISION HISTORY */}
      {historyBom && (
        <div className="modal-backdrop" onClick={() => setHistoryBom(null)}>
          <div className="record-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>BOM Revision History</h2>
                <p>
                  Audit log of lifecycle events for {historyBom.finishedSku} (Rev {historyBom.revision}).
                </p>
              </div>
              <button type="button" onClick={() => setHistoryBom(null)}>
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
              {historyRows.length > 0 ? (
                historyRows.map((event) => (
                  <div key={event.id} className="production-history-row">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <b style={{ fontSize: '12px', color: 'var(--sp-brand)' }}>{event.eventType}</b>
                      <time style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                        {new Date(event.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)', marginTop: '2px' }}>
                      {event.previousStatus ? `${event.previousStatus} → ` : ''}
                      <b>{event.newStatus || 'Recorded'}</b>
                      {event.actorUserId && (
                        <span style={{ color: 'var(--sp-text-muted)', marginLeft: '6px' }}>
                          by user {event.actorUserId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                  No revision events logged for this bill of material.
                </div>
              )}
            </div>

            <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setHistoryBom(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: ISSUE COMPONENT MATERIAL */}
      {issuingMaterial && (
        <div className="modal-backdrop" onClick={() => setIssuingMaterial(null)}>
          <div className="record-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>Issue Component Material</h2>
                <p>
                  Issue {issuingMaterial.material.sku} from {issuingMaterial.material.warehouseName} to {issuingMaterial.order.orderNumber}.
                </p>
              </div>
              <button type="button" onClick={() => setIssuingMaterial(null)}>
                ×
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const qty = Number(new FormData(e.currentTarget).get('quantity'));
                await run(`/work-orders/${issuingMaterial.order.id}/materials/${issuingMaterial.material.id}/issue`, 'POST', {
                  quantity: qty,
                  idempotencyKey: crypto.randomUUID()
                });
                setIssuingMaterial(null);
              }}
            >
              <div className="modal-form-grid" style={{ gridTemplateColumns: '1fr', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: 'var(--sp-surface-subtle)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', fontWeight: 600 }}>REQUIRED</span>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                      {issuingMaterial.material.requiredQuantity} {issuingMaterial.material.unit}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', fontWeight: 600 }}>ALREADY ISSUED</span>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                      {issuingMaterial.material.issuedQuantity} {issuingMaterial.material.unit}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', fontWeight: 600 }}>WAREHOUSE STOCK</span>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: issuingMaterial.material.availableQuantity >= (issuingMaterial.material.requiredQuantity - issuingMaterial.material.issuedQuantity) ? 'var(--sp-success)' : 'var(--sp-danger)' }}>
                      {issuingMaterial.material.availableQuantity} {issuingMaterial.material.unit}
                    </div>
                  </div>
                </div>

                <label>
                  Quantity to Issue
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    max={issuingMaterial.material.availableQuantity}
                    defaultValue={Math.max(1, Math.min(issuingMaterial.material.requiredQuantity - issuingMaterial.material.issuedQuantity, issuingMaterial.material.availableQuantity))}
                    required
                    autoFocus
                  />
                </label>
              </div>

              <div className="reports-note-box" style={{ margin: '14px 0 0', fontSize: '11.5px' }}>
                Stock will be transferred from {issuingMaterial.material.warehouseName} into Work-in-Progress (WIP) on the inventory ledger.
              </div>

              <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '14px' }}>
                <button type="button" className="button button-secondary" onClick={() => setIssuingMaterial(null)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={saving || issuingMaterial.material.availableQuantity === 0}>
                  Confirm Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: RETURN COMPONENT MATERIAL */}
      {returningMaterial && (
        <div className="modal-backdrop" onClick={() => setReturningMaterial(null)}>
          <div className="record-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>Return Component Material</h2>
                <p>
                  Return unused {returningMaterial.material.sku} back to {returningMaterial.material.warehouseName}.
                </p>
              </div>
              <button type="button" onClick={() => setReturningMaterial(null)}>
                ×
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const qty = Number(new FormData(e.currentTarget).get('quantity'));
                await run(`/work-orders/${returningMaterial.order.id}/materials/${returningMaterial.material.id}/return`, 'POST', {
                  quantity: qty,
                  idempotencyKey: crypto.randomUUID()
                });
                setReturningMaterial(null);
              }}
            >
              <div className="modal-form-grid" style={{ gridTemplateColumns: '1fr', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', background: 'var(--sp-surface-subtle)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', fontWeight: 600 }}>TOTAL ISSUED</span>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                      {returningMaterial.material.issuedQuantity} {returningMaterial.material.unit}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', fontWeight: 600 }}>MAX RETURNABLE</span>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                      {returningMaterial.material.issuedQuantity - returningMaterial.material.returnedQuantity} {returningMaterial.material.unit}
                    </div>
                  </div>
                </div>

                <label>
                  Quantity to Return
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    max={returningMaterial.material.issuedQuantity - returningMaterial.material.returnedQuantity}
                    defaultValue="1"
                    required
                    autoFocus
                  />
                </label>
              </div>

              <div className="reports-note-box" style={{ margin: '14px 0 0', fontSize: '11.5px' }}>
                Returned units will be debited from WIP and credited back into {returningMaterial.material.warehouseName} balance.
              </div>

              <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '14px' }}>
                <button type="button" className="button button-secondary" onClick={() => setReturningMaterial(null)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={saving}>
                  Confirm Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
