import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Download,
  Eye,
  Factory,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Truck,
  Warehouse,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import { Status } from '../../components/ui/Status';
import type { ItemSummary } from '../../types/inventory';
import type {
  MrpPlannedOrder,
  MrpRun,
  MrpMetrics,
  CalculateMrpRequest,
  BatchConvertRequest,
  BatchConvertResult
} from '../../types/mrp';

interface MrpPanelProps {
  items: ItemSummary[];
  role?: string;
  notify: (message: string) => void;
}

type MrpTab = 'recommendations' | 'runs';

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

export function MrpPanel({ items, role, notify }: MrpPanelProps) {
  const [activeTab, setActiveTab] = useState<MrpTab>('recommendations');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Core Data
  const [plannedOrders, setPlannedOrders] = useState<MrpPlannedOrder[]>([]);
  const [runs, setRuns] = useState<MrpRun[]>([]);
  const [metrics, setMetrics] = useState<MrpMetrics | null>(null);

  // Filtering & Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<MrpPlannedOrder | null>(null);

  // Modal Dialogs
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [runHorizonWeeks, setRunHorizonWeeks] = useState(8);
  const [runIncludeSafety, setRunIncludeSafety] = useState(true);
  const [runNotes, setRunNotes] = useState('');

  // Load telemetry & registers
  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, runsRes, metricsRes] = await Promise.all([
        apiFetch(`${API}/mrp/planned-orders`),
        apiFetch(`${API}/mrp/runs`),
        apiFetch(`${API}/mrp/metrics`)
      ]);

      if (ordersRes.ok) setPlannedOrders(await ordersRes.json());
      if (runsRes.ok) setRuns(await runsRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
    } catch (err) {
      console.error('Failed to load MRP data:', err);
      notify('Failed to refresh MRP engine calculation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered recommendations
  const filteredOrders = useMemo(() => {
    return plannedOrders.filter(o => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        o.sku.toLowerCase().includes(q) ||
        o.itemName.toLowerCase().includes(q) ||
        (o.supplierName && o.supplierName.toLowerCase().includes(q)) ||
        (o.demandSourceRef && o.demandSourceRef.toLowerCase().includes(q));

      const matchesUrgency = urgencyFilter === 'ALL' || o.urgency === urgencyFilter;
      const matchesAction = actionFilter === 'ALL' || o.actionType === actionFilter;
      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;

      return matchesSearch && matchesUrgency && matchesAction && matchesStatus;
    });
  }, [plannedOrders, searchQuery, urgencyFilter, actionFilter, statusFilter]);

  // Selection helpers
  const toggleSelectOrder = (id: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrderIds(next);
  };

  const selectAllPending = () => {
    const pendingOrders = filteredOrders.filter(o => o.status === 'PENDING');
    if (selectedOrderIds.size === pendingOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(pendingOrders.map(o => o.id)));
    }
  };

  // 1-Click Convert single order
  const handleConvertSingle = async (orderId: string) => {
    try {
      setBusy(true);
      const payload: BatchConvertRequest = { orderIds: [orderId] };
      const res = await apiFetch(`${API}/mrp/batch-convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Could not convert order');
      const result: BatchConvertResult = await res.json();
      notify(`Order converted! Successfully released live order.`);
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Conversion failed');
    } finally {
      setBusy(false);
    }
  };

  // Dismiss single order
  const handleDismissSingle = async (orderId: string) => {
    try {
      setBusy(true);
      const res = await apiFetch(`${API}/mrp/planned-orders/${orderId}/dismiss`, { method: 'POST' });
      if (!res.ok) throw new Error('Could not dismiss recommendation');
      notify('Planned order recommendation dismissed');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Dismiss failed');
    } finally {
      setBusy(false);
    }
  };

  // Batch convert selected
  const handleBatchConvert = async () => {
    if (selectedOrderIds.size === 0) return;
    try {
      setBusy(true);
      const payload: BatchConvertRequest = { orderIds: Array.from(selectedOrderIds) };
      const res = await apiFetch(`${API}/mrp/batch-convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Batch conversion failed');
      }
      const result: BatchConvertResult = await res.json();
      notify(`Batch converted! Successfully released ${result.convertedCount} orders.`);
      setIsBatchModalOpen(false);
      setSelectedOrderIds(new Set());
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Batch conversion failed');
    } finally {
      setBusy(false);
    }
  };

  // Execute MRP Run
  const handleRunMrp = async () => {
    try {
      setBusy(true);
      const payload: CalculateMrpRequest = {
        planningHorizonWeeks: runHorizonWeeks,
        includeSafetyStock: runIncludeSafety,
        notes: runNotes || 'Automated demand explosion',
      };
      const res = await apiFetch(`${API}/mrp/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'MRP calculation failed');
      }
      const newRun: MrpRun = await res.json();
      notify(`MRP Run ${newRun.runNumber} finished! ${newRun.totalRecommendations} recommendations generated.`);
      setIsRunModalOpen(false);
      setRunNotes('');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'MRP calculation failed');
    } finally {
      setBusy(false);
    }
  };

  // Selection metrics
  const selectedOrdersList = useMemo(() => {
    return plannedOrders.filter(o => selectedOrderIds.has(o.id));
  }, [plannedOrders, selectedOrderIds]);

  const selectedTotalCost = useMemo(() => {
    return selectedOrdersList.reduce((sum, o) => sum + (o.estimatedTotalCost || 0), 0);
  }, [selectedOrdersList]);

  return (
    <div className="sales-screen-layout">
      {selectedOrderForDrawer ? (
        /* =========================================================================
           AUTHENTIC LINEAR DETAIL VIEW: MRP SHORTAGE REQUIREMENT
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
                <span>Planning (MRP)</span>
              </button>
              <span className="linear-crumb-sep">/</span>
              <span className="linear-crumb-id">
                {selectedOrderForDrawer.convertedOrderNumber || `MRP-${selectedOrderForDrawer.actionType === 'PURCHASE_ORDER' ? 'PO' : 'WO'}-${selectedOrderForDrawer.id.slice(0, 6).toUpperCase()}`}
              </span>
            </div>

            <div className="linear-detail-top-actions">
              {selectedOrderForDrawer.status === 'PENDING' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="sales-action-btn primary"
                    onClick={async () => {
                      const id = selectedOrderForDrawer.id;
                      await handleConvertSingle(id);
                      setSelectedOrderForDrawer(null);
                    }}
                    disabled={busy}
                  >
                    <Check size={12} />
                    <span>Convert to Live {selectedOrderForDrawer.actionType === 'PURCHASE_ORDER' ? 'Purchase Order' : 'Work Order'}</span>
                  </button>
                  <button
                    type="button"
                    className="sales-action-btn ghost"
                    style={{ color: 'var(--sp-danger)' }}
                    onClick={async () => {
                      const id = selectedOrderForDrawer.id;
                      await handleDismissSingle(id);
                      setSelectedOrderForDrawer(null);
                    }}
                    disabled={busy}
                  >
                    <X size={12} />
                    <span>Dismiss Shortage</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--sp-success)' }}>
                  <CheckCircle2 size={14} />
                  <span>Converted Order: <strong>{selectedOrderForDrawer.convertedOrderNumber || selectedOrderForDrawer.status}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* 2-Column Linear Layout */}
          <div className="linear-detail-grid">
            {/* Left Column: Shortage Narrative & Outlay */}
            <div className="linear-detail-content">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="order-number-pill">
                    {selectedOrderForDrawer.convertedOrderNumber || `MRP-${selectedOrderForDrawer.actionType === 'PURCHASE_ORDER' ? 'PO' : 'WO'}-${selectedOrderForDrawer.id.slice(0, 6).toUpperCase()}`}
                  </span>
                  <Status label={selectedOrderForDrawer.status} />
                  <span className={`priority-tag priority-${selectedOrderForDrawer.urgency.toLowerCase()}`}>
                    {selectedOrderForDrawer.urgency}
                  </span>
                </div>
                <h1 className="linear-detail-h1">{selectedOrderForDrawer.itemName}</h1>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--sp-text-muted)' }}>
                  SKU: <strong style={{ color: 'var(--sp-text)' }}>{selectedOrderForDrawer.sku}</strong> · Classification: <strong style={{ color: 'var(--sp-text)' }}>{selectedOrderForDrawer.itemType}</strong>
                </p>
              </div>

              {/* Requirement & Shortage Outlay */}
              <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                  Requirement & Financial Outlay
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>Recommended Quantity</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--sp-brand)', marginTop: '2px' }}>
                      {selectedOrderForDrawer.recommendedQuantity} {selectedOrderForDrawer.unit}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>Estimated Spend</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)', marginTop: '2px' }}>
                      {formatCurrency(selectedOrderForDrawer.estimatedTotalCost)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>Estimated Unit Cost</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)', marginTop: '4px' }}>
                      {formatCurrency(selectedOrderForDrawer.estimatedUnitCost)} / {selectedOrderForDrawer.unit}
                    </div>
                  </div>
                </div>
              </div>

              {/* Supply Route & Demand Origin Card */}
              <div className="linear-sublines-card">
                <div className="linear-sublines-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Factory size={13} style={{ color: 'var(--sp-brand)' }} />
                    <span>Supply Route & Demand Origin</span>
                  </div>
                </div>
                <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>Fulfillment Action</div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>
                      {selectedOrderForDrawer.actionType === 'PURCHASE_ORDER' ? 'External Vendor Purchase Order' : 'Internal Shop Floor Work Order'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>
                      {selectedOrderForDrawer.actionType === 'PURCHASE_ORDER' ? 'Assigned Vendor' : 'BOM Revision'}
                    </div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>
                      {selectedOrderForDrawer.supplierName || selectedOrderForDrawer.bomRevision || 'Default Factory Standard'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>Demand Driver</div>
                    <div style={{ textTransform: 'capitalize', marginTop: '2px' }}>
                      {selectedOrderForDrawer.demandSourceType.replace(/_/g, ' ').toLowerCase()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>Demand Reference</div>
                    <div style={{ fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
                      {selectedOrderForDrawer.demandSourceRef || 'Aggregated Safety Stock Calculation'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Linear Properties Sidebar */}
            <div className="linear-properties-sidebar">
              <div className="linear-properties-card">
                <div className="linear-properties-title">Properties</div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Status</span>
                  <Status label={selectedOrderForDrawer.status} />
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Urgency</span>
                  <span className={`priority-tag priority-${selectedOrderForDrawer.urgency.toLowerCase()}`}>
                    {selectedOrderForDrawer.urgency}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Required By</span>
                  <span className="linear-property-value" style={{ fontWeight: 600, color: 'var(--sp-warning)' }}>
                    {formatDate(selectedOrderForDrawer.requiredByDate)}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Order By Date</span>
                  <span className="linear-property-value">
                    {formatDate(selectedOrderForDrawer.recommendedOrderDate)}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Lead Offset</span>
                  <span className="linear-property-value">
                    {selectedOrderForDrawer.leadTimeDays} Calendar Days
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">MRP Run</span>
                  <span className="linear-property-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {selectedOrderForDrawer.runNumber}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Linear Executive Telemetry Strip */}
          <div className="linear-kpi-grid">
            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Open Net Shortages</span>
                <AlertTriangle size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics?.openShortagesCount ?? 0} Shortages
              </div>
              <div className="linear-kpi-caption">
                Deficits requiring procurement action
              </div>
            </div>

            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Planned Purchases (PO)</span>
                <ShoppingCart size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics?.plannedPurchasesCount ?? plannedOrders.filter(o => o.actionType === 'PURCHASE_ORDER').length} Orders
              </div>
              <div className="linear-kpi-caption">
                {formatCurrency(metrics?.totalProjectedSpend ?? 0)} projected spend
              </div>
            </div>

            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Planned Work Orders (WO)</span>
                <Factory size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics?.plannedWorkOrdersCount ?? plannedOrders.filter(o => o.actionType === 'WORK_ORDER').length} Orders
              </div>
              <div className="linear-kpi-caption">
                Sub-assemblies recommended for manufacture
              </div>
            </div>

            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Converted Orders</span>
                <FileCheck size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics?.convertedOrdersCount ?? plannedOrders.filter(o => o.status === 'CONVERTED').length} Converted
              </div>
              <div className="linear-kpi-caption">
                Released to active live production
              </div>
            </div>
          </div>

          {/* 2. Linear Sub-Navigation Tabs */}
          <div className="sales-subnav-container">
            <div className="sales-subnav-tabs">
              <button
                type="button"
                className={`sales-subnav-tab ${activeTab === 'recommendations' ? 'active' : ''}`}
                onClick={() => setActiveTab('recommendations')}
              >
                <FileText size={13} />
                <span>Planned Orders & Recommendations</span>
                <span className="sales-subnav-badge">
                  {plannedOrders.filter((o) => o.status === 'PENDING').length}
                </span>
              </button>

              <button
                type="button"
                className={`sales-subnav-tab ${activeTab === 'runs' ? 'active' : ''}`}
                onClick={() => setActiveTab('runs')}
              >
                <Clock size={13} />
                <span>Calculation Runs</span>
                <span className="sales-subnav-badge">{runs.length}</span>
              </button>
            </div>

            <div className="sales-subnav-actions">
              {selectedOrderIds.size > 0 && (
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setIsBatchModalOpen(true)}
                >
                  <CheckCircle2 size={12} />
                  <span>Convert Selected ({selectedOrderIds.size})</span>
                </button>
              )}

              <button
                type="button"
                className="sales-action-btn primary"
                onClick={() => setIsRunModalOpen(true)}
              >
                <Play size={12} />
                <span>Run MRP Engine</span>
              </button>

              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={loadData}
                disabled={loading || busy}
                title="Refresh Planning Matrix"
              >
                <RotateCcw size={12} className={loading ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* 3. TAB 1: PLANNED ORDERS & RECOMMENDATIONS */}
          {activeTab === 'recommendations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Toolbar */}
              <div className="sales-toolbar">
                <div className="sales-pill-group">
                  <button
                    type="button"
                    className={`sales-pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('ALL')}
                  >
                    <span>All Statuses</span>
                    <span className="sales-pill-count">{plannedOrders.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${statusFilter === 'PENDING' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('PENDING')}
                  >
                    <span>Pending Action</span>
                    <span className="sales-pill-count">
                      {plannedOrders.filter((o) => o.status === 'PENDING').length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${actionFilter === 'PURCHASE_ORDER' ? 'active' : ''}`}
                    onClick={() => setActionFilter(actionFilter === 'PURCHASE_ORDER' ? 'ALL' : 'PURCHASE_ORDER')}
                  >
                    <span>Purchase (PO)</span>
                    <span className="sales-pill-count">
                      {plannedOrders.filter((o) => o.actionType === 'PURCHASE_ORDER').length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`sales-pill-btn ${actionFilter === 'WORK_ORDER' ? 'active' : ''}`}
                    onClick={() => setActionFilter(actionFilter === 'WORK_ORDER' ? 'ALL' : 'WORK_ORDER')}
                  >
                    <span>Work Orders (WO)</span>
                    <span className="sales-pill-count">
                      {plannedOrders.filter((o) => o.actionType === 'WORK_ORDER').length}
                    </span>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="sales-search-box">
                    <Search size={13} className="sales-search-icon" />
                    <input
                      type="text"
                      className="sales-search-input"
                      placeholder="Filter by SKU, item name, supplier…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="sales-search-clear"
                        onClick={() => setSearchQuery('')}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="sales-action-btn secondary"
                    onClick={selectAllPending}
                  >
                    <span>{selectedOrderIds.size > 0 ? 'Deselect All' : 'Select Pending'}</span>
                  </button>
                </div>
              </div>

              {/* Linear Planning Recommendations Table */}
              <div className="sales-table-card">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th style={{ width: '36px', textAlign: 'center', padding: '0 6px' }}>
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.size > 0 && selectedOrderIds.size === filteredOrders.filter((o) => o.status === 'PENDING').length}
                          onChange={selectAllPending}
                        />
                      </th>
                      <th style={{ width: '190px' }}>Order Ref</th>
                      <th>Item</th>
                      <th style={{ width: '170px' }}>Action & Qty</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Est. Spend</th>
                      <th style={{ width: '130px' }}>Required By</th>
                      <th style={{ width: '110px' }}>Status</th>
                      <th style={{ width: '80px', textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sp-text-muted)' }}>
                          No planned order shortages matching your filter.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isPending = order.status === 'PENDING';
                        const isSelected = selectedOrderIds.has(order.id);
                        const orderRef = order.convertedOrderNumber || `MRP-${order.actionType === 'PURCHASE_ORDER' ? 'PO' : 'WO'}-${order.id.slice(0, 6).toUpperCase()}`;

                        return (
                          <tr
                            key={order.id}
                            className="sales-row production-clickable-row"
                            style={{
                              background: isSelected ? 'var(--sp-brand-soft)' : undefined,
                              cursor: 'pointer'
                            }}
                            onClick={() => setSelectedOrderForDrawer(order)}
                          >
                            <td
                              style={{ textAlign: 'center', padding: '0 6px' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isPending ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectOrder(order.id)}
                                />
                              ) : (
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--sp-border)', display: 'inline-block' }} />
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="order-number-pill interactive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrderForDrawer(order);
                                  }}
                                  title="Click to inspect MRP shortage details"
                                >
                                  <span>{orderRef}</span>
                                  <ArrowUpRight size={11} className="order-link-arrow" />
                                </button>
                                <span className={`priority-tag priority-${order.urgency.toLowerCase()}`}>
                                  {order.urgency}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '13px' }}>
                                {order.itemName}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <span className="station-code-pill" style={{ fontSize: '11px', fontWeight: 500 }}>
                                  {order.actionType === 'PURCHASE_ORDER' ? 'Purchase Order' : 'Work Order'}
                                </span>
                                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '12.5px', color: 'var(--sp-text)' }}>
                                  {order.recommendedQuantity} <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', fontWeight: 400 }}>{order.unit}</span>
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(order.estimatedTotalCost)}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '12px', color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatDate(order.requiredByDate)}
                              </div>
                            </td>
                            <td>
                              <Status label={order.status} />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="sales-action-btn secondary"
                                style={{ height: '24px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrderForDrawer(order);
                                }}
                                title="Inspect requirement details"
                              >
                                <span>Inspect</span>
                                <ArrowUpRight size={11} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

      {/* 4. TAB 2: CALCULATION RUNS */}
      {activeTab === 'runs' && (
        <div className="sales-table-card">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>RUN NUMBER</th>
                  <th>HORIZON</th>
                  <th style={{ textAlign: 'center' }}>STATUS</th>
                  <th>RECOMMENDATIONS</th>
                  <th>SHORTAGE UNITS</th>
                  <th style={{ textAlign: 'right' }}>PROJECTED SPEND</th>
                  <th>INITIATED BY</th>
                  <th>TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="sales-row">
                    <td>
                      <span className="sales-ref-badge">{run.runNumber}</span>
                    </td>
                    <td className="sales-date-cell">{run.planningHorizonWeeks} Weeks</td>
                    <td style={{ textAlign: 'center' }}>
                      <Status label={run.status} />
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{run.totalRecommendations} orders</span>
                    </td>
                    <td>{run.totalShortageUnits} units</td>
                    <td className="sales-amount-cell">
                      {formatCurrency(run.totalPlannedSpend)}
                    </td>
                    <td className="sales-date-cell">{run.createdByName}</td>
                    <td className="sales-date-cell">{formatDate(run.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* MODAL: RUN MRP ENGINE */}
      {isRunModalOpen && (
        <div className="leads-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setIsRunModalOpen(false); }}>
          <div className="leads-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Execute MRP Demand Explosion</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Calculate net material shortages and generate purchase/work order recommendations.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setIsRunModalOpen(false)}
                disabled={busy}
              >
                <X size={14} />
              </button>
            </div>

            <div className="leads-modal-body">
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                Planning Horizon
                <select
                  value={runHorizonWeeks}
                  onChange={(e) => setRunHorizonWeeks(Number(e.target.value))}
                  style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                >
                  <option value={4}>4 Weeks (Standard Monthly Plan)</option>
                  <option value={8}>8 Weeks (Two Months Lookahead)</option>
                  <option value={12}>12 Weeks (Quarterly Demand Horizon)</option>
                  <option value={16}>16 Weeks (Extended Capital Cycle)</option>
                </select>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={runIncludeSafety}
                  onChange={(e) => setRunIncludeSafety(e.target.checked)}
                />
                <span>Buffer Against Minimum Safety Stock Thresholds</span>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                Run Notes (Optional)
                <textarea
                  rows={2}
                  placeholder="e.g. Weekly production cycle demand explosion…"
                  value={runNotes}
                  onChange={(e) => setRunNotes(e.target.value)}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                />
              </label>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setIsRunModalOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={handleRunMrp}
                disabled={busy}
              >
                {busy ? 'Calculating…' : 'Execute MRP Run'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BATCH CONVERT ORDERS */}
      {isBatchModalOpen && (
        <div className="leads-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setIsBatchModalOpen(false); }}>
          <div className="leads-modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>1-Click Batch Order Conversion</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Release {selectedOrderIds.size} planned orders directly into live execution.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setIsBatchModalOpen(false)}
                disabled={busy}
              >
                <X size={14} />
              </button>
            </div>

            <div className="leads-modal-body">
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'var(--sp-surface-subtle)',
                  border: '1px solid var(--sp-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px'
                }}
              >
                <span>Total Financial Outlay:</span>
                <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--sp-brand)' }}>
                  {formatCurrency(selectedTotalCost)}
                </strong>
              </div>

              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedOrdersList.map((o) => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', padding: '4px 0', borderBottom: '1px solid var(--sp-border-subtle)' }}>
                    <div>
                      <span className="sales-ref-badge" style={{ marginRight: '6px' }}>{o.sku}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>({o.recommendedQuantity} {o.unit})</span>
                    </div>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatCurrency(o.estimatedTotalCost)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setIsBatchModalOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={handleBatchConvert}
                disabled={busy}
              >
                {busy ? 'Converting…' : `Confirm & Convert (${selectedOrderIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
