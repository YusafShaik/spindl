import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Download,
  Filter,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Warehouse as WarehouseIcon,
  X
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';
import type { TenantBranchSummary } from '../../types/crm';
import type {
  CycleCountLine,
  CycleCountSession,
  InventoryTransfer,
  ItemSummary,
  WarehouseStockSummary,
  WarehouseSummary
} from '../../types/inventory';

interface InventoryWarehousePanelProps {
  items: ItemSummary[];
  role?: string;
  notify: (message: string) => void;
  onPosted: () => Promise<void>;
}

type WarehouseSubTab = 'stock' | 'transfers' | 'cycle-counts' | 'facilities';

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

export function InventoryWarehousePanel({ items, role, notify, onPosted }: InventoryWarehousePanelProps) {
  const canManage = role !== undefined && ['OWNER', 'ADMIN', 'MANAGER'].includes(role);

  // Sub-Navigation State
  const [activeTab, setActiveTab] = useState<WarehouseSubTab>('stock');

  // Core Data Stores
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [branches, setBranches] = useState<TenantBranchSummary[]>([]);
  const [balances, setBalances] = useState<WarehouseStockSummary[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [cycleCounts, setCycleCounts] = useState<CycleCountSession[]>([]);

  // Selection & UI Filters
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW' | 'QC_HOLD'>('ALL');

  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [transferStatusFilter, setTransferStatusFilter] = useState<string>('ALL');

  const [cycleCountSearchQuery, setCycleCountSearchQuery] = useState('');
  const [cycleCountStatusFilter, setCycleCountStatusFilter] = useState<string>('ALL');
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [lineInputs, setLineInputs] = useState<Record<string, number | string>>({});

  const [facilitySearchQuery, setFacilitySearchQuery] = useState('');

  // Modals & Action Forms
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isCountModalOpen, setIsCountModalOpen] = useState(false);

  // Transfer Form State
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [transferKey, setTransferKey] = useState(() => crypto.randomUUID());

  // Loading & Async Flags
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Load Branches
  useEffect(() => {
    apiFetch(`${API}/tenant/branches`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: TenantBranchSummary[]) => setBranches(rows))
      .catch(() => setBranches([]));
  }, []);

  // Primary Data Fetch: Warehouses, Transfers, Cycle Counts
  const loadPrimaryData = async (): Promise<void> => {
    const [whRes, trRes, ccRes] = await Promise.all([
      apiFetch(`${API}/inventory/warehouses`),
      apiFetch(`${API}/inventory/transfers`),
      apiFetch(`${API}/inventory/cycle-counts`)
    ]);

    if (!whRes.ok || !trRes.ok) {
      throw new Error('Could not load inventory warehouse and movement data');
    }

    const whData: WarehouseSummary[] = await whRes.json();
    const trData: InventoryTransfer[] = await trRes.json();
    const ccData: CycleCountSession[] = ccRes.ok ? await ccRes.json() : [];

    setWarehouses(whData);
    setTransfers(trData);
    setCycleCounts(ccData);

    // Auto-expand any active counting session
    const active = ccData.find((c) => c.status === 'COUNTING' || c.status === 'REVIEW');
    if (active) {
      setExpandedSessions((prev) => ({ ...prev, [active.id]: true }));
    }

    if (whData.length > 0) {
      setSelectedWarehouseId((curr) => {
        if (curr && whData.some((w) => w.id === curr)) return curr;
        const def = whData.find((w) => w.isDefault) || whData[0];
        return def.id;
      });

      setSourceWarehouseId((curr) => {
        if (curr && whData.some((w) => w.id === curr)) return curr;
        return (whData.find((w) => w.isDefault) || whData[0]).id;
      });

      setDestinationWarehouseId((curr) => {
        if (curr && whData.some((w) => w.id === curr)) return curr;
        const main = whData.find((w) => w.isDefault) || whData[0];
        return whData.find((w) => w.id !== main.id)?.id || '';
      });
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadPrimaryData()
      .catch((err) => {
        if (active) notify(messageFrom(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshIndex]);

  // Load Stock for Selected Warehouse
  useEffect(() => {
    if (!selectedWarehouseId) return;
    let active = true;
    setStockLoading(true);
    apiFetch(`${API}/inventory/warehouses/${selectedWarehouseId}/stock`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Could not load location stock'))))
      .then((data: WarehouseStockSummary[]) => {
        if (active) setBalances(data);
      })
      .catch((err) => {
        if (active) notify(messageFrom(err));
      })
      .finally(() => {
        if (active) setStockLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedWarehouseId, refreshIndex]);

  // Warehouse Creation
  const handleCreateWarehouse = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/inventory/warehouses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: String(form.get('code') || '').trim().toUpperCase(),
          name: String(form.get('name') || '').trim(),
          branchId: form.get('branchId') || null
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.detail || body.message || 'Could not create warehouse location');
      }
      setIsAddWarehouseOpen(false);
      formElement.reset();
      await loadPrimaryData();
      if (body.id) setSelectedWarehouseId(body.id);
      notify(`Warehouse facility ${body.name} (${body.code}) created successfully`);
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  // Stock Transfer Request
  const handleCreateTransfer = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/inventory/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: form.get('itemId'),
          sourceWarehouseId: sourceWarehouseId,
          destinationWarehouseId: destinationWarehouseId,
          quantity: Number(form.get('quantity')),
          reason: form.get('reason'),
          idempotencyKey: transferKey
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.detail || body.message || 'Could not create transfer request');
      }
      setTransferKey(crypto.randomUUID());
      setIsTransferModalOpen(false);
      formElement.reset();
      await loadPrimaryData();
      notify(`Transfer request ${body.reference} created and submitted for approval`);
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  // Transfer Lifecycle Action (Approve, Dispatch, Receive, Cancel)
  const transitionTransfer = async (id: string, action: string): Promise<void> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/inventory/transfers/${id}/${action}`, {
        method: 'POST'
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.detail || body.message || `Transfer ${action} failed`);
      }
      await loadPrimaryData();
      if (action === 'dispatch' || action === 'receive') {
        await onPosted();
      }
      notify(`Transfer ${body.reference || id}: ${formatAuditLabel(body.status || action)}`);
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  // Cycle Count: Start New Session
  const handleCreateCycleCount = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    try {
      const targetWarehouseId = form.get('warehouseId') || selectedWarehouseId || null;
      const response = await apiFetch(`${API}/inventory/cycle-counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') || '').trim(),
          warehouseId: targetWarehouseId,
          notes: form.get('notes') ? String(form.get('notes')).trim() : null
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.detail || body.message || 'Could not start cycle count session');
      }
      setIsCountModalOpen(false);
      formElement.reset();
      await loadPrimaryData();
      if (body.id) {
        setExpandedSessions((prev) => ({ ...prev, [body.id]: true }));
      }
      notify(`Cycle count session "${body.name}" initialized`);
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  // Cycle Count: Save Line Count
  const saveLineCount = async (sessionId: string, lineId: string, quantity: number): Promise<void> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/inventory/cycle-counts/${sessionId}/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedQuantity: quantity })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.detail || body.message || 'Could not save line count');
      }
      setCycleCounts((prev) => prev.map((s) => (s.id === sessionId ? (body as CycleCountSession) : s)));
      notify('Physical count recorded');
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  // Cycle Count Lifecycle Actions (Submit, Approve, Cancel)
  const transitionCycleCount = async (sessionId: string, action: 'submit' | 'approve' | 'cancel'): Promise<void> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/inventory/cycle-counts/${sessionId}/${action}`, {
        method: 'POST'
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.detail || body.message || `Cycle count ${action} failed`);
      }
      await loadPrimaryData();
      if (action === 'approve') {
        await onPosted();
      }
      notify(`Cycle count: ${formatAuditLabel(body.status || action)}`);
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  // Telemetry Metrics
  const activeWarehouse = useMemo(
    () => warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0],
    [warehouses, selectedWarehouseId]
  );

  const selectedWarehouseOnHand = useMemo(
    () => balances.reduce((sum, b) => sum + (b.onHand || 0), 0),
    [balances]
  );

  const inTransitCount = useMemo(
    () => transfers.filter((t) => t.status === 'IN_TRANSIT').length,
    [transfers]
  );

  const pendingTransfersCount = useMemo(
    () => transfers.filter((t) => t.status === 'DRAFT' || t.status === 'APPROVED').length,
    [transfers]
  );

  const activeCountSessions = useMemo(
    () => cycleCounts.filter((c) => c.status === 'COUNTING' || c.status === 'REVIEW').length,
    [cycleCounts]
  );

  const postedCountSessions = useMemo(
    () => cycleCounts.filter((c) => c.status === 'POSTED').length,
    [cycleCounts]
  );

  // Filtered Data Sets
  const filteredBalances = useMemo(() => {
    let result = balances;
    if (stockSearchQuery.trim()) {
      const q = stockSearchQuery.toLowerCase().trim();
      result = result.filter(
        (b) => b.sku.toLowerCase().includes(q) || b.itemName.toLowerCase().includes(q)
      );
    }
    if (stockFilter === 'IN_STOCK') {
      result = result.filter((b) => b.availableQuantity > 0);
    } else if (stockFilter === 'LOW') {
      result = result.filter((b) => b.onHand <= 5);
    } else if (stockFilter === 'QC_HOLD') {
      result = result.filter((b) => b.qualityHoldQuantity > 0);
    }
    return result;
  }, [balances, stockSearchQuery, stockFilter]);

  const filteredTransfers = useMemo(() => {
    let result = transfers;
    if (transferSearchQuery.trim()) {
      const q = transferSearchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.reference.toLowerCase().includes(q) ||
          t.sku.toLowerCase().includes(q) ||
          t.itemName.toLowerCase().includes(q) ||
          t.sourceCode.toLowerCase().includes(q) ||
          t.destinationCode.toLowerCase().includes(q) ||
          t.reason.toLowerCase().includes(q)
      );
    }
    if (transferStatusFilter !== 'ALL') {
      result = result.filter((t) => t.status === transferStatusFilter);
    }
    return result;
  }, [transfers, transferSearchQuery, transferStatusFilter]);

  const filteredCycleCounts = useMemo(() => {
    let result = cycleCounts;
    if (cycleCountSearchQuery.trim()) {
      const q = cycleCountSearchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.warehouseCode.toLowerCase().includes(q) ||
          c.warehouseName.toLowerCase().includes(q) ||
          (c.notes && c.notes.toLowerCase().includes(q))
      );
    }
    if (cycleCountStatusFilter !== 'ALL') {
      result = result.filter((c) => c.status === cycleCountStatusFilter);
    }
    return result;
  }, [cycleCounts, cycleCountSearchQuery, cycleCountStatusFilter]);

  const filteredWarehouses = useMemo(() => {
    if (!facilitySearchQuery.trim()) return warehouses;
    const q = facilitySearchQuery.toLowerCase().trim();
    return warehouses.filter(
      (w) =>
        w.code.toLowerCase().includes(q) ||
        w.name.toLowerCase().includes(q) ||
        branches.find((b) => b.id === w.branchId)?.name.toLowerCase().includes(q)
    );
  }, [warehouses, branches, facilitySearchQuery]);

  // CSV Exporters
  const exportStockCsv = () => {
    const headers = ['SKU', 'Item Name', 'On Hand', 'Reserved', 'QC Hold', 'Available', 'Unit', 'Facility'];
    const rows = filteredBalances.map((b) => [
      b.sku,
      b.itemName,
      b.onHand,
      b.reservedQuantity,
      b.qualityHoldQuantity,
      b.availableQuantity,
      b.unit,
      activeWarehouse?.code || 'MAIN'
    ]);
    downloadCsv(
      `spindl-stock-${activeWarehouse?.code || 'location'}-${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
    notify('Location stock exported as CSV');
  };

  const exportTransfersCsv = () => {
    const headers = [
      'Reference',
      'SKU',
      'Item Name',
      'Source Hub',
      'Destination Hub',
      'Quantity',
      'Reason',
      'Status',
      'Created At'
    ];
    const rows = filteredTransfers.map((t) => [
      t.reference,
      t.sku,
      t.itemName,
      t.sourceCode,
      t.destinationCode,
      t.quantity,
      t.reason,
      t.status,
      new Date(t.createdAt).toLocaleString()
    ]);
    downloadCsv(`spindl-transfers-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    notify('Stock transfers exported as CSV');
  };

  const exportCycleCountsCsv = () => {
    const headers = ['Session Name', 'Warehouse', 'Status', 'Lines Count', 'Created By', 'Created At', 'Posted At'];
    const rows = filteredCycleCounts.map((c) => [
      c.name,
      `${c.warehouseCode} (${c.warehouseName})`,
      c.status,
      c.lines.length,
      c.createdBy,
      new Date(c.createdAt).toLocaleString(),
      c.postedAt ? new Date(c.postedAt).toLocaleString() : '—'
    ]);
    downloadCsv(`spindl-cycle-counts-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    notify('Cycle counts exported as CSV');
  };

  return (
    <div className="reports-screen-layout warehouse-screen-layout">
      {/* 1. Executive Telemetry Strip — Quiet Monochrome Linear Cards */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">FACILITIES & HUBS</span>
            <Building2 size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">{warehouses.length} Active</div>
          <div className="sales-metric-sub">
            Across {branches.length || 1} enterprise {branches.length === 1 ? 'branch' : 'branches'} · {activeWarehouse?.code || 'MAIN'} active
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">LOCATION ON-HAND</span>
            <Boxes size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">{selectedWarehouseOnHand.toLocaleString()} Units</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{balances.length} inventory balances</span> in {activeWarehouse?.name || 'Main Warehouse'}
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">INTER-FACILITY TRANSFERS</span>
            <ArrowLeftRight size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">{inTransitCount} In Transit</div>
          <div className="sales-metric-sub">
            {pendingTransfersCount > 0 ? (
              <span className="sales-sub-warning">{pendingTransfersCount} pending approval</span>
            ) : (
              'All transfers dispatched'
            )} · {transfers.length} movements
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">CYCLE COUNT AUDIT</span>
            <ClipboardCheck size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">
            {activeCountSessions > 0 ? `${activeCountSessions} In Progress` : '100% Reconciled'}
          </div>
          <div className="sales-metric-sub">
            {cycleCounts.length} count sessions · {postedCountSessions} posted audits
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'stock' ? 'active' : ''}`}
            onClick={() => setActiveTab('stock')}
          >
            <Boxes size={13} />
            <span>Location Stock</span>
            <span className="sales-subnav-badge">{balances.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'transfers' ? 'active' : ''}`}
            onClick={() => setActiveTab('transfers')}
          >
            <ArrowLeftRight size={13} />
            <span>Stock Transfers</span>
            <span className="sales-subnav-badge">{transfers.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'cycle-counts' ? 'active' : ''}`}
            onClick={() => setActiveTab('cycle-counts')}
          >
            <ClipboardCheck size={13} />
            <span>Cycle Counts</span>
            <span className="sales-subnav-badge">{cycleCounts.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'facilities' ? 'active' : ''}`}
            onClick={() => setActiveTab('facilities')}
          >
            <Building2 size={13} />
            <span>Facility Directory</span>
            <span className="sales-subnav-badge">{warehouses.length}</span>
          </button>
        </div>

        <div className="sales-subnav-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setRefreshIndex((k) => k + 1)}
            disabled={loading || saving}
            title="Refresh warehouse ledger"
            style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
          >
            <RefreshCw size={13} className={loading || saving ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {canManage && activeTab === 'facilities' && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsAddWarehouseOpen(true)}
              style={{ height: '30px', fontSize: '12.5px' }}
            >
              <Plus size={13} />
              <span>Add Facility</span>
            </button>
          )}

          {canManage && activeTab === 'cycle-counts' && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsCountModalOpen(true)}
              disabled={activeCountSessions > 0}
              title={activeCountSessions > 0 ? 'Finish current count session before starting another' : ''}
              style={{ height: '30px', fontSize: '12.5px' }}
            >
              <Plus size={13} />
              <span>Start Cycle Count</span>
            </button>
          )}

          {canManage && (activeTab === 'stock' || activeTab === 'transfers') && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setSourceWarehouseId(selectedWarehouseId || warehouses[0]?.id || '');
                setDestinationWarehouseId(warehouses.find((w) => w.id !== selectedWarehouseId)?.id || '');
                setIsTransferModalOpen(true);
              }}
              style={{ height: '30px', fontSize: '12.5px' }}
            >
              <ArrowLeftRight size={13} />
              <span>Request Transfer</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: LOCATION STOCK */}
      {activeTab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action and Filter Control Bar */}
          <div className="sales-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div className="warehouse-location-picker">
                <label htmlFor="warehouse-select" className="warehouse-picker-label">
                  <WarehouseIcon size={13} />
                  <span>Facility:</span>
                </label>
                <select
                  id="warehouse-select"
                  className="warehouse-select-input"
                  style={{ height: '28px', fontSize: '12px', padding: '0 8px' }}
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code}){w.isDefault ? ' — Primary Hub' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sales-pill-group">
                <button
                  type="button"
                  className={`sales-pill-btn ${stockFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setStockFilter('ALL')}
                >
                  <span>All Items</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${stockFilter === 'IN_STOCK' ? 'active' : ''}`}
                  onClick={() => setStockFilter('IN_STOCK')}
                >
                  <span>Available</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${stockFilter === 'LOW' ? 'active' : ''}`}
                  onClick={() => setStockFilter('LOW')}
                >
                  <span>Low (≤5)</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${stockFilter === 'QC_HOLD' ? 'active' : ''}`}
                  onClick={() => setStockFilter('QC_HOLD')}
                >
                  <span>QC Hold</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box">
                <Search size={13} className="sales-search-icon" />
                <input
                  type="text"
                  placeholder="Filter SKU or item name…"
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  className="sales-search-input"
                />
                {stockSearchQuery ? (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => setStockSearchQuery('')}
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
                onClick={exportStockCsv}
                disabled={filteredBalances.length === 0}
                style={{ height: '30px', fontSize: '12px' }}
                title="Export stock ledger as CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Stock Balances Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '32%' }}>ITEM & SKU</th>
                    <th style={{ width: '11%', textAlign: 'right' }}>ON HAND</th>
                    <th style={{ width: '11%', textAlign: 'right' }}>RESERVED</th>
                    <th style={{ width: '11%', textAlign: 'right' }}>QC HOLD</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>AVAILABLE</th>
                    <th style={{ width: '8%' }}>UNIT</th>
                    <th style={{ width: '15%' }}>AVAILABILITY</th>
                  </tr>
                </thead>
                <tbody>
                  {stockLoading ? (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        Loading inventory stock for {activeWarehouse?.name || 'facility'}…
                      </td>
                    </tr>
                  ) : filteredBalances.length > 0 ? (
                    filteredBalances.map((balance) => {
                      const isAvailable = balance.availableQuantity > 0;
                      const isQc = balance.qualityHoldQuantity > 0;
                      const isOutOfStock = balance.onHand === 0;

                      return (
                        <tr key={balance.itemId} className="sales-row">
                          <td style={{ maxWidth: '280px' }}>
                            <div><span className="sales-ref-badge">{balance.sku}</span></div>
                            <div className="production-subline" style={{ color: 'var(--sp-text-secondary)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '270px', marginTop: '2px' }}>
                              {balance.itemName}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                            <b>{balance.onHand.toLocaleString()}</b>
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: '12px',
                              color: balance.reservedQuantity > 0 ? 'var(--sp-warning)' : 'var(--sp-text-muted)'
                            }}
                          >
                            {balance.reservedQuantity.toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: '12px',
                              color: isQc ? 'var(--sp-danger)' : 'var(--sp-text-muted)'
                            }}
                          >
                            {balance.qualityHoldQuantity.toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: '12px',
                              color: isAvailable ? 'var(--sp-text)' : 'var(--sp-text-muted)'
                            }}
                          >
                            <b>{balance.availableQuantity.toLocaleString()}</b>
                          </td>
                          <td style={{ color: 'var(--sp-text-secondary)', fontSize: '12px' }}>{balance.unit}</td>
                          <td>
                            {isOutOfStock ? (
                              <Status label="Out of Stock" />
                            ) : isAvailable ? (
                              <Status label="In Stock" />
                            ) : (
                              <Status label="Reserved / QC" />
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        No inventory balances found matching criteria in {activeWarehouse?.name || 'this location'}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STOCK TRANSFERS */}
      {activeTab === 'transfers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action and Filter Control Bar */}
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${transferStatusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setTransferStatusFilter('ALL')}
              >
                <span>All</span>
                <span className="sales-pill-count">{transfers.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${transferStatusFilter === 'DRAFT' ? 'active' : ''}`}
                onClick={() => setTransferStatusFilter('DRAFT')}
              >
                <span>Draft</span>
                <span className="sales-pill-count">{transfers.filter((t) => t.status === 'DRAFT').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${transferStatusFilter === 'APPROVED' ? 'active' : ''}`}
                onClick={() => setTransferStatusFilter('APPROVED')}
              >
                <span>Approved</span>
                <span className="sales-pill-count">{transfers.filter((t) => t.status === 'APPROVED').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${transferStatusFilter === 'IN_TRANSIT' ? 'active' : ''}`}
                onClick={() => setTransferStatusFilter('IN_TRANSIT')}
              >
                <span>In Transit</span>
                <span className="sales-pill-count">{transfers.filter((t) => t.status === 'IN_TRANSIT').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${transferStatusFilter === 'COMPLETED' ? 'active' : ''}`}
                onClick={() => setTransferStatusFilter('COMPLETED')}
              >
                <span>Completed</span>
                <span className="sales-pill-count">{transfers.filter((t) => t.status === 'COMPLETED').length}</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box">
                <Search size={13} className="sales-search-icon" />
                <input
                  type="text"
                  placeholder="Filter reference, SKU, or route…"
                  value={transferSearchQuery}
                  onChange={(e) => setTransferSearchQuery(e.target.value)}
                  className="sales-search-input"
                />
                {transferSearchQuery ? (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => setTransferSearchQuery('')}
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
                onClick={exportTransfersCsv}
                disabled={filteredTransfers.length === 0}
                style={{ height: '30px', fontSize: '12px' }}
                title="Export transfers as CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Transfers Ledger Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '14%' }}>REFERENCE</th>
                    <th style={{ width: '27%' }}>ITEM & SKU</th>
                    <th style={{ width: '14%' }}>ROUTE</th>
                    <th style={{ width: '9%', textAlign: 'right' }}>QUANTITY</th>
                    <th style={{ width: '18%' }}>REASON</th>
                    <th style={{ width: '8%' }}>STATUS</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransfers.length > 0 ? (
                    filteredTransfers.map((transfer) => (
                      <tr key={transfer.id} className="sales-row">
                        <td>
                          <span className="sales-ref-badge">{transfer.reference}</span>
                        </td>
                        <td style={{ maxWidth: '240px' }}>
                          <div><span className="sales-ref-badge">{transfer.sku}</span></div>
                          <div className="production-subline" style={{ color: 'var(--sp-text-secondary)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '230px', marginTop: '2px' }}>
                            {transfer.itemName}
                          </div>
                        </td>
                        <td>
                          <span className="route-tag">
                            {transfer.sourceCode} <span className="route-arrow">→</span> {transfer.destinationCode}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                          <b>{transfer.quantity.toLocaleString()}</b>
                        </td>
                        <td style={{ color: 'var(--sp-text-secondary)', maxWidth: '200px' }} title={transfer.reason}>
                          <span className="truncate-text" style={{ maxWidth: '190px', fontSize: '11.5px' }}>{transfer.reason}</span>
                        </td>
                        <td>
                          <Status label={formatAuditLabel(transfer.status)} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            {transfer.status === 'DRAFT' && canManage && (
                              <button
                                type="button"
                                className="mini-action"
                                disabled={saving}
                                onClick={() => transitionTransfer(transfer.id, 'approve')}
                                style={{ height: '24px', padding: '0 7px', fontSize: '11px' }}
                              >
                                Approve
                              </button>
                            )}
                            {transfer.status === 'APPROVED' && canManage && (
                              <button
                                type="button"
                                className="mini-action"
                                disabled={saving}
                                onClick={() => transitionTransfer(transfer.id, 'dispatch')}
                                style={{ height: '24px', padding: '0 7px', fontSize: '11px' }}
                              >
                                Dispatch
                              </button>
                            )}
                            {transfer.status === 'IN_TRANSIT' && canManage && (
                              <button
                                type="button"
                                className="mini-action"
                                disabled={saving}
                                onClick={() => transitionTransfer(transfer.id, 'receive')}
                                style={{ height: '24px', padding: '0 7px', fontSize: '11px' }}
                              >
                                Receive
                              </button>
                            )}
                            {['DRAFT', 'APPROVED'].includes(transfer.status) && canManage && (
                              <button
                                type="button"
                                className="mini-action muted"
                                disabled={saving}
                                onClick={() => transitionTransfer(transfer.id, 'cancel')}
                                style={{ height: '24px', padding: '0 7px', fontSize: '11px' }}
                              >
                                Cancel
                              </button>
                            )}
                            {['COMPLETED', 'CANCELLED'].includes(transfer.status) && (
                              <span className="meta-text" style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                                {transfer.status === 'COMPLETED' ? 'Settled' : 'Void'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        No stock transfer requests recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CYCLE COUNTS */}
      {activeTab === 'cycle-counts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action and Filter Control Bar */}
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${cycleCountStatusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setCycleCountStatusFilter('ALL')}
              >
                <span>All</span>
                <span className="sales-pill-count">{cycleCounts.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${cycleCountStatusFilter === 'COUNTING' ? 'active' : ''}`}
                onClick={() => setCycleCountStatusFilter('COUNTING')}
              >
                <span>Counting</span>
                <span className="sales-pill-count">{cycleCounts.filter((c) => c.status === 'COUNTING').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${cycleCountStatusFilter === 'REVIEW' ? 'active' : ''}`}
                onClick={() => setCycleCountStatusFilter('REVIEW')}
              >
                <span>Review</span>
                <span className="sales-pill-count">{cycleCounts.filter((c) => c.status === 'REVIEW').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${cycleCountStatusFilter === 'POSTED' ? 'active' : ''}`}
                onClick={() => setCycleCountStatusFilter('POSTED')}
              >
                <span>Posted</span>
                <span className="sales-pill-count">{cycleCounts.filter((c) => c.status === 'POSTED').length}</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box">
                <Search size={13} className="sales-search-icon" />
                <input
                  type="text"
                  placeholder="Filter session, facility, notes…"
                  value={cycleCountSearchQuery}
                  onChange={(e) => setCycleCountSearchQuery(e.target.value)}
                  className="sales-search-input"
                />
                {cycleCountSearchQuery ? (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => setCycleCountSearchQuery('')}
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
                onClick={exportCycleCountsCsv}
                disabled={filteredCycleCounts.length === 0}
                style={{ height: '30px', fontSize: '12px' }}
                title="Export cycle counts as CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Active / Open Session Alert Strip */}
          {activeCountSessions > 0 && (
            <div className="warehouse-active-banner">
              <ClipboardCheck size={16} className="warehouse-active-icon" />
              <div className="warehouse-active-content">
                <b>Active Physical Count in Progress</b>
                <span>
                  Physical verification is currently open. Complete counting on line items below before submitting for review and ledger posting.
                </span>
              </div>
            </div>
          )}

          {/* Sessions List */}
          {filteredCycleCounts.length > 0 ? (
            filteredCycleCounts.map((session) => {
              const isExpanded = !!expandedSessions[session.id];
              const countedLinesCount = session.lines.filter((l) => l.countedQuantity != null).length;
              const allLinesCounted = countedLinesCount === session.lines.length;

              return (
                <div key={session.id} className="warehouse-cycle-card">
                  {/* Session Header */}
                  <div
                    className="warehouse-cycle-header"
                    onClick={() =>
                      setExpandedSessions((prev) => ({ ...prev, [session.id]: !prev[session.id] }))
                    }
                  >
                    <div className="warehouse-cycle-meta">
                      <div className="warehouse-cycle-title-row">
                        <span className="warehouse-cycle-name">{session.name}</span>
                        <span className="warehouse-facility-badge">{session.warehouseName} ({session.warehouseCode})</span>
                        <Status label={session.status} />
                      </div>
                      <div className="warehouse-cycle-subtext">
                        <span>{session.lines.length} catalog items</span>
                        <span>·</span>
                        <span>{countedLinesCount} of {session.lines.length} recorded</span>
                        <span>·</span>
                        <span>Created {new Date(session.createdAt).toLocaleDateString()}</span>
                        {session.postedAt && (
                          <>
                            <span>·</span>
                            <span>Posted {new Date(session.postedAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="warehouse-expand-btn"
                      aria-label={isExpanded ? 'Collapse session' : 'Expand session'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Expanded Body */}
                  {isExpanded && (
                    <div className="warehouse-cycle-body">
                      {session.notes && (
                        <div className="reports-note-box" style={{ margin: '0 0 12px' }}>
                          <b>Audit Scope / Notes:</b> {session.notes}
                        </div>
                      )}

                      {/* Line Items Table */}
                      <div className="sales-table-card" style={{ marginTop: '12px' }}>
                        <div className="sales-table-scroll">
                          <table className="sales-table">
                            <thead>
                              <tr>
                                <th style={{ width: '32%' }}>ITEM & SKU</th>
                                <th style={{ width: '18%', textAlign: 'right' }}>SYSTEM RECORD</th>
                                <th style={{ width: '24%', textAlign: 'right' }}>PHYSICAL COUNT</th>
                                <th style={{ width: '16%', textAlign: 'right' }}>VARIANCE</th>
                                {session.status === 'COUNTING' && <th style={{ width: '10%', textAlign: 'right' }}>ACTIONS</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {session.lines.map((line) => {
                                const inputVal =
                                  lineInputs[line.id] !== undefined
                                    ? lineInputs[line.id]
                                    : line.countedQuantity ?? '';

                                const currentVariance =
                                  line.countedQuantity != null
                                    ? line.countedQuantity - line.systemQuantity
                                    : null;

                                return (
                                  <tr key={line.id} className="sales-row">
                                    <td style={{ maxWidth: '240px' }}>
                                      <div><span className="sales-ref-badge">{line.sku}</span></div>
                                      <div className="production-subline" style={{ color: 'var(--sp-text-secondary)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '230px', marginTop: '2px' }}>
                                        {line.itemName}
                                      </div>
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                                      {line.systemQuantity.toLocaleString()} {line.unit}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      {session.status === 'COUNTING' ? (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                          <input
                                            type="number"
                                            min="0"
                                            value={inputVal}
                                            onChange={(e) =>
                                              setLineInputs((prev) => ({
                                                ...prev,
                                                [line.id]: e.target.value
                                              }))
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const qty = Number(inputVal);
                                                if (!isNaN(qty) && qty >= 0) {
                                                  saveLineCount(session.id, line.id, qty);
                                                }
                                              }
                                            }}
                                            placeholder="Enter count"
                                            className="warehouse-count-input"
                                            style={{ height: '26px', fontSize: '12px' }}
                                          />
                                          <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                                            {line.unit}
                                          </span>
                                        </div>
                                      ) : (
                                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, fontSize: '12px' }}>
                                          {line.countedQuantity != null
                                            ? `${line.countedQuantity.toLocaleString()} ${line.unit}`
                                            : '—'}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                                      {currentVariance == null ? (
                                        <span style={{ color: 'var(--sp-text-muted)' }}>—</span>
                                      ) : currentVariance === 0 ? (
                                        <span style={{ color: 'var(--sp-success)', fontWeight: 500 }}>0 (Exact)</span>
                                      ) : currentVariance > 0 ? (
                                        <span style={{ color: 'var(--sp-info)', fontWeight: 500 }}>
                                          +{currentVariance.toLocaleString()}
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--sp-danger)', fontWeight: 500 }}>
                                          {currentVariance.toLocaleString()}
                                        </span>
                                      )}
                                    </td>
                                    {session.status === 'COUNTING' && (
                                      <td style={{ textAlign: 'right' }}>
                                        <button
                                          type="button"
                                          className="mini-action"
                                          disabled={saving || inputVal === '' || isNaN(Number(inputVal))}
                                          onClick={() => {
                                            const qty = Number(inputVal);
                                            if (!isNaN(qty) && qty >= 0) {
                                              saveLineCount(session.id, line.id, qty);
                                            }
                                          }}
                                          style={{ height: '24px', padding: '0 8px', fontSize: '11.5px' }}
                                        >
                                          Save
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="warehouse-cycle-actions">
                        {session.status === 'COUNTING' && (
                          <>
                            <button
                              type="button"
                              className="button button-primary"
                              disabled={saving || !allLinesCounted}
                              onClick={() => transitionCycleCount(session.id, 'submit')}
                              style={{ height: '30px', fontSize: '12px' }}
                            >
                              Submit for Review ({countedLinesCount}/{session.lines.length} recorded)
                            </button>
                            <button
                              type="button"
                              className="mini-action muted"
                              disabled={saving}
                              onClick={() => transitionCycleCount(session.id, 'cancel')}
                            >
                              Cancel Session
                            </button>
                          </>
                        )}

                        {session.status === 'REVIEW' && canManage && (
                          <>
                            <button
                              type="button"
                              className="button button-primary"
                              disabled={saving}
                              onClick={() => transitionCycleCount(session.id, 'approve')}
                              style={{ height: '30px', fontSize: '12px' }}
                            >
                              Approve & Post Variances to Ledger
                            </button>
                            <button
                              type="button"
                              className="mini-action muted"
                              disabled={saving}
                              onClick={() => transitionCycleCount(session.id, 'cancel')}
                            >
                              Cancel Session
                            </button>
                          </>
                        )}

                        {session.status === 'POSTED' && (
                          <div style={{ fontSize: '12px', color: 'var(--sp-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={13} color="var(--sp-success)" />
                            <span>Variances permanently applied to perpetual inventory on {new Date(session.postedAt || session.createdAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="panel directory-panel" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--sp-text-muted)' }}>
              No cycle count sessions found matching criteria.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FACILITY DIRECTORY */}
      {activeTab === 'facilities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action and Filter Control Bar */}
          <div className="sales-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--sp-text-secondary)', fontWeight: 500 }}>
                {warehouses.length} {warehouses.length === 1 ? 'Facility' : 'Facilities'} across {branches.length || 1} enterprise branch
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box">
                <Search size={13} className="sales-search-icon" />
                <input
                  type="text"
                  placeholder="Filter code, name, branch…"
                  value={facilitySearchQuery}
                  onChange={(e) => setFacilitySearchQuery(e.target.value)}
                  className="sales-search-input"
                />
                {facilitySearchQuery ? (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => setFacilitySearchQuery('')}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <span className="sales-search-kbd">/</span>
                )}
              </div>
            </div>
          </div>

          {/* Facilities Directory Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '14%' }}>LOCATION CODE</th>
                    <th style={{ width: '28%' }}>FACILITY NAME</th>
                    <th style={{ width: '26%' }}>WORKSPACE BRANCH</th>
                    <th style={{ width: '18%' }}>ROLE & STATUS</th>
                    <th style={{ width: '14%', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWarehouses.length > 0 ? (
                    filteredWarehouses.map((wh) => {
                      const branch = branches.find((b) => b.id === wh.branchId);

                      return (
                        <tr key={wh.id} className="sales-row">
                          <td>
                            <span className="facility-code-pill">{wh.code}</span>
                          </td>
                          <td>
                            <b style={{ color: 'var(--sp-text)', fontSize: '12.5px' }}>{wh.name}</b>
                          </td>
                          <td style={{ color: 'var(--sp-text-secondary)', fontSize: '12px' }}>
                            {branch ? branch.name : 'Primary Organization Branch'}
                          </td>
                          <td>
                            {wh.isDefault ? (
                              <span className="default-hub-badge">Primary Hub</span>
                            ) : (
                              <span className="secondary-hub-badge">Regional Depot</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="mini-action"
                              onClick={() => {
                                setSelectedWarehouseId(wh.id);
                                setActiveTab('stock');
                              }}
                              style={{ height: '24px', padding: '0 8px', fontSize: '11.5px' }}
                            >
                              View Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty-cell">
                        No warehouse facilities found matching query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODALS */}

      {/* MODAL 1: ADD WAREHOUSE */}
      {isAddWarehouseOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddWarehouseOpen(false)}>
          <div className="record-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>New Warehouse Location</h2>
                <p>Register a physical storage warehouse, production depot, or workshop.</p>
              </div>
              <button type="button" onClick={() => setIsAddWarehouseOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label>
                Location code
                <input
                  name="code"
                  required
                  maxLength={32}
                  placeholder="e.g. EAST-01"
                  autoFocus
                  style={{ textTransform: 'uppercase' }}
                />
              </label>

              <label>
                Warehouse facility name
                <input
                  name="name"
                  required
                  maxLength={120}
                  placeholder="e.g. East Distribution Workshop"
                />
              </label>

              {branches.length > 0 && (
                <label>
                  Workspace branch
                  <select name="branchId" defaultValue={branches[0].id}>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="reports-note-box" style={{ margin: 0, fontSize: '11.5px' }}>
                New locations immediately receive zero-balance stock positions for all active catalog items, ready for incoming shipments or transfers.
              </div>

              <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsAddWarehouseOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving}
                >
                  {saving ? 'Creating…' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REQUEST STOCK TRANSFER */}
      {isTransferModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsTransferModalOpen(false)}>
          <div className="record-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>Request Stock Transfer</h2>
                <p>Move inventory between warehouses. Outbound ledger entry is created upon dispatch.</p>
              </div>
              <button type="button" onClick={() => setIsTransferModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label>
                Item to transfer
                <select name="itemId" required defaultValue="">
                  <option value="" disabled>
                    Choose catalog item…
                  </option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} · {item.name} ({item.stock} {item.unit} available)
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Source facility
                  <select
                    value={sourceWarehouseId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSourceWarehouseId(id);
                      if (id === destinationWarehouseId) {
                        setDestinationWarehouseId(warehouses.find((w) => w.id !== id)?.id || '');
                      }
                    }}
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Destination facility
                  <select
                    value={destinationWarehouseId}
                    onChange={(e) => setDestinationWarehouseId(e.target.value)}
                    required
                  >
                    {warehouses
                      .filter((w) => w.id !== sourceWarehouseId)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <label>
                Quantity to move
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 50"
                />
              </label>

              <label>
                Transfer reason
                <input
                  name="reason"
                  maxLength={240}
                  required
                  placeholder="e.g. Replenish inventory for scheduled production run"
                />
              </label>

              <div className="reports-note-box" style={{ margin: 0, fontSize: '11.5px' }}>
                Requested quantities are reserved at the source immediately. Approval and dispatch create the outbound ledger entry; receipt completes the inbound leg.
              </div>

              <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving || warehouses.length < 2 || !destinationWarehouseId}
                >
                  {saving ? 'Submitting…' : 'Submit Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: START CYCLE COUNT */}
      {isCountModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCountModalOpen(false)}>
          <div className="record-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <h2>Start Cycle Count Session</h2>
                <p>Initialize a physical stock count session for a specific warehouse location.</p>
              </div>
              <button type="button" onClick={() => setIsCountModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCycleCount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label>
                Session name
                <input
                  name="name"
                  required
                  maxLength={120}
                  placeholder="e.g. Q4 Physical Stock Count"
                  autoFocus
                />
              </label>

              <label>
                Target warehouse location
                <select name="warehouseId" defaultValue={selectedWarehouseId || warehouses[0]?.id} required>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Scope & instructions
                <input
                  name="notes"
                  maxLength={500}
                  placeholder="Optional audit scope or instructions (e.g. Racks A1-B4)"
                />
              </label>

              <div className="reports-note-box" style={{ margin: 0, fontSize: '11.5px' }}>
                Only one active cycle count can be in progress at a time. The session freezes a snapshot of current system quantities across all active catalog items.
              </div>

              <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsCountModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving}
                >
                  {saving ? 'Starting…' : 'Start Count Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
