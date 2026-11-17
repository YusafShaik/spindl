import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Cpu,
  Download,
  Factory,
  FileText,
  Filter,
  GitBranch,
  Layers,
  Package,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sliders,
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

  const [bomSearch, setBomSearch] = useState('');
  const [bomStatusFilter, setBomStatusFilter] = useState('ALL');

  const [workCenterSearch, setWorkCenterSearch] = useState('');
  const [workCenterStatusFilter, setWorkCenterStatusFilter] = useState('ALL');

  const [dispatchStationFilter, setDispatchStationFilter] = useState('ALL');

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

  // Auto-expand any active/open orders on load
  useEffect(() => {
    if (workOrders.length > 0) {
      const activeOrderIds: Record<string, boolean> = {};
      workOrders.forEach((wo) => {
        if (['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(wo.status)) {
          activeOrderIds[wo.id] = true;
        }
      });
      // Expand at least the first order if none are active
      if (Object.keys(activeOrderIds).length === 0 && workOrders[0]) {
        activeOrderIds[workOrders[0].id] = true;
      }
      setExpandedOrders((prev) => ({ ...activeOrderIds, ...prev }));
    }
  }, [workOrders]);

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

  const shopFloorJobCards = useMemo(() => {
    const list: Array<{ operation: RoutingOperation; order: WorkOrder }> = [];
    workOrders.forEach((wo) => {
      (wo.operations || []).forEach((op) => {
        if (op.status === 'IN_PROGRESS' || op.status === 'PENDING') {
          if (dispatchStationFilter === 'ALL' || op.workCenterId === dispatchStationFilter) {
            list.push({ operation: op, order: wo });
          }
        }
      });
    });
    return list;
  }, [workOrders, dispatchStationFilter]);

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

  return (
    <div className="reports-screen-layout production-screen-layout">
      {/* 1. Executive Telemetry Strip — Quiet Monochrome Linear Cards */}
      <div className="sales-metric-strip">
        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">ACTIVE WORK ORDERS</span>
            <Factory size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val">{openOrders.length} Active</div>
          <div className="reports-metric-sub">
            {inProgressOrders.length} in production · {releasedOrders.length} released to floor
          </div>
        </div>

        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">ROUTING PROGRESS</span>
            <GitBranch size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val">
            {completedOperations} / {allRoutingOperations.length} Steps
          </div>
          <div className="reports-metric-sub">
            {activeOperationsCount} active operations running at stations
          </div>
        </div>

        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">SCHEDULE & CRITICALITY</span>
            <Clock size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val">
            {lateOrders.length > 0 ? `${lateOrders.length} Past Due` : 'On Schedule'}
          </div>
          <div className="reports-metric-sub">
            {materialBlocked.length} orders blocked by component shortages
          </div>
        </div>

        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">BOM & CAPACITY</span>
            <Layers size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val">{activeBoms.length} Approved BOMs</div>
          <div className="reports-metric-sub">
            {activeWorkCenters.length} active stations across shop floor
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="reports-subnav-container">
        <div className="reports-subnav-tabs">
          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'work-orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('work-orders')}
          >
            <ClipboardList size={13} />
            <span>Work Orders</span>
            <span className="reports-subnav-badge">{workOrders.length}</span>
          </button>

          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'boms' ? 'active' : ''}`}
            onClick={() => setActiveTab('boms')}
          >
            <Layers size={13} />
            <span>Bills of Material</span>
            <span className="reports-subnav-badge">{boms.length}</span>
          </button>

          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'work-centers' ? 'active' : ''}`}
            onClick={() => setActiveTab('work-centers')}
          >
            <Factory size={13} />
            <span>Work Centers</span>
            <span className="reports-subnav-badge">{workCenters.length}</span>
          </button>

          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'dispatch' ? 'active' : ''}`}
            onClick={() => setActiveTab('dispatch')}
          >
            <Activity size={13} />
            <span>Shop Floor Dispatch</span>
            <span className="reports-subnav-badge">{shopFloorJobCards.length}</span>
          </button>
        </div>

        <div className="action-row" style={{ gap: '8px' }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void run('/work-orders')}
            disabled={loading || saving}
            title="Refresh manufacturing data"
            style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
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
              style={{ height: '32px', fontSize: '12.5px' }}
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
              style={{ height: '32px', fontSize: '12.5px' }}
            >
              <Plus size={13} />
              <span>Add Work Center</span>
            </button>
          )}

          {canManage && activeTab !== 'boms' && activeTab !== 'work-centers' && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsPlanOrderModalOpen(true)}
              disabled={activeBoms.length === 0}
              title={activeBoms.length === 0 ? 'Approve a BOM revision before planning work orders' : ''}
              style={{ height: '32px', fontSize: '12.5px' }}
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
          {/* Action Control Bar */}
          <div className="warehouse-action-bar">
            <div className="warehouse-search-wrapper" style={{ minWidth: '260px' }}>
              <Search size={13} className="warehouse-search-icon" />
              <input
                type="text"
                placeholder="Search order #, SKU, or item… ⌘K"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="warehouse-search-input"
              />
              {orderSearch && (
                <button
                  type="button"
                  className="warehouse-clear-btn"
                  onClick={() => setOrderSearch('')}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="warehouse-filter-pills">
              <button
                type="button"
                className={`warehouse-pill ${orderStatusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('ALL')}
              >
                All ({workOrders.length})
              </button>
              <button
                type="button"
                className={`warehouse-pill ${orderStatusFilter === 'RELEASED' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('RELEASED')}
              >
                Released ({workOrders.filter((o) => o.status === 'RELEASED').length})
              </button>
              <button
                type="button"
                className={`warehouse-pill ${orderStatusFilter === 'IN_PROGRESS' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('IN_PROGRESS')}
              >
                In Progress ({workOrders.filter((o) => o.status === 'IN_PROGRESS').length})
              </button>
              <button
                type="button"
                className={`warehouse-pill ${orderStatusFilter === 'DRAFT' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('DRAFT')}
              >
                Draft ({workOrders.filter((o) => o.status === 'DRAFT').length})
              </button>
              <button
                type="button"
                className={`warehouse-pill ${orderStatusFilter === 'COMPLETED' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('COMPLETED')}
              >
                Completed ({workOrders.filter((o) => o.status === 'COMPLETED').length})
              </button>
            </div>

            <div className="warehouse-bar-actions">
              <select
                className="warehouse-select-input"
                style={{ height: '30px', fontSize: '11.5px' }}
                value={orderPriorityFilter}
                onChange={(e) => setOrderPriorityFilter(e.target.value)}
                aria-label="Filter priority"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="NORMAL">Normal Priority</option>
                <option value="LOW">Low Priority</option>
              </select>

              <button
                type="button"
                className="button button-secondary"
                onClick={exportWorkOrdersCsv}
                disabled={visibleOrders.length === 0}
                style={{ height: '32px', fontSize: '12px' }}
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Work Orders List */}
          {loading ? (
            <div className="panel directory-panel" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--sp-text-muted)' }}>
              Loading production work orders…
            </div>
          ) : visibleOrders.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visibleOrders.map((order) => {
                const isExpanded = !!expandedOrders[order.id];
                const completedOps = (order.operations || []).filter((op) => op.status === 'COMPLETED').length;
                const totalOps = (order.operations || []).length;
                const pctOps = totalOps > 0 ? Math.round((completedOps / totalOps) * 100) : 0;
                const isPastDue = order.dueDate && order.dueDate < today && !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(order.status);
                const hasShortages = order.materials.some((m) => m.shortageQuantity > 0);

                return (
                  <div key={order.id} className="production-order-card">
                    {/* Header Bar */}
                    <div
                      className="production-order-header"
                      onClick={() => setExpandedOrders((prev) => ({ ...prev, [order.id]: !prev[order.id] }))}
                    >
                      <div className="production-order-meta">
                        <div className="production-order-badges">
                          <span className="order-number-pill">{order.orderNumber}</span>
                          <span className="revision-tag">Rev {order.bomRevision}</span>
                          <span className={`priority-tag priority-${order.priority.toLowerCase()}`}>
                            {order.priority}
                          </span>
                          <span className="facility-code-pill" style={{ fontSize: '10.5px' }}>
                            {order.outputWarehouseName}
                          </span>
                          {isPastDue && <span className="past-due-badge">Past Due</span>}
                          {hasShortages && order.status === 'DRAFT' && (
                            <span className="shortage-badge">Material Shortage</span>
                          )}
                          <Status label={formatAuditLabel(order.status)} />
                        </div>

                        <div className="production-order-title-row">
                          <span className="production-order-sku">{order.finishedSku}</span>
                          <span className="production-order-name">{order.finishedItemName}</span>
                        </div>

                        <div className="production-order-subtext">
                          <span>Target: <b>{order.targetQuantity}</b></span>
                          <span>·</span>
                          <span>Good: <b>{order.goodQuantity}</b></span>
                          {order.scrapQuantity > 0 && (
                            <>
                              <span>·</span>
                              <span style={{ color: 'var(--sp-danger)' }}>Scrap: <b>{order.scrapQuantity}</b></span>
                            </>
                          )}
                          {order.reworkQuantity > 0 && (
                            <>
                              <span>·</span>
                              <span style={{ color: 'var(--sp-warning)' }}>Rework pending: <b>{order.reworkQuantity}</b></span>
                            </>
                          )}
                          {order.dueDate && (
                            <>
                              <span>·</span>
                              <span>Due {order.dueDate}</span>
                            </>
                          )}
                          {totalOps > 0 && (
                            <>
                              <span>·</span>
                              <span>{completedOps} of {totalOps} operations done ({pctOps}%)</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="warehouse-expand-btn"
                        aria-label={isExpanded ? 'Collapse work order' : 'Expand work order'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {/* Expandable Order Body */}
                    {isExpanded && (
                      <div className="production-order-body">
                        {/* Costing Telemetry Strip (Role Restricted) */}
                        {canViewCosts && (
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
                                  color: order.materialCostVariance > 0 ? 'var(--sp-danger)' : 'var(--sp-success)'
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
                              <span className="label">OVERHEAD</span>
                              <span className="val">
                                {formatCurrency(order.actualOverheadCost)} / {formatCurrency(order.estimatedOverheadCost)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Routing Operations Progress Bar */}
                        {totalOps > 0 && (
                          <div className="production-step-progress">
                            <div className="production-progress-track">
                              <div className="production-progress-fill" style={{ width: `${pctOps}%` }} />
                            </div>
                            <div className="production-progress-sub">
                              <span>Routing Step Execution: {completedOps} of {totalOps} Complete ({pctOps}%)</span>
                            </div>
                          </div>
                        )}

                        {/* Materials Allocation Table */}
                        <div style={{ marginTop: '14px' }}>
                          <div className="production-section-title">
                            <Boxes size={13} />
                            <span>Allocated Component Materials</span>
                          </div>

                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>COMPONENT ITEM</th>
                                  <th>SOURCE LOCATION</th>
                                  <th style={{ textAlign: 'right' }}>REQUIRED</th>
                                  <th style={{ textAlign: 'right' }}>ISSUED</th>
                                  <th style={{ textAlign: 'right' }}>AVAILABLE</th>
                                  <th style={{ textAlign: 'right' }}>SHORTAGE</th>
                                  {['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(order.status) && <th>ACTIONS</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {order.materials.map((material) => (
                                  <tr key={material.id}>
                                    <td>
                                      <b>{material.sku}</b>
                                      <small className="production-subline">{material.itemName}</small>
                                    </td>
                                    <td>{material.warehouseName}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                      {material.requiredQuantity} {material.unit}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                      <b>{material.issuedQuantity}</b>
                                      {material.returnedQuantity > 0 && (
                                        <small style={{ color: 'var(--sp-text-muted)' }}> ({material.returnedQuantity} ret)</small>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                      {material.availableQuantity}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                      {material.shortageQuantity > 0 ? (
                                        <b style={{ color: 'var(--sp-danger)' }}>{material.shortageQuantity}</b>
                                      ) : (
                                        <span style={{ color: 'var(--sp-text-muted)' }}>—</span>
                                      )}
                                    </td>
                                    {['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(order.status) && (
                                      <td>
                                        <div className="action-inline">
                                          <form
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            onSubmit={(e) => {
                                              e.preventDefault();
                                              const qty = Number(new FormData(e.currentTarget).get('quantity'));
                                              run(`/work-orders/${order.id}/materials/${material.id}/issue`, 'POST', {
                                                quantity: qty,
                                                idempotencyKey: crypto.randomUUID()
                                              });
                                            }}
                                          >
                                            <input
                                              aria-label="Issue quantity"
                                              name="quantity"
                                              type="number"
                                              min="1"
                                              defaultValue={Math.max(1, material.requiredQuantity - material.issuedQuantity)}
                                              required
                                              className="warehouse-count-input"
                                              style={{ width: '60px' }}
                                            />
                                            <button className="mini-action" disabled={saving}>Issue</button>
                                          </form>

                                          {material.issuedQuantity > material.returnedQuantity && (
                                            <form
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                              onSubmit={(e) => {
                                                e.preventDefault();
                                                const qty = Number(new FormData(e.currentTarget).get('quantity'));
                                                run(`/work-orders/${order.id}/materials/${material.id}/return`, 'POST', {
                                                  quantity: qty,
                                                  idempotencyKey: crypto.randomUUID()
                                                });
                                              }}
                                            >
                                              <input
                                                aria-label="Return quantity"
                                                name="quantity"
                                                type="number"
                                                min="1"
                                                max={material.issuedQuantity - material.returnedQuantity}
                                                defaultValue="1"
                                                required
                                                className="warehouse-count-input"
                                                style={{ width: '50px' }}
                                              />
                                              <button className="mini-action muted" disabled={saving}>Return</button>
                                            </form>
                                          )}
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Job Cards (Routing Operations) */}
                        {!!order.operations?.length && (
                          <div style={{ marginTop: '16px' }}>
                            <div className="production-section-title">
                              <Wrench size={13} />
                              <span>Shop Floor Job Cards & Routing Steps</span>
                            </div>

                            <div className="production-job-grid">
                              {order.operations.map((op) => {
                                const isOpPending = op.status === 'PENDING';
                                const isOpInProgress = op.status === 'IN_PROGRESS';
                                const isOpCompleted = op.status === 'COMPLETED';

                                const prevIncomplete = order.operations.some(
                                  (prev) => prev.sequence < op.sequence && prev.status !== 'COMPLETED'
                                );

                                return (
                                  <div key={op.id} className={`production-job-card ${op.status.toLowerCase()}`}>
                                    <div className="production-job-top">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="sequence-badge">OP {String(op.sequence).padStart(2, '0')}</span>
                                        <div>
                                          <b style={{ fontSize: '13px', color: 'var(--sp-text)' }}>{op.name}</b>
                                          <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                                            {op.workCenterCode} · {op.workCenterName}
                                            {op.skillRequirements && ` · ${op.skillRequirements}`}
                                          </div>
                                        </div>
                                      </div>
                                      <Status label={formatAuditLabel(op.status)} />
                                    </div>

                                    {isOpPending && ['RELEASED', 'IN_PROGRESS'].includes(order.status) && (
                                      <div style={{ marginTop: '10px' }}>
                                        <button
                                          type="button"
                                          className="mini-action"
                                          disabled={saving || prevIncomplete}
                                          onClick={() => run(`/work-orders/${order.id}/operations/${op.id}/start`)}
                                        >
                                          <Play size={11} style={{ marginRight: '4px' }} />
                                          Start Job Card
                                        </button>
                                        {prevIncomplete && (
                                          <small style={{ color: 'var(--sp-text-muted)', marginLeft: '8px', fontSize: '11px' }}>
                                            Complete previous routing sequence first
                                          </small>
                                        )}
                                      </div>
                                    )}

                                    {isOpInProgress && (
                                      <div style={{ marginTop: '10px' }}>
                                        <div className="reports-note-box" style={{ margin: '0 0 10px', fontSize: '11.5px' }}>
                                          Active at station · Started {op.startedAt ? new Date(op.startedAt).toLocaleTimeString() : 'now'} · Assigned to operator
                                        </div>

                                        <form
                                          className="production-step-complete-form"
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
                                        >
                                          <label>
                                            Produced
                                            <input name="producedQuantity" type="number" min="0" max={order.targetQuantity} defaultValue={order.targetQuantity} required />
                                          </label>
                                          <label>
                                            Scrap
                                            <input name="scrapQuantity" type="number" min="0" max={order.targetQuantity} defaultValue="0" required />
                                          </label>
                                          <label>
                                            Rework
                                            <input name="reworkQuantity" type="number" min="0" max={order.targetQuantity} defaultValue="0" required />
                                          </label>
                                          <label>
                                            Actual Setup (min)
                                            <input name="actualSetupMinutes" type="number" min="0" defaultValue={op.setupMinutes} required />
                                          </label>
                                          <label>
                                            Actual Run (min)
                                            <input name="actualRunMinutes" type="number" min="0" defaultValue={Math.ceil(Number(op.runMinutesPerUnit) * order.targetQuantity)} required />
                                          </label>
                                          <label>
                                            Downtime (min)
                                            <input name="downtimeMinutes" type="number" min="0" defaultValue="0" />
                                          </label>
                                          <label style={{ gridColumn: 'span 2' }}>
                                            Downtime Reason
                                            <input name="downtimeReason" maxLength={240} placeholder="Required if downtime recorded" />
                                          </label>
                                          <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                                            <button className="button button-primary" style={{ height: '28px', fontSize: '11.5px' }} disabled={saving}>
                                              <Check size={12} />
                                              Complete Operation
                                            </button>
                                          </div>
                                        </form>
                                      </div>
                                    )}

                                    {isOpCompleted && (
                                      <div className="production-job-result">
                                        <CheckCircle2 size={13} color="var(--sp-success)" />
                                        <span>
                                          <b>{op.producedQuantity} produced</b> · {op.scrapQuantity} scrap · {op.reworkQuantity} rework · {op.actualSetupMinutes ?? 0}m setup · {op.actualRunMinutes ?? 0}m run
                                          {op.downtimeMinutes ? ` · ${op.downtimeMinutes}m downtime (${op.downtimeReason})` : ''}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Order Master Actions Bar */}
                        <div className="production-order-actions">
                          <CustomFieldEditor resource="work_orders" recordId={order.id} />

                          {order.status === 'DRAFT' && canManage && (
                            <button
                              type="button"
                              className="button button-primary"
                              disabled={saving || hasShortages}
                              onClick={() => run(`/work-orders/${order.id}/release`)}
                              style={{ height: '30px', fontSize: '12px' }}
                            >
                              Check Stock & Release
                            </button>
                          )}

                          {['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(order.status) && canManage && (
                            <button
                              type="button"
                              className="button button-primary"
                              onClick={() => setOutputOrder(order)}
                              disabled={order.operations?.some((op) => op.status !== 'COMPLETED')}
                              title={order.operations?.some((op) => op.status !== 'COMPLETED') ? 'Complete all routing operations first' : ''}
                              style={{ height: '30px', fontSize: '12px' }}
                            >
                              <Package size={13} />
                              <span>Record Output</span>
                            </button>
                          )}

                          {order.reworkQuantity > 0 && ['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(order.status) && (
                            <form
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
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
                              <input name="goodQuantity" type="number" min="0" placeholder="Good" defaultValue="0" className="warehouse-count-input" style={{ width: '60px' }} />
                              <input name="scrapQuantity" type="number" min="0" max={order.reworkQuantity} placeholder="Scrap" defaultValue="0" className="warehouse-count-input" style={{ width: '60px' }} />
                              <button className="mini-action" disabled={saving}>Complete Rework</button>
                            </form>
                          )}

                          {order.status === 'IN_PROGRESS' && (
                            <button type="button" className="mini-action muted" onClick={() => run(`/work-orders/${order.id}/pause`)}>
                              Pause Order
                            </button>
                          )}

                          {order.status === 'PAUSED' && (
                            <button type="button" className="mini-action" onClick={() => run(`/work-orders/${order.id}/resume`)}>
                              Resume Order
                            </button>
                          )}

                          {order.status === 'COMPLETED' && canManage && (
                            <button type="button" className="mini-action" onClick={() => run(`/work-orders/${order.id}/close`)}>
                              Close Order
                            </button>
                          )}

                          {['DRAFT', 'RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(order.status) && canManage && (
                            <button type="button" className="mini-action muted" onClick={() => run(`/work-orders/${order.id}/cancel`)}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="panel directory-panel" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--sp-text-muted)' }}>
              No production work orders found matching criteria.
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: BILLS OF MATERIAL */}
      {activeTab === 'boms' && (
        <section className="panel directory-panel" style={{ margin: 0 }}>
          <div className="warehouse-action-bar">
            <div className="warehouse-search-wrapper" style={{ minWidth: '260px' }}>
              <Search size={13} className="warehouse-search-icon" />
              <input
                type="text"
                placeholder="Search finished SKU, item, revision… ⌘K"
                value={bomSearch}
                onChange={(e) => setBomSearch(e.target.value)}
                className="warehouse-search-input"
              />
              {bomSearch && (
                <button
                  type="button"
                  className="warehouse-clear-btn"
                  onClick={() => setBomSearch('')}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="warehouse-filter-pills">
              <button
                type="button"
                className={`warehouse-pill ${bomStatusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setBomStatusFilter('ALL')}
              >
                All Revisions ({boms.length})
              </button>
              <button
                type="button"
                className={`warehouse-pill ${bomStatusFilter === 'APPROVED' ? 'active' : ''}`}
                onClick={() => setBomStatusFilter('APPROVED')}
              >
                Approved ({boms.filter((b) => b.status === 'APPROVED').length})
              </button>
              <button
                type="button"
                className={`warehouse-pill ${bomStatusFilter === 'DRAFT' ? 'active' : ''}`}
                onClick={() => setBomStatusFilter('DRAFT')}
              >
                Draft ({boms.filter((b) => b.status === 'DRAFT').length})
              </button>
            </div>

            <div className="warehouse-bar-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={exportBomsCsv}
                disabled={filteredBoms.length === 0}
                style={{ height: '32px', fontSize: '12px' }}
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>

              {canManage && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    resetBomForm();
                    setIsBomModalOpen(true);
                  }}
                  style={{ height: '32px', fontSize: '12.5px' }}
                >
                  <Plus size={13} />
                  <span>Create BOM Revision</span>
                </button>
              )}
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>FINISHED ITEM</th>
                  <th>REVISION</th>
                  <th>COMPONENTS RECIPE</th>
                  <th>ROUTING OPERATIONS</th>
                  <th>EFFECTIVE PERIOD</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredBoms.length > 0 ? (
                  filteredBoms.map((bom) => (
                    <tr key={bom.id}>
                      <td>
                        <b>{bom.finishedSku}</b>
                        <small className="production-subline">{bom.finishedItemName}</small>
                      </td>
                      <td>
                        <span className="revision-tag">{bom.revision}</span>
                      </td>
                      <td style={{ maxWidth: '220px' }}>
                        <div className="truncate-text" style={{ maxWidth: '210px' }} title={bom.lines.map((l) => `${l.sku} × ${l.quantityPerUnit}`).join(', ')}>
                          {bom.lines.map((l) => `${l.sku} × ${l.quantityPerUnit}${l.scrapAllowancePercent > 0 ? ` (+${l.scrapAllowancePercent}%)` : ''}`).join(', ')}
                        </div>
                      </td>
                      <td>
                        {bom.operations && bom.operations.length > 0 ? (
                          <span style={{ fontSize: '12px', color: 'var(--sp-text)' }}>
                            {bom.operations.length} operations ({bom.operations.map((op) => op.workCenterCode).join(' → ')})
                          </span>
                        ) : (
                          <span style={{ color: 'var(--sp-text-muted)' }}>No routing defined</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--sp-text-secondary)', fontSize: '12px' }}>
                        {bom.effectiveFrom} {bom.effectiveTo ? `– ${bom.effectiveTo}` : '— Active'}
                      </td>
                      <td>
                        <Status label={formatAuditLabel(bom.status)} />
                      </td>
                      <td>
                        <div className="action-inline">
                          {bom.status === 'DRAFT' && canManage && (
                            <>
                              <button type="button" className="mini-action" disabled={saving} onClick={() => editBom(bom)}>
                                Edit Draft
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
        </section>
      )}

      {/* 5. TAB 3: WORK CENTERS */}
      {activeTab === 'work-centers' && (
        <section className="panel directory-panel" style={{ margin: 0 }}>
          <div className="warehouse-action-bar">
            <div className="warehouse-search-wrapper" style={{ minWidth: '260px' }}>
              <Search size={13} className="warehouse-search-icon" />
              <input
                type="text"
                placeholder="Search station code, name, description…"
                value={workCenterSearch}
                onChange={(e) => setWorkCenterSearch(e.target.value)}
                className="warehouse-search-input"
              />
              {workCenterSearch && (
                <button
                  type="button"
                  className="warehouse-clear-btn"
                  onClick={() => setWorkCenterSearch('')}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="warehouse-filter-pills">
              <button
                type="button"
                className={`warehouse-pill ${workCenterStatusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setWorkCenterStatusFilter('ALL')}
              >
                All ({workCenters.length})
              </button>
              <button
                type="button"
                className={`warehouse-pill ${workCenterStatusFilter === 'ACTIVE' ? 'active' : ''}`}
                onClick={() => setWorkCenterStatusFilter('ACTIVE')}
              >
                Active ({workCenters.filter((c) => c.active).length})
              </button>
              <button
                type="button"
                className={`warehouse-pill ${workCenterStatusFilter === 'INACTIVE' ? 'active' : ''}`}
                onClick={() => setWorkCenterStatusFilter('INACTIVE')}
              >
                Inactive ({workCenters.filter((c) => !c.active).length})
              </button>
            </div>

            <div className="warehouse-bar-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={exportWorkCentersCsv}
                disabled={filteredWorkCenters.length === 0}
                style={{ height: '32px', fontSize: '12px' }}
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>

              {canManage && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setIsWorkCenterModalOpen(true)}
                  style={{ height: '32px', fontSize: '12.5px' }}
                >
                  <Plus size={13} />
                  <span>Add Work Center</span>
                </button>
              )}
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>STATION CODE</th>
                  <th>WORK CENTER NAME</th>
                  <th>DESCRIPTION & CAPABILITY</th>
                  <th style={{ textAlign: 'right' }}>LABOR / HOUR</th>
                  <th style={{ textAlign: 'right' }}>OVERHEAD / HOUR</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkCenters.length > 0 ? (
                  filteredWorkCenters.map((center) => (
                    <tr key={center.id}>
                      <td>
                        <span className="station-code-pill">{center.code}</span>
                      </td>
                      <td>
                        <b>{center.name}</b>
                      </td>
                      <td style={{ color: 'var(--sp-text-secondary)', maxWidth: '280px' }}>
                        <span className="truncate-text" style={{ maxWidth: '260px' }} title={center.description || ''}>
                          {center.description || '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {center.laborRatePerHour == null ? 'Restricted' : formatCurrency(center.laborRatePerHour)}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {center.overheadRatePerHour == null ? 'Restricted' : formatCurrency(center.overheadRatePerHour)}
                      </td>
                      <td>
                        <Status label={center.active ? 'Active' : 'Inactive'} />
                      </td>
                      <td>
                        <div className="action-inline">
                          <button
                            type="button"
                            className="mini-action muted"
                            onClick={() => showQueue(center)}
                          >
                            {queueCenterId === center.id ? 'Hide Queue' : 'Station Queue'}
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              className="mini-action"
                              disabled={saving}
                              onClick={() => run(`/work-centers/${center.id}/active`, 'PATCH', { active: !center.active })}
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
        </section>
      )}

      {/* 6. TAB 4: SHOP FLOOR DISPATCH */}
      {activeTab === 'dispatch' && (
        <section className="panel directory-panel" style={{ margin: 0 }}>
          <div className="warehouse-action-bar">
            <div className="warehouse-location-picker">
              <label htmlFor="station-filter" className="warehouse-picker-label">
                <Factory size={13} />
                <span>Station:</span>
              </label>
              <select
                id="station-filter"
                className="warehouse-select-input"
                value={dispatchStationFilter}
                onChange={(e) => setDispatchStationFilter(e.target.value)}
              >
                <option value="ALL">All Work Stations</option>
                {workCenters.map((wc) => (
                  <option key={wc.id} value={wc.id}>
                    {wc.code} — {wc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="warehouse-bar-actions">
              <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                {shopFloorJobCards.length} Operations Queued / In Progress
              </span>
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            {shopFloorJobCards.length > 0 ? (
              <div className="production-job-grid">
                {shopFloorJobCards.map(({ operation: op, order }) => (
                  <div key={op.id} className={`production-job-card ${op.status.toLowerCase()}`}>
                    <div className="production-job-top">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="sequence-badge">OP {String(op.sequence).padStart(2, '0')}</span>
                          <span className="order-number-pill">{order.orderNumber}</span>
                          <span className={`priority-tag priority-${order.priority.toLowerCase()}`}>
                            {order.priority}
                          </span>
                        </div>
                        <div style={{ marginTop: '4px' }}>
                          <b style={{ fontSize: '13px', color: 'var(--sp-text)' }}>{op.name}</b>
                          <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                            {order.finishedSku} · {order.finishedItemName} (Target: {order.targetQuantity})
                          </div>
                        </div>
                      </div>
                      <Status label={formatAuditLabel(op.status)} />
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--sp-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="station-code-pill">{op.workCenterCode}</span>
                      <span>{op.workCenterName}</span>
                      <span>·</span>
                      <span>Planned {op.setupMinutes}m setup + {Math.ceil(Number(op.runMinutesPerUnit) * order.targetQuantity)}m run</span>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                        {op.status === 'IN_PROGRESS' ? (
                          <span style={{ color: 'var(--sp-brand)', fontWeight: 600 }}>Active at Station</span>
                        ) : (
                          <span>Ready for pickup</span>
                        )}
                      </div>

                      {op.status === 'PENDING' && (
                        <button
                          type="button"
                          className="mini-action"
                          disabled={saving}
                          onClick={() => run(`/work-orders/${order.id}/operations/${op.id}/start`)}
                        >
                          <Play size={11} style={{ marginRight: '4px' }} />
                          Start Operation
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--sp-text-muted)' }}>
                No operations currently awaiting dispatch or running on the shop floor.
              </div>
            )}
          </div>
        </section>
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
    </div>
  );
}
