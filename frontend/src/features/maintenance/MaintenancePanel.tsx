import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Download,
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
  MaintenanceChecklistItem
} from '../../types/maintenance';
import type { ItemSummary, WarehouseSummary } from '../../types/inventory';

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

  // Modals
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [newOrderType, setNewOrderType] = useState<'BREAKDOWN' | 'PREVENTIVE'>('BREAKDOWN');
  const [preselectedAssetId, setPreselectedAssetId] = useState<string>('');
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<MaintenanceWorkOrder | null>(null);

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completingOrder, setCompletingOrder] = useState<MaintenanceWorkOrder | null>(null);
  const [completeRootCause, setCompleteRootCause] = useState('');
  const [completeResolution, setCompleteResolution] = useState('');
  const [completeDowntime, setCompleteDowntime] = useState('60');
  const [consumedPartItemId, setConsumedPartItemId] = useState('');
  const [consumedPartWarehouseId, setConsumedPartWarehouseId] = useState('');
  const [consumedPartQty, setConsumedPartQty] = useState('1');

  const [isNewAssetModalOpen, setIsNewAssetModalOpen] = useState(false);
  const [isNewScheduleModalOpen, setIsNewScheduleModalOpen] = useState(false);

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
          (w.assignedTechnicianName && w.assignedTechnicianName.toLowerCase().includes(q))
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
      notify(`Started work on ${order.orderNumber}`);
      await refresh();
    } catch (err: any) {
      notify(err.message || 'Error starting work order');
    } finally {
      setBusy(false);
    }
  };

  const openCompleteModal = (order: MaintenanceWorkOrder) => {
    setCompletingOrder(order);
    setCompleteRootCause(order.rootCause || '');
    setCompleteResolution(order.resolutionNotes || '');
    setCompleteDowntime(order.downtimeMinutes > 0 ? String(order.downtimeMinutes) : '60');
    setConsumedPartItemId(items[0]?.id || '');
    setConsumedPartWarehouseId(warehouses[0]?.id || '');
    setConsumedPartQty('1');
    setIsCompleteModalOpen(true);
  };

  const handleCompleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!completingOrder) return;
    setBusy(true);
    try {
      const partsPayload = [];
      if (consumedPartItemId && Number(consumedPartQty) > 0) {
        const itemObj = items.find((i) => i.id === consumedPartItemId);
        partsPayload.push({
          itemId: consumedPartItemId,
          warehouseId: consumedPartWarehouseId || null,
          quantity: Number(consumedPartQty),
          unitCost: itemObj?.unitPrice ? Number(itemObj.unitPrice) : 0
        });
      }

      const res = await apiFetch(`${API}/maintenance/work-orders/${completingOrder.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootCause: completeRootCause.trim() || 'Wear and tear verified',
          resolutionNotes: completeResolution.trim() || 'Service completed and tested under load',
          downtimeMinutes: Number(completeDowntime) || 0,
          partsConsumed: partsPayload
        })
      });

      if (!res.ok) throw new Error('Could not complete work order');
      notify(`${completingOrder.orderNumber} completed · Asset returned to OPERATIONAL`);
      setIsCompleteModalOpen(false);
      setCompletingOrder(null);
      await refresh();
    } catch (err: any) {
      notify(err.message || 'Error completing work order');
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
      notify(`Cancelled ${order.orderNumber}`);
      await refresh();
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
      await refresh();
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
          assignedTechnicianUserId: form.get('technicianId') || null,
          failureSymptom: form.get('symptom'),
          scheduledDate: form.get('scheduledDate') || new Date().toISOString().slice(0, 10)
        })
      });
      if (!res.ok) throw new Error('Could not create maintenance work order');
      const saved = await res.json();
      notify(`Work order ${saved.orderNumber} created`);
      setIsNewOrderModalOpen(false);
      await refresh();
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
            <span className="linear-kpi-title">Active Work Orders</span>
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
            <span>Work Orders</span>
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

      {/* 3. TAB 1: MAINTENANCE WORK ORDERS */}
      {activeTab === 'work-orders' && (
        selectedOrderForDrawer ? (
          /* =========================================================================
             AUTHENTIC LINEAR DETAIL VIEW: MAINTENANCE WORK ORDER
             ========================================================================= */
          <div className="linear-detail-container">
            {/* Top Bar with Breadcrumbs & Actions */}
            <div className="linear-detail-topbar">
              <div className="linear-detail-breadcrumbs">
                <button
                  type="button"
                  className="linear-crumb-back"
                  onClick={() => setSelectedOrderForDrawer(null)}
                >
                  <ArrowLeft size={13} />
                  <span>Maintenance & CMMS</span>
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
                    style={{ background: '#059669' }}
                    onClick={() => {
                      openCompleteModal(selectedOrderForDrawer);
                    }}
                    disabled={busy}
                  >
                    <Check size={12} />
                    <span>Complete & Deduct Parts</span>
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
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                    ✓ Work order resolved & machinery restored
                  </span>
                )}
              </div>
            </div>

            {/* 2-Column Split: Content on Left, Linear Properties on Right */}
            <div className="linear-detail-grid">
              {/* Left Column (68%) */}
              <div className="linear-detail-content">
                <h1 className="linear-detail-h1">{selectedOrderForDrawer.assetName}</h1>
                <div className="linear-detail-desc" style={{ marginBottom: '16px' }}>
                  Work Center: <strong>{selectedOrderForDrawer.workCenterName || 'Shop Floor'}</strong> · Asset Code: <span className="sales-ref-badge">{selectedOrderForDrawer.assetCode}</span>
                </div>

                {/* Incident Symptom & Maintenance Target */}
                <div className="linear-sublines-card" style={{ marginBottom: '16px' }}>
                  <div className="linear-sublines-header">
                    <AlertTriangle size={13} style={{ color: 'var(--sp-brand)' }} />
                    <span>Incident Symptom & Maintenance Target</span>
                  </div>
                  <div style={{ padding: '14px', fontSize: '13px', lineHeight: 1.5, color: 'var(--sp-text)' }}>
                    {selectedOrderForDrawer.failureSymptom || 'Routine preventive inspection, lubrication, and calibration.'}
                  </div>
                </div>

                {/* Root Cause & Resolution Notes */}
                {(selectedOrderForDrawer.rootCause || selectedOrderForDrawer.resolutionNotes) && (
                  <div className="linear-sublines-card" style={{ marginBottom: '16px' }}>
                    <div className="linear-sublines-header">
                      <CheckCircle2 size={13} style={{ color: '#16a34a' }} />
                      <span>Investigation & Root Cause Analysis</span>
                    </div>
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {selectedOrderForDrawer.rootCause && (
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Root Cause:</span>
                          <span style={{ fontSize: '12.5px', color: 'var(--sp-text)' }}>{selectedOrderForDrawer.rootCause}</span>
                        </div>
                      )}
                      {selectedOrderForDrawer.resolutionNotes && (
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Resolution Notes:</span>
                          <span style={{ fontSize: '12.5px', color: 'var(--sp-text)' }}>{selectedOrderForDrawer.resolutionNotes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Replacement Parts Deducted from Stock */}
                <div className="linear-sublines-card">
                  <div className="linear-sublines-header">
                    <Boxes size={13} style={{ color: 'var(--sp-brand)' }} />
                    <span>Replacement Parts Consumed ({selectedOrderForDrawer.partsConsumed?.length || 0})</span>
                  </div>
                  {selectedOrderForDrawer.partsConsumed && selectedOrderForDrawer.partsConsumed.length > 0 ? (
                    <table className="sales-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Part / SKU</th>
                          <th>Warehouse</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrderForDrawer.partsConsumed.map((part) => (
                          <tr key={part.id} className="sales-row">
                            <td>
                              <div style={{ fontWeight: 500, fontSize: '12px' }}>{part.itemName}</div>
                              <div className="sales-sub-ref">{part.sku}</div>
                            </td>
                            <td style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>{part.warehouseName || 'Main Store'}</td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{part.quantity}</td>
                            <td className="sales-amount-cell">{formatCurrency(part.totalCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                      No replacement parts were consumed for this service (labor only).
                    </div>
                  )}
                </div>
              </div>

              {/* Right Properties Sidebar (32%) */}
              <div className="linear-properties-sidebar">
                <div className="linear-properties-card">
                  <div className="linear-properties-header">Properties</div>

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
                      <span
                        className={`sales-fulfillment-tag ${
                          selectedOrderForDrawer.priority === 'EMERGENCY' || selectedOrderForDrawer.priority === 'HIGH' ? 'pending' : 'shipped'
                        }`}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {selectedOrderForDrawer.priority.toLowerCase()}
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
                    <span className="linear-property-label">Station</span>
                    <span className="linear-property-value">
                      {selectedOrderForDrawer.workCenterName || 'Shop Floor'}
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Technician</span>
                    <span className="linear-property-value">
                      {selectedOrderForDrawer.assignedTechnicianName || 'Unassigned'}
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Scheduled Date</span>
                    <span className="linear-property-value">
                      {formatDate(selectedOrderForDrawer.scheduledDate)}
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Downtime</span>
                    <span className="linear-property-value" style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)' }}>
                      {selectedOrderForDrawer.downtimeMinutes > 0 ? `${selectedOrderForDrawer.downtimeMinutes} min` : '0 min'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
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

          {/* LIST VIEW: HIGH-DENSITY TRIAGE TABLE */}
          {ordersViewMode === 'list' ? (
            <div className="sales-table-card">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}>Order Number</th>
                    <th style={{ width: '110px' }}>Status</th>
                    <th style={{ width: '140px' }}>Type & Priority</th>
                    <th>Equipment & Symptom</th>
                    <th style={{ width: '160px' }}>Technician & Downtime</th>
                    <th style={{ textAlign: 'right', width: '90px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkOrders.map((wo) => {
                    const isBreakdown = wo.type === 'BREAKDOWN';
                    const isEmergency = wo.priority === 'EMERGENCY' || wo.priority === 'HIGH';

                    return (
                      <tr
                        key={wo.id}
                        className="sales-row"
                        onClick={() => setSelectedOrderForDrawer(wo)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <button
                            type="button"
                            className="sales-ref-badge interactive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderForDrawer(wo);
                            }}
                            title="Click to view work order details"
                          >
                            {wo.orderNumber}
                          </button>
                          <div className="sales-date-cell" style={{ marginTop: '3px' }}>
                            {formatDate(wo.scheduledDate)}
                          </div>
                        </td>
                        <td>
                          <Status label={wo.status} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="sales-warehouse-pill" style={{ textTransform: 'capitalize' }}>
                              {isBreakdown ? 'Breakdown' : 'Preventive'}
                            </span>
                            <span
                              className={`sales-fulfillment-tag ${isEmergency ? 'pending' : 'shipped'}`}
                              style={{ textTransform: 'capitalize' }}
                            >
                              {wo.priority.toLowerCase()}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                            {wo.assetName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <code className="sales-ref-badge" style={{ fontSize: '10.5px' }}>{wo.assetCode}</code>
                            <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>{wo.failureSymptom || 'Routine service'}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px' }}>
                            <User size={12} style={{ color: 'var(--sp-text-muted)' }} />
                            <span style={{ color: 'var(--sp-text)' }}>{wo.assignedTechnicianName || 'Unassigned'}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                            Downtime: {wo.downtimeMinutes > 0 ? `${wo.downtimeMinutes} min` : '0 min'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderForDrawer(wo);
                            }}
                          >
                            <span>Inspect</span>
                            <ChevronRight size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {!filteredWorkOrders.length && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--sp-text-muted)' }}>
                        No maintenance work orders match your search and filter criteria.
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
                        {stage === 'OPEN' ? 'OPEN TICKETS' : stage === 'IN_PROGRESS' ? 'IN PROGRESS' : 'RESOLVED & VERIFIED'}
                      </span>
                      <span className="sales-subnav-badge">{stageOrders.length}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {stageOrders.map((wo) => {
                        return (
                          <div
                            key={wo.id}
                            style={{
                              background: 'var(--sp-surface-subtle)',
                              border: '1px solid var(--sp-border)',
                              borderRadius: '6px',
                              padding: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span className="sales-ref-badge">{wo.orderNumber}</span>
                              <Status label={wo.status} />
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
                                {wo.assignedTechnicianName ? `Tech: ${wo.assignedTechnicianName}` : 'Unassigned'}
                              </div>

                              <div style={{ display: 'flex', gap: '4px' }}>
                                {wo.status === 'OPEN' && (
                                  <button
                                    type="button"
                                    className="sales-action-btn primary"
                                    style={{ height: '22px', fontSize: '11px', padding: '0 8px' }}
                                    onClick={() => void handleStartWorkOrder(wo)}
                                  >
                                    <Play size={10} />
                                    <span>Start</span>
                                  </button>
                                )}
                                {wo.status === 'IN_PROGRESS' && (
                                  <button
                                    type="button"
                                    className="sales-action-btn primary"
                                    style={{ height: '22px', fontSize: '11px', padding: '0 8px', background: '#059669' }}
                                    onClick={() => openCompleteModal(wo)}
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
                          No tickets in this stage
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )
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
                      title="Dispatch an active work order right now"
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
                    <th style={{ width: '140px' }}>Work Order</th>
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
          <div className="sales-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="sales-card-header" style={{ paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 className="sales-card-title">
                  {newOrderType === 'BREAKDOWN' ? 'Report Machine Breakdown Ticket' : 'Plan Preventive Maintenance'}
                </h3>
                <p className="sales-card-subtitle">
                  {newOrderType === 'BREAKDOWN'
                    ? 'Dispatches an urgent repair work order and flags machinery as under maintenance'
                    : 'Schedules planned inspection and servicing'}
                </p>
              </div>
              <button type="button" className="sales-search-clear" onClick={() => setIsNewOrderModalOpen(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <input type="hidden" name="type" value={newOrderType} />

              <label className="pos-input-label">
                Equipment / Machine Asset *
                <select
                  name="assetId"
                  className="filter-select"
                  style={{ width: '100%', height: '32px', marginTop: '4px' }}
                  defaultValue={preselectedAssetId || assets[0]?.id}
                  required
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name} ({a.status})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label className="pos-input-label">
                  Priority Level *
                  <select
                    name="priority"
                    className="filter-select"
                    style={{ width: '100%', height: '32px', marginTop: '4px' }}
                    defaultValue={newOrderType === 'BREAKDOWN' ? 'HIGH' : 'MEDIUM'}
                  >
                    <option value="EMERGENCY">Emergency (Line Stopped)</option>
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low / Routine</option>
                  </select>
                </label>

                <label className="pos-input-label">
                  Assigned Technician
                  <select
                    name="technicianId"
                    className="filter-select"
                    style={{ width: '100%', height: '32px', marginTop: '4px' }}
                  >
                    <option value="">Auto-Dispatch to Shift</option>
                    {teamUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="pos-input-label">
                Failure Symptoms / Service Instructions *
                <textarea
                  name="symptom"
                  className="sales-search-input"
                  style={{ width: '100%', height: '70px', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  placeholder="Describe abnormal sounds, vibration, temperature alarm, or maintenance steps required…"
                  required
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="sales-action-btn secondary" onClick={() => setIsNewOrderModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="sales-action-btn primary" disabled={busy}>
                  {busy ? 'Dispatching…' : 'Dispatch Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: COMPLETE WORK ORDER & DEDUCT SPARE PARTS */}
      {isCompleteModalOpen && completingOrder && (
        <div className="modal-backdrop" onClick={() => setIsCompleteModalOpen(false)}>
          <div className="sales-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="sales-card-header" style={{ paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 className="sales-card-title">Complete Repair & Resolve Machine</h3>
                <p className="sales-card-subtitle">
                  {completingOrder.orderNumber} · {completingOrder.assetName}
                </p>
              </div>
              <button type="button" className="sales-search-clear" onClick={() => setIsCompleteModalOpen(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <label className="pos-input-label">
                  Root Cause of Failure
                  <input
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    placeholder="e.g. Bearing race fatigue, debris ingress..."
                    value={completeRootCause}
                    onChange={(e) => setCompleteRootCause(e.target.value)}
                  />
                </label>

                <label className="pos-input-label">
                  Downtime (Minutes) *
                  <input
                    type="number"
                    min="0"
                    className="sales-search-input"
                    style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)', fontVariantNumeric: 'tabular-nums' }}
                    value={completeDowntime}
                    onChange={(e) => setCompleteDowntime(e.target.value)}
                    required
                  />
                </label>
              </div>

              <label className="pos-input-label">
                Resolution & Corrective Actions Notes *
                <textarea
                  className="sales-search-input"
                  style={{ width: '100%', height: '60px', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  placeholder="Detail parts replaced, torque settings verified, and alignment tests performed…"
                  value={completeResolution}
                  onChange={(e) => setCompleteResolution(e.target.value)}
                  required
                />
              </label>

              {/* Deduct Spare Part Section */}
              <div style={{ padding: '10px', background: 'var(--sp-surface-subtle)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
                <span className="pos-input-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                  <Boxes size={12} />
                  <span>Deduct Replacement Spare Part (Optional)</span>
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '6px' }}>
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '30px' }}
                    value={consumedPartItemId}
                    onChange={(e) => setConsumedPartItemId(e.target.value)}
                  >
                    <option value="">No parts consumed (Labor only)</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.sku} — {i.name} ({i.available ?? i.stock} available)
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    placeholder="Qty used"
                    className="sales-search-input"
                    style={{ height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)', fontVariantNumeric: 'tabular-nums' }}
                    value={consumedPartQty}
                    onChange={(e) => setConsumedPartQty(e.target.value)}
                  />
                </div>

                {consumedPartItemId && (
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '28px' }}
                    value={consumedPartWarehouseId}
                    onChange={(e) => setConsumedPartWarehouseId(e.target.value)}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        Deduct from: {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button type="button" className="sales-action-btn secondary" onClick={() => setIsCompleteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="sales-action-btn primary" disabled={busy}>
                  {busy ? 'Resolving…' : '✓ Resolve & Return to Operational'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTER NEW MACHINERY ASSET */}
      {isNewAssetModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsNewAssetModalOpen(false)}>
          <div className="sales-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="sales-card-header" style={{ paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 className="sales-card-title">Register Physical Machinery Asset</h3>
                <p className="sales-card-subtitle">Add machine tooling, serial number, and runtime meter</p>
              </div>
              <button type="button" className="sales-search-clear" onClick={() => setIsNewAssetModalOpen(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateAssetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                <label className="pos-input-label">
                  Asset Code *
                  <input
                    name="code"
                    required
                    placeholder="e.g. EQ-CNC-02"
                    className="sales-search-input"
                    style={{ width: '100%', height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  />
                </label>
                <label className="pos-input-label">
                  Asset / Machine Name *
                  <input
                    name="name"
                    required
                    placeholder="e.g. Mazak QuickTurn 250 CNC Lathe"
                    className="sales-search-input"
                    style={{ width: '100%', height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label className="pos-input-label">
                  Manufacturer
                  <input
                    name="manufacturer"
                    placeholder="e.g. Mazak / Haas"
                    className="sales-search-input"
                    style={{ width: '100%', height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  />
                </label>
                <label className="pos-input-label">
                  Model
                  <input
                    name="model"
                    placeholder="e.g. QT-250 8-Axis"
                    className="sales-search-input"
                    style={{ width: '100%', height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label className="pos-input-label">
                  Serial Number
                  <input
                    name="serialNumber"
                    placeholder="SN-109482-B"
                    className="sales-search-input"
                    style={{ width: '100%', height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  />
                </label>
                <label className="pos-input-label">
                  Operating Meter (Hours)
                  <input
                    name="meterHours"
                    type="number"
                    step="0.1"
                    defaultValue="0.0"
                    className="sales-search-input"
                    style={{ width: '100%', height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  />
                </label>
              </div>

              <label className="pos-input-label">
                Notes & Lubricant Specifications
                <textarea
                  name="notes"
                  className="sales-search-input"
                  style={{ width: '100%', height: '50px', padding: '6px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                  placeholder="Coolant specs, electrical ratings, spare belt numbers…"
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
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
          <div className="sales-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="sales-card-header" style={{ paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)' }}>
              <div>
                <h3 className="sales-card-title">Create Preventive Maintenance Plan</h3>
                <p className="sales-card-subtitle">Set periodic inspection intervals for machinery</p>
              </div>
              <button type="button" className="sales-search-clear" onClick={() => setIsNewScheduleModalOpen(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              <label className="pos-input-label">
                Target Machinery Asset *
                <select name="assetId" className="filter-select" style={{ width: '100%', height: '32px' }} required>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pos-input-label">
                Service Plan Title *
                <input
                  name="title"
                  required
                  placeholder="e.g. Quarterly Spindle Alignment & Belt Tension Check"
                  className="sales-search-input"
                  style={{ width: '100%', height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label className="pos-input-label">
                  Frequency Cadence *
                  <select name="frequencyType" className="filter-select" style={{ width: '100%', height: '30px' }}>
                    <option value="CALENDAR_DAYS">Calendar Days</option>
                    <option value="METER_HOURS">Operating Meter Hours</option>
                  </select>
                </label>
                <label className="pos-input-label">
                  Interval Count *
                  <input
                    name="interval"
                    type="number"
                    min="1"
                    defaultValue="30"
                    className="sales-search-input"
                    style={{ width: '100%', height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--sp-border)' }}
                    required
                  />
                </label>
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
