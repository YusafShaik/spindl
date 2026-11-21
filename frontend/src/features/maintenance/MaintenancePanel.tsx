import { useState, useEffect, useMemo, useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  Factory,
  FileText,
  Filter,
  Flame,
  Gauge,
  HardHat,
  History,
  LayoutGrid,
  LayoutList,
  Package,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  User,
  Warehouse as WarehouseIcon,
  Wrench,
  X
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import { Status } from '../../components/ui/Status';
import type {
  AssetSummary,
  MaintenanceSchedule,
  MaintenanceWorkOrder,
  MaintenanceMetrics,
  MaintenanceChecklistItem,
  PartConsumptionItem
} from '../../types/maintenance';
import type { ItemSummary, WarehouseSummary } from '../../types/inventory';

export interface PartFormLine {
  tempId: string;
  partSource: 'INTERNAL' | 'EXTERNAL';
  itemId: string;
  warehouseId: string;
  externalPartName: string;
  externalPartNumber: string;
  supplierName: string;
  invoiceReference: string;
  quantity: string;
  unitCost: string;
}

interface MaintenancePanelProps {
  items: ItemSummary[];
  role?: string;
  notify: (message: string) => void;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  align?: 'left' | 'center';
}

function StyledTooltip({ content, children, align = 'center' }: TooltipProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!targetRef.current) return;
    const rect = targetRef.current.getBoundingClientRect();
    setCoords({
      top: rect.top - 7,
      left: align === 'left' ? rect.left : rect.left + rect.width / 2,
    });
  };

  const handleMouseLeave = () => {
    setCoords(null);
  };

  return (
    <div
      ref={targetRef}
      className="sp-tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {coords && content && createPortal(
        <div
          className={`sp-styled-tooltip-portal ${align === 'left' ? 'align-left' : ''}`}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: align === 'left' ? 'translateY(-100%)' : 'translate(-50%, -100%)',
            zIndex: 99999,
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
}

export function MaintenancePanel({ items, role, notify }: MaintenancePanelProps) {
  // Navigation & Data States
  const [activeTab, setActiveTab] = useState<'work-orders' | 'schedules' | 'assets' | 'telemetry'>('work-orders');
  const [ordersViewMode, setOrdersViewMode] = useState<'list' | 'board'>('list');

  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>([]);
  const [metrics, setMetrics] = useState<MaintenanceMetrics | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [teamUsers, setTeamUsers] = useState<Array<{ id: string; name: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'BREAKDOWN' | 'PREVENTIVE' | 'COMPLETED'>('ALL');

  // Modals & Navigation
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [newOrderType, setNewOrderType] = useState<'BREAKDOWN' | 'PREVENTIVE'>('BREAKDOWN');
  const [newOrderTechType, setNewOrderTechType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [newOrderContractor, setNewOrderContractor] = useState('');
  const [preselectedAssetId, setPreselectedAssetId] = useState<string>('');
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<MaintenanceWorkOrder | null>(null);

  // Complete Order & Contractor Costing Modal
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completingOrder, setCompletingOrder] = useState<MaintenanceWorkOrder | null>(null);
  const [completeRootCause, setCompleteRootCause] = useState('');
  const [completeResolution, setCompleteResolution] = useState('');
  const [completeDowntime, setCompleteDowntime] = useState('60');

  // Technician & Contractor details in Complete Modal
  const [completeModalError, setCompleteModalError] = useState('');
  const [partsConsumedMode, setPartsConsumedMode] = useState<'NONE' | 'PARTS'>('NONE');
  const [completeTechType, setCompleteTechType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [completeAssignedTechId, setCompleteAssignedTechId] = useState('');
  const [completeContractorName, setCompleteContractorName] = useState('');
  const [completeExternalInvoice, setCompleteExternalInvoice] = useState('');
  const [completeLaborCost, setCompleteLaborCost] = useState('0');

  // Multi-part spare parts consumed list
  const [completePartsList, setCompletePartsList] = useState<PartFormLine[]>([]);

  const [isNewAssetModalOpen, setIsNewAssetModalOpen] = useState(false);
  const [isNewScheduleModalOpen, setIsNewScheduleModalOpen] = useState(false);

  // Helper to select an order and remember it across browser refresh
  const selectOrder = (order: MaintenanceWorkOrder | null) => {
    setSelectedOrderForDrawer(order);
    if (order) {
      localStorage.setItem('spindl_maint_order_id', order.id);
    } else {
      localStorage.removeItem('spindl_maint_order_id');
    }
  };

  // Background refresh for metrics and assets
  const refreshMetricsAndAssets = async () => {
    try {
      const [assetsRes, metricsRes] = await Promise.all([
        apiFetch(`${API}/maintenance/assets`).then((r) => (r.ok ? r.json() : [])),
        apiFetch(`${API}/maintenance/metrics`).then((r) => (r.ok ? r.json() : null))
      ]);
      if (assetsRes) setAssets(assetsRes);
      if (metricsRes) setMetrics(metricsRes);
    } catch {
      // non-blocking
    }
  };

  // Main Data Refresh
  const refresh = async () => {
    setLoading(true);
    try {
      const [assetsRes, schedulesRes, ordersRes, metricsRes, whRes] = await Promise.all([
        apiFetch(`${API}/maintenance/assets`).then((r) => (r.ok ? r.json() : [])),
        apiFetch(`${API}/maintenance/schedules`).then((r) => (r.ok ? r.json() : [])),
        apiFetch(`${API}/maintenance/work-orders`).then((r) => (r.ok ? r.json() : [])),
        apiFetch(`${API}/maintenance/metrics`).then((r) => (r.ok ? r.json() : null)),
        apiFetch(`${API}/inventory/warehouses`).then((r) => (r.ok ? r.json() : []))
      ]);

      setAssets(assetsRes);
      setSchedules(schedulesRes);
      setWorkOrders(ordersRes);
      setMetrics(metricsRes);
      setWarehouses(whRes);

      // Restore active order from localStorage if saved
      const savedOrderId = localStorage.getItem('spindl_maint_order_id');
      if (savedOrderId && Array.isArray(ordersRes)) {
        const matched = ordersRes.find((o: MaintenanceWorkOrder) => o.id === savedOrderId);
        if (matched) {
          setSelectedOrderForDrawer(matched);
        }
      }

      // Fetch team users for technician assignment
      try {
        const teamRes = await apiFetch(`${API}/team/members`).then((r) => (r.ok ? r.json() : []));
        setTeamUsers(teamRes.map((m: any) => ({ id: m.userId || m.id, name: m.displayName || m.name || m.email })));
      } catch {
        // Fallback team list
      }
    } catch {
      notify('Could not load maintenance CMMS data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Filtered Work Orders
  const filteredWorkOrders = useMemo(() => {
    let result = workOrders;
    if (quickFilter === 'OPEN') {
      result = result.filter((w) => w.status === 'OPEN');
    } else if (quickFilter === 'IN_PROGRESS') {
      result = result.filter((w) => w.status === 'IN_PROGRESS');
    } else if (quickFilter === 'BREAKDOWN') {
      result = result.filter((w) => w.type === 'BREAKDOWN');
    } else if (quickFilter === 'PREVENTIVE') {
      result = result.filter((w) => w.type === 'PREVENTIVE');
    } else if (quickFilter === 'COMPLETED') {
      result = result.filter((w) => w.status === 'COMPLETED');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (w) =>
          w.orderNumber.toLowerCase().includes(q) ||
          w.assetCode.toLowerCase().includes(q) ||
          w.assetName.toLowerCase().includes(q) ||
          (w.failureSymptom && w.failureSymptom.toLowerCase().includes(q)) ||
          (w.assignedTechnicianName && w.assignedTechnicianName.toLowerCase().includes(q)) ||
          (w.externalContractorName && w.externalContractorName.toLowerCase().includes(q))
      );
    }
    return result;
  }, [workOrders, quickFilter, searchQuery]);

  const openOrdersCount = useMemo(() => workOrders.filter((w) => w.status === 'OPEN').length, [workOrders]);
  const inProgressCount = useMemo(() => workOrders.filter((w) => w.status === 'IN_PROGRESS').length, [workOrders]);
  const breakdownCount = useMemo(() => workOrders.filter((w) => w.type === 'BREAKDOWN').length, [workOrders]);
  const preventiveCount = useMemo(() => workOrders.filter((w) => w.type === 'PREVENTIVE').length, [workOrders]);
  const completedCount = useMemo(() => workOrders.filter((w) => w.status === 'COMPLETED').length, [workOrders]);

  // Actions
  const handleStartWorkOrder = async (order: MaintenanceWorkOrder) => {
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/maintenance/work-orders/${order.id}/start`, { method: 'POST' });
      if (!res.ok) throw new Error('Could not start work order');
      const updated: MaintenanceWorkOrder = await res.json();
      notify(`Started work on ${order.orderNumber}`);

      // Instant in-place state update without needing page reload
      setWorkOrders((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      if (selectedOrderForDrawer?.id === updated.id) {
        selectOrder(updated);
      }
      void refreshMetricsAndAssets();
    } catch (err: any) {
      notify(err.message || 'Error starting work order');
    } finally {
      setBusy(false);
    }
  };

  const openCompleteModal = (order: MaintenanceWorkOrder) => {
    setCompletingOrder(order);
    setCompleteModalError('');
    setCompleteRootCause(order.rootCause || '');
    setCompleteResolution(order.resolutionNotes || '');
    setCompleteDowntime(order.downtimeMinutes > 0 ? String(order.downtimeMinutes) : '60');

    // Set technician type & details
    if (order.technicianType === 'EXTERNAL' || order.externalContractorName) {
      setCompleteTechType('EXTERNAL');
      setCompleteContractorName(order.externalContractorName || '');
      setCompleteExternalInvoice(order.externalInvoiceRef || '');
    } else {
      setCompleteTechType('INTERNAL');
      setCompleteAssignedTechId(order.assignedTechnicianUserId || (teamUsers[0]?.id || ''));
      setCompleteContractorName('');
      setCompleteExternalInvoice('');
    }
    setCompleteLaborCost(order.laborCost && order.laborCost > 0 ? String(order.laborCost) : '0');

    // Prepopulate parts if any, else empty list
    if (order.partsConsumed && order.partsConsumed.length > 0) {
      setPartsConsumedMode('PARTS');
      setCompletePartsList(
        order.partsConsumed.map((p, idx) => ({
          tempId: `part_${Date.now()}_${idx}`,
          partSource: (p.partSource as 'INTERNAL' | 'EXTERNAL') || 'INTERNAL',
          itemId: p.itemId || items[0]?.id || '',
          warehouseId: p.warehouseId || warehouses[0]?.id || '',
          externalPartName: p.externalPartName || '',
          externalPartNumber: p.externalPartNumber || '',
          supplierName: p.supplierName || '',
          invoiceReference: p.invoiceReference || '',
          quantity: String(p.quantity || 1),
          unitCost: String(p.unitCost || 0)
        }))
      );
    } else {
      setPartsConsumedMode('NONE');
      setCompletePartsList([]);
    }

    setIsCompleteModalOpen(true);
  };

  const handleAddPartLine = (source: 'INTERNAL' | 'EXTERNAL' = 'INTERNAL') => {
    const defaultItem = items[0];
    setPartsConsumedMode('PARTS');
    setCompletePartsList((prev) => [
      ...prev,
      {
        tempId: `part_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        partSource: source,
        itemId: defaultItem?.id || '',
        warehouseId: warehouses[0]?.id || '',
        externalPartName: '',
        externalPartNumber: '',
        supplierName: '',
        invoiceReference: '',
        quantity: '1',
        unitCost: defaultItem?.unitPrice ? String(defaultItem.unitPrice) : '0'
      }
    ]);
  };

  const handleRemovePartLine = (tempId: string) => {
    setCompletePartsList((prev) => {
      const next = prev.filter((p) => p.tempId !== tempId);
      if (next.length === 0) {
        setPartsConsumedMode('NONE');
      }
      return next;
    });
  };

  const handleUpdatePartLine = (tempId: string, updates: Partial<PartFormLine>) => {
    setCompletePartsList((prev) =>
      prev.map((p) => {
        if (p.tempId !== tempId) return p;
        const updated = { ...p, ...updates };
        if (updates.itemId && updates.itemId !== p.itemId) {
          const it = items.find((i) => i.id === updates.itemId);
          if (it?.unitPrice) {
            updated.unitCost = String(it.unitPrice);
          }
        }
        return updated;
      })
    );
  };

  const modalCalculatedPartsTotal = useMemo(() => {
    if (partsConsumedMode === 'NONE') return 0;
    return completePartsList.reduce((sum, line) => {
      const q = Number(line.quantity) || 0;
      let c = Number(line.unitCost) || 0;
      if (line.partSource === 'INTERNAL' && !line.unitCost) {
        const itemObj = items.find((i) => i.id === line.itemId);
        c = itemObj?.unitPrice ? Number(itemObj.unitPrice) : 0;
      }
      return sum + q * c;
    }, 0);
  }, [completePartsList, partsConsumedMode, items]);

  const modalCalculatedTotalCost = useMemo(() => {
    const labor = Number(completeLaborCost) || 0;
    return labor + modalCalculatedPartsTotal;
  }, [completeLaborCost, modalCalculatedPartsTotal]);

  const handleCompleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!completingOrder) return;
    setCompleteModalError('');
    setBusy(true);
    try {
      const partsPayload = partsConsumedMode === 'NONE'
        ? []
        : completePartsList
            .filter((p) => {
              if (p.partSource === 'INTERNAL') {
                return Boolean(p.itemId) && Number(p.quantity) > 0;
              } else {
                return Boolean(p.externalPartName?.trim()) && Number(p.quantity) > 0;
              }
            })
            .map((p) => {
              if (p.partSource === 'INTERNAL') {
                const itemObj = items.find((i) => i.id === p.itemId);
                return {
                  partSource: 'INTERNAL',
                  itemId: p.itemId,
                  warehouseId: p.warehouseId || null,
                  quantity: Number(p.quantity) || 1,
                  unitCost: Number(p.unitCost) || (itemObj?.unitPrice ? Number(itemObj.unitPrice) : 0)
                };
              } else {
                return {
                  partSource: 'EXTERNAL',
                  itemId: null,
                  warehouseId: null,
                  externalPartName: p.externalPartName.trim(),
                  externalPartNumber: p.externalPartNumber?.trim() || null,
                  supplierName: p.supplierName?.trim() || null,
                  invoiceReference: p.invoiceReference?.trim() || null,
                  quantity: Number(p.quantity) || 1,
                  unitCost: Number(p.unitCost) || 0
                };
              }
            });

      const payload = {
        rootCause: completeRootCause.trim() || 'Diagnostic complete / wear verified',
        resolutionNotes: completeResolution.trim() || 'Service completed, parts fitted, and test run verified',
        downtimeMinutes: Number(completeDowntime) || 0,
        technicianType: completeTechType,
        assignedTechnicianId: completeTechType === 'INTERNAL' ? completeAssignedTechId || null : null,
        externalContractorName: completeTechType === 'EXTERNAL' ? completeContractorName.trim() || null : null,
        externalInvoiceRef: completeTechType === 'EXTERNAL' ? completeExternalInvoice.trim() || null : null,
        laborCost: Number(completeLaborCost) || 0,
        partsConsumed: partsPayload
      };

      const res = await apiFetch(`${API}/maintenance/work-orders/${completingOrder.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Could not complete work order');
      }

      const updatedOrder: MaintenanceWorkOrder = await res.json();
      notify(`${completingOrder.orderNumber} resolved · Machinery returned to OPERATIONAL`);
      setIsCompleteModalOpen(false);
      setCompletingOrder(null);

      // Instant in-place state update without needing page reload
      setWorkOrders((prev) => prev.map((w) => (w.id === updatedOrder.id ? updatedOrder : w)));
      if (selectedOrderForDrawer?.id === updatedOrder.id) {
        selectOrder(updatedOrder);
      }
      void refreshMetricsAndAssets();
    } catch (err: any) {
      const msg = err.message || 'Error completing work order';
      setCompleteModalError(msg);
      notify(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelWorkOrder = async (order: MaintenanceWorkOrder) => {
    if (!window.confirm(`Cancel maintenance order ${order.orderNumber}?`)) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/maintenance/work-orders/${order.id}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Could not cancel order');
      const updated: MaintenanceWorkOrder = await res.json();
      notify(`Cancelled ${order.orderNumber}`);

      // Instant in-place state update without needing page reload
      setWorkOrders((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      if (selectedOrderForDrawer?.id === updated.id) {
        selectOrder(updated);
      }
      void refreshMetricsAndAssets();
    } catch (err: any) {
      notify(err.message || 'Error cancelling order');
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerSchedule = async (schedule: MaintenanceSchedule) => {
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/maintenance/work-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: schedule.assetId,
          scheduleId: schedule.id,
          type: 'PREVENTIVE',
          priority: 'MEDIUM',
          failureSymptom: `Routine Preventive Maintenance: ${schedule.title}`,
          scheduledDate: new Date().toISOString().slice(0, 10)
        })
      });
      if (!res.ok) throw new Error('Could not dispatch preventive work order');
      const created = await res.json();
      notify(`Preventive order ${created.orderNumber} dispatched!`);
      setActiveTab('work-orders');
      setWorkOrders((prev) => [created, ...prev]);
      void refreshMetricsAndAssets();
    } catch (err: any) {
      notify(err.message || 'Error creating work order');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateOrderSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/maintenance/work-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: form.get('assetId'),
          type: form.get('type'),
          priority: form.get('priority'),
          technicianType: newOrderTechType,
          assignedTechnicianUserId: newOrderTechType === 'INTERNAL' ? form.get('technicianId') || null : null,
          externalContractorName: newOrderTechType === 'EXTERNAL' ? newOrderContractor.trim() || null : null,
          failureSymptom: form.get('symptom'),
          scheduledDate: form.get('scheduledDate') || new Date().toISOString().slice(0, 10)
        })
      });
      if (!res.ok) throw new Error('Could not create maintenance work order');
      const saved = await res.json();
      notify(`Maintenance order ${saved.orderNumber} created`);
      setIsNewOrderModalOpen(false);
      setNewOrderContractor('');
      setWorkOrders((prev) => [saved, ...prev]);
      void refreshMetricsAndAssets();
    } catch (err: any) {
      notify(err.message || 'Error creating work order');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAssetSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/maintenance/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.get('code'),
          name: form.get('name'),
          serialNumber: form.get('serialNumber'),
          manufacturer: form.get('manufacturer'),
          model: form.get('model'),
          meterHours: Number(form.get('meterHours') || 0),
          notes: form.get('notes')
        })
      });
      if (!res.ok) throw new Error('Could not create machinery asset');
      notify('Machinery asset registered successfully');
      setIsNewAssetModalOpen(false);
      await refresh();
    } catch (err: any) {
      notify(err.message || 'Error creating asset');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateScheduleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/maintenance/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: form.get('assetId'),
          title: form.get('title'),
          frequencyType: form.get('frequencyType'),
          frequencyInterval: Number(form.get('interval') || 30),
          checklist: JSON.stringify([
            { step: 'Check fluid levels, seals, and pressure gauge', done: false },
            { step: 'Inspect electrical cabling and emergency stop function', done: false },
            { step: 'Clean air filters and wipe guideway surfaces', done: false }
          ])
        })
      });
      if (!res.ok) throw new Error('Could not create maintenance schedule');
      notify('Preventive maintenance schedule created');
      setIsNewScheduleModalOpen(false);
      await refresh();
    } catch (err: any) {
      notify(err.message || 'Error creating schedule');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sales-screen-layout">
      {selectedOrderForDrawer ? (
        /* =========================================================================
           AUTHENTIC LINEAR DETAIL VIEW: COMPACT, HIGH-DENSITY MAINTENANCE ORDER
           ========================================================================= */
        <div className="linear-detail-container">
          {/* Top Bar with Breadcrumbs & Actions */}
          <div className="linear-detail-topbar">
            <div className="linear-detail-breadcrumbs">
              <button
                type="button"
                className="linear-crumb-back"
                onClick={() => selectOrder(null)}
              >
                <ArrowLeft size={13} />
                <span>Maintenance Orders</span>
              </button>
              <span className="linear-crumb-sep">/</span>
              <span className="linear-crumb-id">{selectedOrderForDrawer.orderNumber}</span>
            </div>

            <div className="linear-detail-top-actions">
              {selectedOrderForDrawer.status === 'OPEN' && (
                <button
                  type="button"
                  className="sales-action-btn primary"
                  onClick={async () => {
                    await handleStartWorkOrder(selectedOrderForDrawer);
                  }}
                  disabled={busy}
                >
                  <Play size={12} />
                  <span>Start Repair Work</span>
                </button>
              )}

              {selectedOrderForDrawer.status === 'IN_PROGRESS' && (
                <button
                  type="button"
                  className="sales-action-btn primary"
                  onClick={() => openCompleteModal(selectedOrderForDrawer)}
                  disabled={busy}
                >
                  <Check size={12} />
                  <span>Complete Maintenance</span>
                </button>
              )}

              {selectedOrderForDrawer.status !== 'COMPLETED' && selectedOrderForDrawer.status !== 'CANCELLED' && (
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={async () => {
                    await handleCancelWorkOrder(selectedOrderForDrawer);
                  }}
                  disabled={busy}
                >
                  <X size={12} />
                  <span>Cancel Order</span>
                </button>
              )}

              {selectedOrderForDrawer.status === 'COMPLETED' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--sp-success)' }}>
                  <CheckCircle2 size={14} />
                  <span>Maintenance Order Resolved & Verified</span>
                </div>
              )}
            </div>
          </div>

          {/* 2-Column Linear Layout */}
          <div className="linear-detail-grid">
            {/* Left Column: Narrative & Detailed Data */}
            <div className="linear-detail-content">
              {/* Title & Badges */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span className="order-number-pill" style={{ cursor: 'default' }}>
                    {selectedOrderForDrawer.orderNumber}
                  </span>
                  <Status label={selectedOrderForDrawer.status} />
                  <span className={`priority-tag priority-${selectedOrderForDrawer.priority.toLowerCase()}`}>
                    {selectedOrderForDrawer.priority}
                  </span>
                  <span className="sales-warehouse-pill" style={{ textTransform: 'capitalize' }}>
                    {selectedOrderForDrawer.type.toLowerCase()}
                  </span>
                  {selectedOrderForDrawer.technicianType === 'EXTERNAL' ? (
                    <span className="sales-fulfillment-tag pending" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                      <Briefcase size={11} />
                      <span>Contractor: {selectedOrderForDrawer.externalContractorName || 'Third-Party'}</span>
                    </span>
                  ) : (
                    <span className="sales-warehouse-pill" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                      <User size={11} />
                      <span>In-House: {selectedOrderForDrawer.assignedTechnicianName || 'Plant Maintenance'}</span>
                    </span>
                  )}
                </div>

                <h1 className="linear-detail-h1">{selectedOrderForDrawer.assetName}</h1>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--sp-text-muted)' }}>
                  Asset Code: <strong style={{ color: 'var(--sp-text)' }}>{selectedOrderForDrawer.assetCode}</strong> · Work Center: <strong style={{ color: 'var(--sp-text)' }}>{selectedOrderForDrawer.workCenterName || 'Plant Floor'}</strong>
                </p>
              </div>

              {/* Section 1: Incident Diagnosis & Resolution */}
              <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wrench size={13} style={{ color: 'var(--sp-brand)' }} />
                  <span>Incident Symptoms & Work Target</span>
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--sp-text)', marginBottom: (selectedOrderForDrawer.rootCause || selectedOrderForDrawer.resolutionNotes) ? '12px' : 0 }}>
                  {selectedOrderForDrawer.failureSymptom || 'Routine preventive inspection, lubrication, and calibration.'}
                </div>

                {(selectedOrderForDrawer.rootCause || selectedOrderForDrawer.resolutionNotes) && (
                  <div style={{ borderTop: '1px solid var(--sp-border-subtle)', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px', letterSpacing: '0.04em' }}>
                        Root Cause of Failure
                      </span>
                      <span style={{ fontSize: '12.5px', color: 'var(--sp-text)', lineHeight: 1.4 }}>
                        {selectedOrderForDrawer.rootCause || 'Diagnostic complete / wear verified'}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px', letterSpacing: '0.04em' }}>
                        Resolution & Actions Taken
                      </span>
                      <span style={{ fontSize: '12.5px', color: 'var(--sp-text)', lineHeight: 1.4 }}>
                        {selectedOrderForDrawer.resolutionNotes || '—'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Repair Cost & Billing Allocation */}
              <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Receipt size={13} style={{ color: 'var(--sp-brand)' }} />
                    <span>Repair Cost Accounting & Capitalization</span>
                  </div>
                  {selectedOrderForDrawer.technicianType === 'EXTERNAL' && selectedOrderForDrawer.externalInvoiceRef && (
                    <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                      Contractor Inv #: <code className="sales-ref-badge">{selectedOrderForDrawer.externalInvoiceRef}</code>
                    </span>
                  )}
                </div>

                {/* 3 Metric Cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ padding: '10px 12px', background: 'var(--sp-surface-subtle)', border: '1px solid var(--sp-border-subtle)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', display: 'block' }}>
                      {selectedOrderForDrawer.technicianType === 'EXTERNAL' ? 'Contractor Fee' : 'Labor Cost'}
                    </span>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--sp-text)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(selectedOrderForDrawer.laborCost || 0)}
                    </div>
                    <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)' }}>
                      {selectedOrderForDrawer.technicianType === 'EXTERNAL' ? (selectedOrderForDrawer.externalContractorName || 'Third-Party') : 'In-House'}
                    </span>
                  </div>

                  <div style={{ padding: '10px 12px', background: 'var(--sp-surface-subtle)', border: '1px solid var(--sp-border-subtle)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', display: 'block' }}>
                      Parts Cost
                    </span>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--sp-text)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(selectedOrderForDrawer.partsCost || 0)}
                    </div>
                    <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)' }}>
                      {selectedOrderForDrawer.partsConsumed?.length || 0} component(s) used
                    </span>
                  </div>

                  <div style={{ padding: '10px 12px', background: 'var(--sp-brand-soft)', border: '1px solid var(--sp-border)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--sp-brand)', fontWeight: 600, display: 'block' }}>
                      Total Capitalized
                    </span>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--sp-brand)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(selectedOrderForDrawer.totalCost || 0)}
                    </div>
                    <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)' }}>
                      Added to machine asset
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Replacement Spare Parts */}
              <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sp-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Boxes size={13} style={{ color: 'var(--sp-brand)' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                      Replacement Parts Consumed ({selectedOrderForDrawer.partsConsumed?.length || 0})
                    </span>
                  </div>
                  {selectedOrderForDrawer.partsConsumed && selectedOrderForDrawer.partsConsumed.length > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                      Total Parts: <strong style={{ color: 'var(--sp-text)' }}>{formatCurrency(selectedOrderForDrawer.partsCost || 0)}</strong>
                    </span>
                  )}
                </div>

                {selectedOrderForDrawer.partsConsumed && selectedOrderForDrawer.partsConsumed.length > 0 ? (
                  <table className="sales-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>Source</th>
                        <th>Part Description</th>
                        <th>Warehouse / Supplier</th>
                        <th style={{ textAlign: 'right', width: '60px' }}>Qty</th>
                        <th style={{ textAlign: 'right', width: '100px' }}>Unit Cost</th>
                        <th style={{ textAlign: 'right', width: '110px' }}>Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrderForDrawer.partsConsumed.map((part) => {
                        const isOutside = part.partSource === 'EXTERNAL';
                        return (
                          <tr key={part.id} className="sales-row">
                            <td>
                              <span className={`sales-fulfillment-tag ${isOutside ? 'pending' : 'shipped'}`} style={{ fontSize: '10px' }}>
                                {isOutside ? 'Outside Procured' : 'In-House Stock'}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 500, fontSize: '12px' }}>
                                {isOutside ? part.externalPartName : part.itemName}
                              </div>
                              <div className="sales-sub-ref">
                                {isOutside ? (part.externalPartNumber || 'Part') : part.sku}
                              </div>
                            </td>
                            <td style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                              {isOutside ? (
                                <div>
                                  <div>{part.supplierName || 'Outside Supplier'}</div>
                                  {part.invoiceReference && (
                                    <div className="sales-sub-ref">Bill: {part.invoiceReference}</div>
                                  )}
                                </div>
                              ) : (
                                <div>{part.warehouseName || 'Main Store'}</div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                              {part.quantity}
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px', color: 'var(--sp-text-secondary)' }}>
                              {formatCurrency(part.unitCost || 0)}
                            </td>
                            <td className="sales-amount-cell" style={{ fontWeight: 600 }}>
                              {formatCurrency(part.totalCost)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                    No replacement parts consumed (Labor-only service).
                  </div>
                )}
              </div>
            </div>

            {/* Right Properties Sidebar */}
            <div className="linear-properties-sidebar">
              <div className="linear-properties-card">
                <div className="linear-properties-title">Order Properties</div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Status</span>
                  <span className="linear-property-value">
                    <Status label={selectedOrderForDrawer.status} />
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Order Type</span>
                  <span className="linear-property-value">
                    <span className="sales-warehouse-pill" style={{ textTransform: 'capitalize' }}>
                      {selectedOrderForDrawer.type.toLowerCase()}
                    </span>
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Priority</span>
                  <span className="linear-property-value">
                    <span className={`priority-tag priority-${selectedOrderForDrawer.priority.toLowerCase()}`}>
                      {selectedOrderForDrawer.priority}
                    </span>
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Equipment</span>
                  <span className="linear-property-value" style={{ fontWeight: 500 }}>
                    {selectedOrderForDrawer.assetName}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Asset Code</span>
                  <span className="linear-property-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {selectedOrderForDrawer.assetCode}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Work Station</span>
                  <span className="linear-property-value">
                    {selectedOrderForDrawer.workCenterName || 'Shop Floor'}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Technician Type</span>
                  <span className="linear-property-value">
                    <span className={`sales-fulfillment-tag ${selectedOrderForDrawer.technicianType === 'EXTERNAL' ? 'pending' : 'shipped'}`} style={{ fontSize: '10.5px' }}>
                      {selectedOrderForDrawer.technicianType === 'EXTERNAL' ? 'Outside Contractor' : 'In-House Engineer'}
                    </span>
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">
                    {selectedOrderForDrawer.technicianType === 'EXTERNAL' ? 'Contractor' : 'Technician'}
                  </span>
                  <span className="linear-property-value" style={{ fontWeight: 500 }}>
                    {selectedOrderForDrawer.technicianType === 'EXTERNAL'
                      ? selectedOrderForDrawer.externalContractorName || 'Outside Agency'
                      : selectedOrderForDrawer.assignedTechnicianName || 'Unassigned'}
                  </span>
                </div>

                {selectedOrderForDrawer.technicianType === 'EXTERNAL' && selectedOrderForDrawer.externalInvoiceRef && (
                  <div className="linear-property-row">
                    <span className="linear-property-label">Contractor Inv #</span>
                    <span className="linear-property-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {selectedOrderForDrawer.externalInvoiceRef}
                    </span>
                  </div>
                )}

                <div className="linear-property-row">
                  <span className="linear-property-label">Scheduled Date</span>
                  <span className="linear-property-value">
                    {formatDate(selectedOrderForDrawer.scheduledDate)}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Downtime</span>
                  <span className="linear-property-value" style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                    {selectedOrderForDrawer.downtimeMinutes > 0 ? `${selectedOrderForDrawer.downtimeMinutes} min` : '0 min'}
                  </span>
                </div>

                <div className="linear-property-row" style={{ borderTop: '1px solid var(--sp-border)', paddingTop: '8px', marginTop: '4px' }}>
                  <span className="linear-property-label">Labor Fee</span>
                  <span className="linear-property-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(selectedOrderForDrawer.laborCost || 0)}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Parts Total</span>
                  <span className="linear-property-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(selectedOrderForDrawer.partsCost || 0)}
                  </span>
                </div>

                <div className="linear-property-row" style={{ background: 'var(--sp-surface-subtle)', padding: '6px 8px', borderRadius: '4px', marginTop: '4px' }}>
                  <span className="linear-property-label" style={{ fontWeight: 600, color: 'var(--sp-text)' }}>Total Order Cost</span>
                  <span className="linear-property-value" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--sp-brand)', fontSize: '13px' }}>
                    {formatCurrency(selectedOrderForDrawer.totalCost || 0)}
                  </span>
                </div>
              </div>

              {/* Actions in Sidebar if not completed */}
              {selectedOrderForDrawer.status !== 'COMPLETED' && selectedOrderForDrawer.status !== 'CANCELLED' && (
                <div className="linear-properties-card">
                  <div className="linear-properties-title">Actions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedOrderForDrawer.status === 'OPEN' && (
                      <button
                        type="button"
                        className="sales-action-btn primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => handleStartWorkOrder(selectedOrderForDrawer)}
                        disabled={busy}
                      >
                        <Play size={12} />
                        <span>Start Repair Work</span>
                      </button>
                    )}

                    {selectedOrderForDrawer.status === 'IN_PROGRESS' && (
                      <button
                        type="button"
                        className="sales-action-btn primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => openCompleteModal(selectedOrderForDrawer)}
                        disabled={busy}
                      >
                        <Check size={12} />
                        <span>Complete Maintenance</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="sales-action-btn secondary"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => handleCancelWorkOrder(selectedOrderForDrawer)}
                      disabled={busy}
                    >
                      <X size={12} />
                      <span>Cancel Order</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Executive Telemetry Strip — 4 Monochrome Linear Metric Cards */}
          <div className="linear-kpi-grid">
            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Equipment Health</span>
                <Gauge size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics ? `${metrics.operationalAssets} / ${metrics.totalAssets}` : `${assets.length} Assets`}
              </div>
              <div className="linear-kpi-caption">
                {metrics ? `${metrics.availabilityPercent}% plant availability` : 'All assets operational on floor'}
              </div>
            </div>

            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Active Maintenance Orders</span>
                <Wrench size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics ? `${metrics.openWorkOrders} Active` : `${workOrders.filter(w => w.status !== 'COMPLETED').length} Active`}
              </div>
              <div className="linear-kpi-caption">
                {metrics?.criticalBreakdowns ? `${metrics.criticalBreakdowns} high-priority breakdowns` : 'No emergency breakdowns'}
              </div>
            </div>

            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Reliability (MTBF)</span>
                <Activity size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics ? `${metrics.mtbfHours.toFixed(1)} hrs` : '720.0 hrs'}
              </div>
              <div className="linear-kpi-caption">
                Mean time between equipment failures
              </div>
            </div>

            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Repair Speed (MTTR)</span>
                <Clock size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics ? `${metrics.mttrMinutes.toFixed(1)} min` : '95.0 min'}
              </div>
              <div className="linear-kpi-caption">
                Mean time to repair & restore machine
              </div>
            </div>
          </div>

          {/* 2. Linear Sub-Navigation Tabs & Quick Action Controls */}
          <div className="sales-subnav-container">
            <div className="sales-subnav-tabs">
              <button
                type="button"
                className={`sales-subnav-tab ${activeTab === 'work-orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('work-orders')}
              >
                <Wrench size={13} />
                <span>Maintenance Orders</span>
                {workOrders.filter((w) => w.status !== 'COMPLETED').length > 0 && (
                  <span className="sales-subnav-badge">{workOrders.filter((w) => w.status !== 'COMPLETED').length}</span>
                )}
              </button>

              <button
                type="button"
                className={`sales-subnav-tab ${activeTab === 'schedules' ? 'active' : ''}`}
                onClick={() => setActiveTab('schedules')}
              >
                <Calendar size={13} />
                <span>Preventive Schedules</span>
                <span className="sales-subnav-badge">{schedules.length}</span>
              </button>

              <button
                type="button"
                className={`sales-subnav-tab ${activeTab === 'assets' ? 'active' : ''}`}
                onClick={() => setActiveTab('assets')}
              >
                <Cpu size={13} />
                <span>Equipment & Machinery</span>
                <span className="sales-subnav-badge">{assets.length}</span>
              </button>

              <button
                type="button"
                className={`sales-subnav-tab ${activeTab === 'telemetry' ? 'active' : ''}`}
                onClick={() => setActiveTab('telemetry')}
              >
                <Boxes size={13} />
                <span>Spares & Telemetry</span>
                {metrics?.totalPartsConsumedCount ? (
                  <span className="sales-subnav-badge">{metrics.totalPartsConsumedCount}</span>
                ) : null}
              </button>
            </div>

            <div className="sales-subnav-actions">
              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => void refresh()}
                disabled={loading || busy}
                title="Refresh maintenance data"
              >
                <RefreshCw size={12} className={loading || busy ? 'spin' : ''} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => {
                  setNewOrderType('PREVENTIVE');
                  setPreselectedAssetId(assets[0]?.id || '');
                  setIsNewOrderModalOpen(true);
                }}
              >
                <Calendar size={13} />
                <span>Plan Maintenance</span>
              </button>

              <button
                type="button"
                className="sales-action-btn primary"
                onClick={() => {
                  setNewOrderType('BREAKDOWN');
                  setPreselectedAssetId(assets[0]?.id || '');
                  setIsNewOrderModalOpen(true);
                }}
              >
                <AlertTriangle size={13} />
                <span>Report Breakdown</span>
              </button>
            </div>
          </div>

          {/* 3. TAB 1: MAINTENANCE ORDERS */}
          {activeTab === 'work-orders' && (
            <div>
              {/* Linear Triage Filter Toolbar */}
              <div className="sales-toolbar" style={{ marginBottom: '12px' }}>
                <div className="sales-pill-group">
                  <button
                    type="button"
                    className={`sales-pill-btn ${quickFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('ALL')}
                  >
                    <span>All Orders</span>
                    <span className="sales-pill-count">{workOrders.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${quickFilter === 'OPEN' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('OPEN')}
                  >
                    <span>Open</span>
                    <span className="sales-pill-count">{openOrdersCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${quickFilter === 'IN_PROGRESS' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('IN_PROGRESS')}
                  >
                    <span>In Progress</span>
                    <span className="sales-pill-count">{inProgressCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${quickFilter === 'BREAKDOWN' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('BREAKDOWN')}
                  >
                    <span>Breakdowns</span>
                    <span className="sales-pill-count">{breakdownCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${quickFilter === 'PREVENTIVE' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('PREVENTIVE')}
                  >
                    <span>Preventive</span>
                    <span className="sales-pill-count">{preventiveCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${quickFilter === 'COMPLETED' ? 'active' : ''}`}
                    onClick={() => setQuickFilter('COMPLETED')}
                  >
                    <span>Resolved</span>
                    <span className="sales-pill-count">{completedCount}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="pos-view-toggle">
                    <button
                      type="button"
                      className={`pos-view-btn ${ordersViewMode === 'list' ? 'active' : ''}`}
                      onClick={() => setOrdersViewMode('list')}
                      title="List View"
                    >
                      <LayoutList size={13} />
                    </button>
                    <button
                      type="button"
                      className={`pos-view-btn ${ordersViewMode === 'board' ? 'active' : ''}`}
                      onClick={() => setOrdersViewMode('board')}
                      title="Kanban Board View"
                    >
                      <LayoutGrid size={13} />
                    </button>
                  </div>

                  <div className="sales-search-box">
                    <Search size={13} className="sales-search-icon" />
                    <input
                      className="sales-search-input"
                      placeholder="Filter order #, machine, symptom…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery ? (
                      <button type="button" className="sales-search-clear" onClick={() => setSearchQuery('')}>
                        <X size={12} />
                      </button>
                    ) : (
                      <kbd className="sales-search-kbd">/</kbd>
                    )}
                  </div>
                </div>
              </div>

              {/* LIST VIEW: CLEAN TRIAGE TABLE */}
              {ordersViewMode === 'list' ? (
                <div className="sales-table-card">
                  <table className="sales-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '180px' }}>Order Ref</th>
                        <th style={{ width: '95px' }}>Priority</th>
                        <th style={{ width: '210px' }}>Equipment</th>
                        <th style={{ width: '100px' }}>Type</th>
                        <th>Symptom / Description</th>
                        <th style={{ width: '125px' }}>Technician</th>
                        <th style={{ width: '110px' }}>Scheduled Date</th>
                        <th style={{ width: '105px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWorkOrders.map((wo) => {
                        const isBreakdown = wo.type === 'BREAKDOWN';
                        const isEmergency = wo.priority === 'EMERGENCY' || wo.priority === 'HIGH';

                        return (
                          <tr
                            key={wo.id}
                            className="sales-row production-clickable-row"
                            onClick={() => selectOrder(wo)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <button
                                type="button"
                                className="order-number-pill interactive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectOrder(wo);
                                }}
                                title="View maintenance order details"
                              >
                                <span>{wo.orderNumber}</span>
                                <ArrowUpRight size={11} className="order-link-arrow" />
                              </button>
                            </td>
                            <td>
                              <span
                                className={`sales-fulfillment-tag ${isEmergency ? 'pending' : 'shipped'}`}
                                style={{
                                  textTransform: 'capitalize',
                                  fontSize: '11px',
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {wo.priority.toLowerCase()}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                <code className="sales-ref-badge" style={{ fontSize: '10.5px', flexShrink: 0 }}>
                                  {wo.assetCode}
                                </code>
                                <StyledTooltip content={wo.assetName} align="left">
                                  <span
                                    style={{
                                      fontWeight: 500,
                                      color: 'var(--sp-text)',
                                      fontSize: '12px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      display: 'inline-block'
                                    }}
                                  >
                                    {wo.assetName}
                                  </span>
                                </StyledTooltip>
                              </div>
                            </td>
                            <td>
                              <span
                                className="sales-warehouse-pill"
                                style={{
                                  textTransform: 'capitalize',
                                  background: isBreakdown ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                                  color: isBreakdown ? '#dc2626' : '#2563eb',
                                  borderColor: isBreakdown ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                }}
                              >
                                {isBreakdown ? 'Breakdown' : 'Preventive'}
                              </span>
                            </td>
                            <td>
                              <StyledTooltip content={wo.failureSymptom || 'Routine service'} align="left">
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: '12px',
                                    color: 'var(--sp-text-secondary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '100%',
                                    cursor: 'default'
                                  }}
                                >
                                  {wo.failureSymptom || 'Routine service'}
                                </span>
                              </StyledTooltip>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--sp-text)' }}>
                                {wo.technicianType === 'EXTERNAL' ? (
                                  <>
                                    <Briefcase size={12} style={{ color: '#d97706', flexShrink: 0 }} />
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {wo.externalContractorName || 'Outside Contractor'}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <User size={12} style={{ color: 'var(--sp-text-muted)', flexShrink: 0 }} />
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {wo.assignedTechnicianName || 'Unassigned'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="sales-date-cell" style={{ fontSize: '11.5px' }}>
                                {formatDate(wo.scheduledDate)}
                              </span>
                            </td>
                            <td>
                              <Status label={wo.status} />
                            </td>
                          </tr>
                        );
                      })}

                      {!filteredWorkOrders.length && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--sp-text-muted)' }}>
                            No maintenance orders match your search and filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* BOARD VIEW: KANBAN WORKFLOW */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'start' }}>
                  {(['OPEN', 'IN_PROGRESS', 'COMPLETED'] as const).map((stage) => {
                    const stageOrders = filteredWorkOrders.filter((w) => w.status === stage);

                    return (
                      <div key={stage} className="sales-table-card" style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', letterSpacing: '0.02em' }}>
                            {stage === 'OPEN' ? 'OPEN ORDERS' : stage === 'IN_PROGRESS' ? 'IN PROGRESS' : 'RESOLVED & VERIFIED'}
                          </span>
                          <span className="sales-subnav-badge">{stageOrders.length}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {stageOrders.map((wo) => {
                            return (
                              <div
                                key={wo.id}
                                className="production-clickable-row"
                                onClick={() => selectOrder(wo)}
                                style={{
                                  background: 'var(--sp-surface-subtle)',
                                  border: '1px solid var(--sp-border)',
                                  borderRadius: '6px',
                                  padding: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <button
                                    type="button"
                                    className="order-number-pill interactive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectOrder(wo);
                                    }}
                                    title="View maintenance order details"
                                  >
                                    <span>{wo.orderNumber}</span>
                                    <ArrowUpRight size={11} className="order-link-arrow" />
                                  </button>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span
                                      className={`sales-fulfillment-tag ${wo.priority === 'EMERGENCY' || wo.priority === 'HIGH' ? 'pending' : 'shipped'}`}
                                      style={{ textTransform: 'capitalize', fontSize: '10px' }}
                                    >
                                      {wo.priority.toLowerCase()}
                                    </span>
                                    <Status label={wo.status} />
                                  </div>
                                </div>

                                <div style={{ fontWeight: 500, fontSize: '12.5px', color: 'var(--sp-text)' }}>
                                  {wo.assetName}
                                </div>
                                <div className="sales-sub-ref" style={{ marginTop: '2px', marginBottom: '8px' }}>
                                  {wo.assetCode} · {wo.failureSymptom || 'Preventive service'}
                                </div>

                                {wo.partsConsumed && wo.partsConsumed.length > 0 && (
                                  <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', padding: '3px 6px', borderRadius: '4px', marginBottom: '8px' }}>
                                    📦 {wo.partsConsumed.length} spare parts consumed
                                  </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--sp-border)' }}>
                                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                                    {wo.technicianType === 'EXTERNAL'
                                      ? `Contractor: ${wo.externalContractorName || 'Outside'}`
                                      : wo.assignedTechnicianName
                                      ? `Tech: ${wo.assignedTechnicianName}`
                                      : 'Unassigned'}
                                  </div>

                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    {wo.status === 'OPEN' && (
                                      <button
                                        type="button"
                                        className="sales-action-btn primary"
                                        style={{ height: '22px', fontSize: '11px', padding: '0 8px' }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void handleStartWorkOrder(wo);
                                        }}
                                      >
                                        <Play size={10} />
                                        <span>Start</span>
                                      </button>
                                    )}
                                    {wo.status === 'IN_PROGRESS' && (
                                      <button
                                        type="button"
                                        className="sales-action-btn primary"
                                        style={{ height: '22px', fontSize: '11px', padding: '0 8px' }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openCompleteModal(wo);
                                        }}
                                      >
                                        <Check size={10} />
                                        <span>Complete</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {!stageOrders.length && (
                            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                              No orders in this stage
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 4. TAB 2: PREVENTIVE SCHEDULES */}
      {activeTab === 'schedules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                Recurring Preventive Maintenance Schedules
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                Time-based and meter-based servicing intervals to prevent unplanned machine downtime
              </p>
            </div>
            <button
              type="button"
              className="sales-action-btn primary"
              onClick={() => setIsNewScheduleModalOpen(true)}
            >
              <Plus size={13} />
              <span>Create Schedule</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '14px' }}>
            {schedules.map((s) => {
              let checklistItems: MaintenanceChecklistItem[] = [];
              try {
                checklistItems = JSON.parse(s.checklist || '[]');
              } catch {
                checklistItems = [];
              }

              return (
                <div key={s.id} className="sales-table-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="sales-ref-badge">{s.assetCode}</span>
                    <span className="sales-warehouse-pill">
                      {s.frequencyType === 'CALENDAR_DAYS' ? `Every ${s.frequencyInterval} Days` : `Every ${s.frequencyInterval} Hours`}
                    </span>
                  </div>

                  <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--sp-text)', lineHeight: 1.3 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                    Machine: <b style={{ color: 'var(--sp-text)' }}>{s.assetName}</b>
                  </div>

                  <div style={{ background: 'var(--sp-surface-subtle)', borderRadius: '6px', border: '1px solid var(--sp-border)', padding: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
                      Standard Inspection Checklist ({checklistItems.length} steps):
                    </span>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '16px', fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                      {checklistItems.map((step, idx) => (
                        <li key={idx} style={{ marginBottom: '3px' }}>
                          {step.step}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--sp-border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                      Next Due: <b>{formatDate(s.nextDueDate)}</b>
                    </div>

                    <button
                      type="button"
                      className="sales-action-btn primary"
                      style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
                      disabled={busy}
                      onClick={() => void handleTriggerSchedule(s)}
                      title="Dispatch an active maintenance order right now"
                    >
                      <Sparkles size={11} />
                      <span>Dispatch Now</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB 3: EQUIPMENT & MACHINERY MASTER */}
      {activeTab === 'assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                Machinery, Equipment & Tooling Assets
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                Physical production machinery, serial numbers, operating runtime hours, and warranty logs
              </p>
            </div>
            <button
              type="button"
              className="sales-action-btn primary"
              onClick={() => setIsNewAssetModalOpen(true)}
            >
              <Plus size={13} />
              <span>Register Equipment</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '14px' }}>
            {assets.map((asset) => {
              const isOperational = asset.status === 'OPERATIONAL';

              return (
                <div key={asset.id} className="sales-table-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="sales-ref-badge">{asset.code}</span>
                    <Status label={isOperational ? 'OPERATIONAL' : 'UNDER_MAINTENANCE'} />
                  </div>

                  <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--sp-text)' }}>
                    {asset.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-brand)', fontWeight: 500 }}>
                    Station: {asset.workCenterName || 'Unassigned'}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', background: 'var(--sp-surface-subtle)', borderRadius: '6px', border: '1px solid var(--sp-border)', fontSize: '11.5px', marginTop: '4px' }}>
                    <div>
                      <span style={{ color: 'var(--sp-text-muted)', display: 'block', fontSize: '10px', fontWeight: 600 }}>MANUFACTURER</span>
                      <span style={{ fontWeight: 500 }}>{asset.manufacturer || '—'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--sp-text-muted)', display: 'block', fontSize: '10px', fontWeight: 500 }}>MODEL / SPEC</span>
                      <span style={{ fontWeight: 500 }}>{asset.model || '—'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--sp-text-muted)', display: 'block', fontSize: '10px', fontWeight: 500 }}>SERIAL NUMBER</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{asset.serialNumber || '—'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--sp-text-muted)', display: 'block', fontSize: '10px', fontWeight: 500 }}>OPERATING METER</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {Number(asset.meterHours || 0).toLocaleString()} hrs
                      </span>
                    </div>
                  </div>

                  {asset.notes && (
                    <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                      "{asset.notes}"
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--sp-border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                      Warranty to: <b>{formatDate(asset.warrantyExpiry)}</b>
                    </div>

                    <button
                      type="button"
                      className="sales-action-btn secondary"
                      style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
                      onClick={() => {
                        setNewOrderType('BREAKDOWN');
                        setPreselectedAssetId(asset.id);
                        setIsNewOrderModalOpen(true);
                      }}
                    >
                      <AlertTriangle size={11} style={{ color: 'var(--sp-danger)' }} />
                      <span>Log Incident</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. TAB 4: SPARES CONSUMPTION & RELIABILITY TELEMETRY */}
      {activeTab === 'telemetry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="sales-table-card">
            <div className="sales-card-header" style={{ padding: '14px 16px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 className="sales-card-title">Replacement Spare Parts Consumed in Repairs</h3>
                <p className="sales-card-subtitle">
                  Inventory components automatically deducted from warehouse stock during maintenance resolution
                </p>
              </div>
            </div>

            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}>Maintenance Order</th>
                    <th style={{ width: '130px' }}>Part SKU</th>
                    <th>Item Description</th>
                    <th style={{ width: '150px' }}>Source Warehouse</th>
                    <th style={{ width: '90px', textAlign: 'right' }}>Qty Used</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Unit Cost</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Total Cost</th>
                    <th style={{ width: '150px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders
                    .flatMap((wo) => (wo.partsConsumed || []).map((p) => ({ ...p, workOrderNumber: wo.orderNumber })))
                    .map((part) => (
                      <tr key={part.id} className="sales-row">
                        <td>
                          <span className="sales-ref-badge">{part.workOrderNumber}</span>
                        </td>
                        <td>
                          <span className="sales-ref-badge">{part.sku}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--sp-text)' }}>{part.itemName}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                            {part.warehouseName || 'Main Warehouse'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                          {part.quantity}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(part.unitCost)}
                        </td>
                        <td className="sales-amount-cell">
                          {formatCurrency(part.totalCost)}
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                            {new Date(part.createdAt).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}

                  {workOrders.flatMap((w) => w.partsConsumed || []).length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--sp-text-muted)' }}>
                        No spare parts recorded yet. Complete a repair order to deduct replacement bearings, fasteners, or seals.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: REPORT BREAKDOWN / NEW WORK ORDER */}
      {isNewOrderModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsNewOrderModalOpen(false)}>
          <div className="sales-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="sales-card-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 className="sales-card-title">
                  {newOrderType === 'BREAKDOWN' ? 'Report Machine Breakdown Ticket' : 'Plan Preventive Maintenance'}
                </h3>
                <p className="sales-card-subtitle">
                  {newOrderType === 'BREAKDOWN'
                    ? 'Dispatches an urgent maintenance order and flags machinery as under maintenance'
                    : 'Schedules planned inspection and servicing'}
                </p>
              </div>
              <button type="button" className="sales-search-clear" onClick={() => setIsNewOrderModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              <input type="hidden" name="type" value={newOrderType} />

              <div className="maint-form-field">
                <label className="maint-form-label">
                  Equipment / Machine Asset <span className="req">*</span>
                </label>
                <select
                  name="assetId"
                  className="maint-form-select"
                  defaultValue={preselectedAssetId || assets[0]?.id}
                  required
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name} ({a.status})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="maint-form-field">
                  <label className="maint-form-label">
                    Priority Level <span className="req">*</span>
                  </label>
                  <select
                    name="priority"
                    className="maint-form-select"
                    defaultValue={newOrderType === 'BREAKDOWN' ? 'HIGH' : 'MEDIUM'}
                  >
                    <option value="EMERGENCY">Emergency (Line Stopped)</option>
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low / Routine</option>
                  </select>
                </div>

                <div className="maint-form-field">
                  <label className="maint-form-label">
                    Technician Type <span className="req">*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '6px', height: '38px' }}>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '6px',
                        border: newOrderTechType === 'INTERNAL' ? '1px solid var(--sp-brand)' : '1px solid var(--sp-border)',
                        background: newOrderTechType === 'INTERNAL' ? 'var(--sp-brand-soft)' : 'var(--sp-surface)',
                        color: newOrderTechType === 'INTERNAL' ? 'var(--sp-brand)' : 'var(--sp-text)',
                        fontWeight: newOrderTechType === 'INTERNAL' ? 600 : 500,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setNewOrderTechType('INTERNAL')}
                    >
                      <User size={13} />
                      <span>In-House</span>
                    </button>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '6px',
                        border: newOrderTechType === 'EXTERNAL' ? '1px solid var(--sp-brand)' : '1px solid var(--sp-border)',
                        background: newOrderTechType === 'EXTERNAL' ? 'var(--sp-brand-soft)' : 'var(--sp-surface)',
                        color: newOrderTechType === 'EXTERNAL' ? 'var(--sp-brand)' : 'var(--sp-text)',
                        fontWeight: newOrderTechType === 'EXTERNAL' ? 600 : 500,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setNewOrderTechType('EXTERNAL')}
                    >
                      <Briefcase size={13} />
                      <span>Contractor</span>
                    </button>
                  </div>
                </div>
              </div>

              {newOrderTechType === 'INTERNAL' ? (
                <div className="maint-form-field">
                  <label className="maint-form-label">
                    Assigned In-House Technician
                  </label>
                  <select
                    name="technicianId"
                    className="maint-form-select"
                  >
                    <option value="">Auto-Dispatch to Shift Engineer</option>
                    {teamUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="maint-form-field">
                  <label className="maint-form-label">
                    External Contractor / OEM Service Agency
                  </label>
                  <input
                    type="text"
                    className="maint-form-input"
                    placeholder="e.g. Apex Machine Services"
                    value={newOrderContractor}
                    onChange={(e) => setNewOrderContractor(e.target.value)}
                  />
                </div>
              )}

              <div className="maint-form-field">
                <label className="maint-form-label">
                  Failure Symptoms / Service Instructions <span className="req">*</span>
                </label>
                <textarea
                  name="symptom"
                  className="maint-form-textarea"
                  rows={3}
                  placeholder="Describe abnormal sounds, vibration, alarms, or servicing steps required…"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="sales-action-btn secondary" onClick={() => setIsNewOrderModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="sales-action-btn primary" disabled={busy}>
                  {busy ? 'Dispatching…' : 'Dispatch Maintenance Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: COMPLETE WORK ORDER & SPARE PARTS / CONTRACTOR COSTING */}
      {isCompleteModalOpen && completingOrder && (
        <div className="modal-backdrop" onClick={() => setIsCompleteModalOpen(false)}>
          <div
            className="sales-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '720px',
              width: '95vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0,
              borderRadius: '12px',
              border: '1px solid var(--sp-border)',
              boxShadow: '0 20px 48px -10px rgba(0,0,0,0.18)'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sp-border)', background: 'var(--sp-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wrench size={16} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                      Complete Maintenance Order & Finalize Costs
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                      {completingOrder.orderNumber} · {completingOrder.assetName} (<code className="sales-ref-badge">{completingOrder.assetCode}</code>)
                    </p>
                  </div>
                </div>
                <button type="button" className="sales-search-clear" onClick={() => setIsCompleteModalOpen(false)}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Modal Body: Single Page, Clean Visual Sections */}
            <form
              onSubmit={handleCompleteSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflowY: 'auto',
                padding: '18px 20px',
                gap: '14px',
                background: 'var(--sp-surface-subtle)'
              }}
            >
              {/* Inline Error Notification Banner */}
              {completeModalError && (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--sp-danger-soft)',
                  border: '1px solid var(--sp-danger)',
                  borderRadius: '6px',
                  color: 'var(--sp-danger)',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{completeModalError}</span>
                </div>
              )}

              {/* SECTION 1: SERVICE SPECIALIST */}
              <div className="maint-modal-card" style={{ margin: 0 }}>
                <div className="maint-modal-card-title">
                  <span>1. Service Specialist & Labor Cost</span>
                </div>

                {/* 2 Clear Selection Toggle Buttons adhering to Linear tokens */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setCompleteTechType('INTERNAL')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: completeTechType === 'INTERNAL' ? '1px solid var(--sp-brand)' : '1px solid var(--sp-border)',
                      background: completeTechType === 'INTERNAL' ? 'var(--sp-brand-soft)' : 'var(--sp-surface)',
                      color: completeTechType === 'INTERNAL' ? 'var(--sp-brand)' : 'var(--sp-text)',
                      fontWeight: completeTechType === 'INTERNAL' ? 600 : 500,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <User size={15} />
                    <span>In-House Team</span>
                    {completeTechType === 'INTERNAL' && <Check size={14} style={{ marginLeft: '4px' }} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompleteTechType('EXTERNAL')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: completeTechType === 'EXTERNAL' ? '1px solid var(--sp-brand)' : '1px solid var(--sp-border)',
                      background: completeTechType === 'EXTERNAL' ? 'var(--sp-brand-soft)' : 'var(--sp-surface)',
                      color: completeTechType === 'EXTERNAL' ? 'var(--sp-brand)' : 'var(--sp-text)',
                      fontWeight: completeTechType === 'EXTERNAL' ? 600 : 500,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Briefcase size={15} />
                    <span>Outside Contractor / OEM</span>
                    {completeTechType === 'EXTERNAL' && <Check size={14} style={{ marginLeft: '4px' }} />}
                  </button>
                </div>

                {/* Fields for chosen technician type */}
                {completeTechType === 'INTERNAL' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px' }}>
                    <div className="maint-form-field">
                      <label className="maint-form-label">
                        Designated In-House Technician <span className="req">*</span>
                      </label>
                      <select
                        className="maint-form-select"
                        value={completeAssignedTechId}
                        onChange={(e) => setCompleteAssignedTechId(e.target.value)}
                      >
                        {teamUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="maint-form-field">
                      <label className="maint-form-label">
                        Internal Labor Cost Allocation (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="maint-form-input"
                        placeholder="0.00"
                        value={completeLaborCost}
                        onChange={(e) => setCompleteLaborCost(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '12px' }}>
                    <div className="maint-form-field">
                      <label className="maint-form-label">
                        Contractor / Agency Name <span className="req">*</span>
                      </label>
                      <input
                        className="maint-form-input"
                        placeholder="e.g. Apex Machine Services"
                        value={completeContractorName}
                        onChange={(e) => setCompleteContractorName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="maint-form-field">
                      <label className="maint-form-label">
                        Invoice / Bill Ref #
                      </label>
                      <input
                        className="maint-form-input"
                        placeholder="e.g. INV-9921"
                        value={completeExternalInvoice}
                        onChange={(e) => setCompleteExternalInvoice(e.target.value)}
                      />
                    </div>

                    <div className="maint-form-field">
                      <label className="maint-form-label">
                        Service / Labor Fee (₹) <span className="req">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="maint-form-input"
                        placeholder="e.g. 4500"
                        value={completeLaborCost}
                        onChange={(e) => setCompleteLaborCost(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: ROOT CAUSE & DOWNTIME */}
              <div className="maint-modal-card" style={{ margin: 0 }}>
                <div className="maint-modal-card-title">
                  <span>2. Repair Details & Production Downtime</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="maint-form-field">
                    <label className="maint-form-label">
                      Root Cause of Failure <span className="req">*</span>
                    </label>
                    <input
                      className="maint-form-input"
                      placeholder="e.g. Motor bearing wear, sensor fault, belt slip..."
                      value={completeRootCause}
                      onChange={(e) => setCompleteRootCause(e.target.value)}
                      required
                    />
                  </div>

                  <div className="maint-form-field">
                    <label className="maint-form-label">
                      Downtime (Minutes) <span className="req">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="maint-form-input"
                      placeholder="60"
                      value={completeDowntime}
                      onChange={(e) => setCompleteDowntime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="maint-form-field">
                  <label className="maint-form-label">
                    Resolution Notes & Actions Performed <span className="req">*</span>
                  </label>
                  <textarea
                    className="maint-form-textarea"
                    rows={3}
                    placeholder="Describe how the defect was repaired and test runs performed..."
                    value={completeResolution}
                    onChange={(e) => setCompleteResolution(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* SECTION 3: REPLACEMENT SPARE PARTS */}
              <div className="maint-modal-card" style={{ margin: 0 }}>
                <div className="maint-modal-card-title">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>3. Replacement Spare Parts</span>
                    <span style={{ fontSize: '11px', background: 'var(--sp-surface-subtle)', color: 'var(--sp-text-secondary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      {completePartsList.length} items
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="sales-action-btn secondary"
                      style={{ height: '28px', fontSize: '11.5px', padding: '0 10px', gap: '4px' }}
                      onClick={() => handleAddPartLine('INTERNAL')}
                    >
                      <Plus size={13} />
                      <span>Stock Part</span>
                    </button>
                    <button
                      type="button"
                      className="sales-action-btn secondary"
                      style={{ height: '28px', fontSize: '11.5px', padding: '0 10px', gap: '4px' }}
                      onClick={() => handleAddPartLine('EXTERNAL')}
                    >
                      <Plus size={13} />
                      <span>Outside Part</span>
                    </button>
                  </div>
                </div>

                {completePartsList.length === 0 ? (
                  <div style={{ padding: '16px', background: 'var(--sp-surface)', border: '1px dashed var(--sp-border)', borderRadius: '6px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12.5px' }}>
                    No replacement parts added (Labor only). Click <strong>Stock Part</strong> or <strong>Outside Part</strong> if components were replaced.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {completePartsList.map((line, index) => {
                      const isInternal = line.partSource === 'INTERNAL';
                      const lineQty = Number(line.quantity) || 0;
                      let unitP = Number(line.unitCost) || 0;
                      if (isInternal && !line.unitCost) {
                        const itemObj = items.find((i) => i.id === line.itemId);
                        unitP = itemObj?.unitPrice ? Number(itemObj.unitPrice) : 0;
                      }
                      const lineTotal = lineQty * unitP;

                      return (
                        <div
                          key={line.tempId}
                          style={{
                            background: 'var(--sp-surface)',
                            border: '1px solid var(--sp-border)',
                            borderRadius: '6px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                                Part #{index + 1}
                              </span>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: isInternal ? 'var(--sp-brand-soft)' : 'var(--sp-surface-subtle)',
                                  color: isInternal ? 'var(--sp-brand)' : 'var(--sp-text-secondary)',
                                  border: '1px solid var(--sp-border)'
                                }}
                              >
                                {isInternal ? 'Stock Part' : 'Outside Part'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '12.5px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)' }}>
                                Subtotal: {formatCurrency(lineTotal)}
                              </span>
                              <button
                                type="button"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: 'var(--sp-text-muted)' }}
                                onClick={() => handleRemovePartLine(line.tempId)}
                                title="Delete part"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {isInternal ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 0.8fr 1fr', gap: '8px' }}>
                              <div className="maint-form-field">
                                <label className="maint-form-label">
                                  Catalog Item <span className="req">*</span>
                                </label>
                                <select
                                  className="maint-form-select"
                                  value={line.itemId}
                                  onChange={(e) => handleUpdatePartLine(line.tempId, { itemId: e.target.value })}
                                >
                                  <option value="">Select item...</option>
                                  {items.map((i) => (
                                    <option key={i.id} value={i.id}>
                                      {i.sku} — {i.name} ({i.available ?? i.stock} available · {formatCurrency(i.unitPrice || 0)})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="maint-form-field">
                                <label className="maint-form-label">
                                  Warehouse <span className="req">*</span>
                                </label>
                                <select
                                  className="maint-form-select"
                                  value={line.warehouseId}
                                  onChange={(e) => handleUpdatePartLine(line.tempId, { warehouseId: e.target.value })}
                                >
                                  {warehouses.map((w) => (
                                    <option key={w.id} value={w.id}>
                                      {w.name} ({w.code})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="maint-form-field">
                                <label className="maint-form-label">
                                  Qty <span className="req">*</span>
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="any"
                                  className="maint-form-input"
                                  value={line.quantity}
                                  onChange={(e) => handleUpdatePartLine(line.tempId, { quantity: e.target.value })}
                                  required
                                />
                              </div>

                              <div className="maint-form-field">
                                <label className="maint-form-label">
                                  Unit Cost (₹)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="maint-form-input"
                                  value={line.unitCost}
                                  onChange={(e) => handleUpdatePartLine(line.tempId, { unitCost: e.target.value })}
                                />
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 1.2fr 1.1fr 0.7fr 1fr', gap: '8px' }}>
                              <div className="maint-form-field">
                                <label className="maint-form-label">
                                  Part Name <span className="req">*</span>
                                </label>
                                <input
                                  className="maint-form-input"
                                  placeholder="e.g. Seal 45x65"
                                  value={line.externalPartName}
                                  onChange={(e) => handleUpdatePartLine(line.tempId, { externalPartName: e.target.value })}
                                  required
                                />
                              </div>

                              <div className="maint-form-field">
                                <label className="maint-form-label">Part #</label>
                                <input
                                  className="maint-form-input"
                                  placeholder="e.g. TC-4565"
                                  value={line.externalPartNumber}
                                  onChange={(e) => handleUpdatePartLine(line.tempId, { externalPartNumber: e.target.value })}
                                />
                              </div>

                              <div className="maint-form-field">
                                <label className="maint-form-label">Vendor / Store</label>
                                <input
                                  className="maint-form-input"
                                  placeholder="e.g. Apex Ind"
                                  value={line.supplierName}
                                  onChange={(e) => handleUpdatePartLine(line.tempId, { supplierName: e.target.value })}
                                />
                              </div>

                              <div className="maint-form-field">
                                <label className="maint-form-label">Bill / Inv #</label>
                                <input
                                  className="maint-form-input"
                                  placeholder="e.g. BL-99"
                                  value={line.invoiceReference}
                                  onChange={(e) => handleUpdatePartLine(line.tempId, { invoiceReference: e.target.value })}
                                />
                              </div>

                              <div className="maint-form-field">
                                <label className="maint-form-label">
                                  Qty <span className="req">*</span>
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="any"
                                  className="maint-form-input"
                                  value={line.quantity}
                                  onChange={(e) => handleUpdatePartLine(line.tempId, { quantity: e.target.value })}
                                  required
                                />
                              </div>

                              <div className="maint-form-field">
                                <label className="maint-form-label">
                                  Cost (₹) <span className="req">*</span>
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="maint-form-input"
                                  value={line.unitCost}
                                  onChange={(e) => handleUpdatePartLine(line.tempId, { unitCost: e.target.value })}
                                  required
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Action Footer conforming to Linear design system */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  background: 'var(--sp-surface)',
                  borderRadius: '8px',
                  border: '1px solid var(--sp-border)',
                  marginTop: 'auto'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                    Labor: <strong style={{ color: 'var(--sp-text)' }}>{formatCurrency(Number(completeLaborCost) || 0)}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                    Parts: <strong style={{ color: 'var(--sp-text)' }}>{formatCurrency(modalCalculatedPartsTotal)}</strong>
                  </div>
                  <div style={{ height: '16px', width: '1px', background: 'var(--sp-border)' }} />
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Total: <span style={{ color: 'var(--sp-brand)', fontWeight: 700 }}>{formatCurrency(modalCalculatedTotalCost)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    className="sales-action-btn secondary"
                    onClick={() => setIsCompleteModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="sales-action-btn primary"
                    style={{ height: '36px', padding: '0 18px', fontWeight: 600, fontSize: '13px' }}
                    disabled={busy}
                  >
                    {busy ? 'Completing…' : `Complete Maintenance (${formatCurrency(modalCalculatedTotalCost)})`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTER NEW MACHINERY ASSET */}
      {isNewAssetModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsNewAssetModalOpen(false)}>
          <div className="sales-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="sales-card-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 className="sales-card-title">Register Physical Machinery Asset</h3>
                <p className="sales-card-subtitle">Add machine tooling, serial number, and runtime meter</p>
              </div>
              <button type="button" className="sales-search-clear" onClick={() => setIsNewAssetModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateAssetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                <div className="maint-form-field">
                  <label className="maint-form-label">Asset Code <span className="req">*</span></label>
                  <input
                    name="code"
                    required
                    placeholder="e.g. EQ-CNC-02"
                    className="maint-form-input"
                  />
                </div>
                <div className="maint-form-field">
                  <label className="maint-form-label">Machine Name <span className="req">*</span></label>
                  <input
                    name="name"
                    required
                    placeholder="e.g. Mazak QuickTurn 250 CNC"
                    className="maint-form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="maint-form-field">
                  <label className="maint-form-label">Manufacturer</label>
                  <input
                    name="manufacturer"
                    placeholder="e.g. Mazak / Haas"
                    className="maint-form-input"
                  />
                </div>
                <div className="maint-form-field">
                  <label className="maint-form-label">Model</label>
                  <input
                    name="model"
                    placeholder="e.g. QT-250 8-Axis"
                    className="maint-form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="maint-form-field">
                  <label className="maint-form-label">Serial Number</label>
                  <input
                    name="serialNumber"
                    placeholder="SN-109482-B"
                    className="maint-form-input"
                  />
                </div>
                <div className="maint-form-field">
                  <label className="maint-form-label">Operating Meter (Hours)</label>
                  <input
                    name="meterHours"
                    type="number"
                    step="0.1"
                    defaultValue="0.0"
                    className="maint-form-input"
                  />
                </div>
              </div>

              <div className="maint-form-field">
                <label className="maint-form-label">Notes & Specifications</label>
                <textarea
                  name="notes"
                  className="maint-form-textarea"
                  rows={2}
                  placeholder="Coolant specs, electrical ratings, spare belt numbers…"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="sales-action-btn secondary" onClick={() => setIsNewAssetModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="sales-action-btn primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Register Machine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE PREVENTIVE SCHEDULE */}
      {isNewScheduleModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsNewScheduleModalOpen(false)}>
          <div className="sales-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="sales-card-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 className="sales-card-title">Create Preventive Maintenance Plan</h3>
                <p className="sales-card-subtitle">Set periodic inspection intervals for machinery</p>
              </div>
              <button type="button" className="sales-search-clear" onClick={() => setIsNewScheduleModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
              <div className="maint-form-field">
                <label className="maint-form-label">Target Machinery Asset <span className="req">*</span></label>
                <select name="assetId" className="maint-form-select" required>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="maint-form-field">
                <label className="maint-form-label">Service Plan Title <span className="req">*</span></label>
                <input
                  name="title"
                  required
                  placeholder="e.g. Quarterly Spindle Alignment Check"
                  className="maint-form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="maint-form-field">
                  <label className="maint-form-label">Frequency Cadence <span className="req">*</span></label>
                  <select name="frequencyType" className="maint-form-select">
                    <option value="CALENDAR_DAYS">Calendar Days</option>
                    <option value="METER_HOURS">Operating Meter Hours</option>
                  </select>
                </div>
                <div className="maint-form-field">
                  <label className="maint-form-label">Interval Count <span className="req">*</span></label>
                  <input
                    name="interval"
                    type="number"
                    min="1"
                    defaultValue="30"
                    className="maint-form-input"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="sales-action-btn secondary" onClick={() => setIsNewScheduleModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="sales-action-btn primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Activate Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
