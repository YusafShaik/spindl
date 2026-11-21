import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  Building2,
  Download,
  Plus,
  RefreshCw,
  Search,
  Warehouse as WarehouseIcon,
  X
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';
import type { TenantBranchSummary } from '../../types/crm';
import type {
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

type WarehouseSubTab = 'stock' | 'transfers' | 'facilities';

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

  // Selection & UI Filters
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW' | 'QC_HOLD'>('ALL');

  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [transferStatusFilter, setTransferStatusFilter] = useState<string>('ALL');

  const [facilitySearchQuery, setFacilitySearchQuery] = useState('');

  // Modals & Action Forms
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Transfer Form State
  const [transferItemId, setTransferItemId] = useState('');
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

  // Primary Data Fetch: Warehouses and Transfers
  const loadPrimaryData = async (): Promise<void> => {
    const [whRes, trRes] = await Promise.all([
      apiFetch(`${API}/inventory/warehouses`),
      apiFetch(`${API}/inventory/transfers`)
    ]);

    if (!whRes.ok || !trRes.ok) {
      throw new Error('Could not load inventory warehouse and movement data');
    }

    const whData: WarehouseSummary[] = await whRes.json();
    const trData: InventoryTransfer[] = await trRes.json();

    setWarehouses(whData);
    setTransfers(trData);

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
      notify(`Warehouse facility ${body.name} (${body.code}) registered successfully`);
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
          itemId: transferItemId || form.get('itemId'),
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

  const totalQcHold = useMemo(
    () => balances.reduce((sum, b) => sum + (b.qualityHoldQuantity || 0), 0),
    [balances]
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
      result = result.filter((b) => b.onHand <= 5 && b.onHand > 0);
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

  return (
    <div className="sales-screen-layout">
      {/* 1. Executive Telemetry Strip — Simple Monochrome Linear Architecture */}
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
            {balances.length} inventory positions in {activeWarehouse?.name || 'Main Warehouse'}
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
              <span style={{ color: 'var(--sp-warning, #d97706)' }}>
                {pendingTransfersCount} pending approval
              </span>
            ) : (
              'All transfers dispatched'
            )}{' '}
            · {transfers.length} movements
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">QC & STAGING HOLD</span>
            <AlertTriangle size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">
            {totalQcHold > 0 ? `${totalQcHold.toLocaleString()} Units` : 'Clear (0)'}
          </div>
          <div className="sales-metric-sub">
            {totalQcHold > 0 ? 'Awaiting quality inspection' : 'All warehouse stock released'}
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
            className={`sales-subnav-tab ${activeTab === 'facilities' ? 'active' : ''}`}
            onClick={() => setActiveTab('facilities')}
          >
            <Building2 size={13} />
            <span>Facility Directory</span>
            <span className="sales-subnav-badge">{warehouses.length}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setRefreshIndex((k) => k + 1)}
            disabled={loading || saving}
            title="Refresh warehouse data"
            style={{ height: '30px', fontSize: '12px' }}
          >
            <RefreshCw size={12} className={loading || saving ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {canManage && activeTab === 'facilities' && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsAddWarehouseOpen(true)}
              style={{ height: '30px', fontSize: '12.5px' }}
            >
              <Plus size={12} />
              <span>Add Facility</span>
            </button>
          )}

          {canManage && (activeTab === 'stock' || activeTab === 'transfers') && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setTransferItemId(items[0]?.id || '');
                setSourceWarehouseId(selectedWarehouseId || warehouses[0]?.id || '');
                setDestinationWarehouseId(warehouses.find((w) => w.id !== selectedWarehouseId)?.id || '');
                setIsTransferModalOpen(true);
              }}
              style={{ height: '30px', fontSize: '12.5px' }}
            >
              <ArrowLeftRight size={12} />
              <span>Request Transfer</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Sub-Tab Content Views */}

      {/* TAB 1: LOCATION STOCK */}
      {activeTab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Simple, Clean Single-Row Toolbar */}
          <div className="sales-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Facility Selector */}
              <select
                className="sales-filter-select"
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                style={{
                  height: '32px',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '0 28px 0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--sp-border)',
                  background: 'var(--sp-surface)',
                  color: 'var(--sp-text)'
                }}
                aria-label="Select Warehouse Facility"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code}){w.isDefault ? ' — Primary Hub' : ''}
                  </option>
                ))}
              </select>

              {/* Status Filter Pills */}
              <div className="sales-pill-group">
                <button
                  type="button"
                  className={`sales-pill-btn ${stockFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setStockFilter('ALL')}
                >
                  All <span className="sales-pill-count">{balances.length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${stockFilter === 'IN_STOCK' ? 'active' : ''}`}
                  onClick={() => setStockFilter('IN_STOCK')}
                >
                  In Stock <span className="sales-pill-count">{balances.filter((b) => b.availableQuantity > 0).length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${stockFilter === 'LOW' ? 'active' : ''}`}
                  onClick={() => setStockFilter('LOW')}
                >
                  Low Stock{' '}
                  {balances.some((b) => b.onHand <= 5 && b.onHand > 0) && (
                    <span className="sales-pill-count" style={{ color: '#d97706' }}>
                      {balances.filter((b) => b.onHand <= 5 && b.onHand > 0).length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${stockFilter === 'QC_HOLD' ? 'active' : ''}`}
                  onClick={() => setStockFilter('QC_HOLD')}
                >
                  QC Hold{' '}
                  {balances.some((b) => b.qualityHoldQuantity > 0) && (
                    <span className="sales-pill-count" style={{ color: '#ef4444' }}>
                      {balances.filter((b) => b.qualityHoldQuantity > 0).length}
                    </span>
                  )}
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
                style={{ height: '32px', fontSize: '12px' }}
                title="Export stock ledger as CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Clean Stock Balances Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '34%' }}>ITEM & SKU</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>ON HAND</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>RESERVED</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>QC HOLD</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>AVAILABLE</th>
                    <th style={{ width: '6%' }}>UNIT</th>
                    <th style={{ width: '12%' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {stockLoading ? (
                    <tr>
                      <td colSpan={7} className="empty-cell" style={{ padding: '32px 0' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <RefreshCw size={16} className="spin" style={{ color: 'var(--sp-text-muted)' }} />
                          <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                            Loading stock positions for {activeWarehouse?.name || 'facility'}…
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredBalances.length > 0 ? (
                    filteredBalances.map((balance) => {
                      const isOutOfStock = balance.onHand === 0;
                      const isLow = balance.onHand > 0 && balance.onHand <= 5;
                      const isQc = balance.qualityHoldQuantity > 0;

                      return (
                        <tr key={balance.itemId} className="sales-row">
                          <td>
                            <div>
                              <span className="sales-ref-badge">{balance.sku}</span>
                            </div>
                            <div
                              style={{
                                color: 'var(--sp-text-secondary)',
                                fontSize: '11.5px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '280px',
                                marginTop: '2px'
                              }}
                              title={balance.itemName}
                            >
                              {balance.itemName}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px', fontWeight: 600 }}>
                            {balance.onHand.toLocaleString()}
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
                              fontWeight: 600,
                              color: balance.availableQuantity > 0 ? 'var(--sp-text)' : 'var(--sp-text-muted)'
                            }}
                          >
                            {balance.availableQuantity.toLocaleString()}
                          </td>
                          <td style={{ color: 'var(--sp-text-secondary)', fontSize: '12px' }}>{balance.unit}</td>
                          <td>
                            <Status
                              label={
                                isOutOfStock
                                  ? 'Out of Stock'
                                  : isQc
                                  ? 'On Hold'
                                  : isLow
                                  ? 'Low Stock'
                                  : 'In Stock'
                              }
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        No inventory positions found matching criteria in {activeWarehouse?.name || 'this location'}.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Simple, Clean Single-Row Toolbar */}
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${transferStatusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setTransferStatusFilter('ALL')}
              >
                All <span className="sales-pill-count">{transfers.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${transferStatusFilter === 'DRAFT' ? 'active' : ''}`}
                onClick={() => setTransferStatusFilter('DRAFT')}
              >
                Draft <span className="sales-pill-count">{transfers.filter((t) => t.status === 'DRAFT').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${transferStatusFilter === 'APPROVED' ? 'active' : ''}`}
                onClick={() => setTransferStatusFilter('APPROVED')}
              >
                Approved <span className="sales-pill-count">{transfers.filter((t) => t.status === 'APPROVED').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${transferStatusFilter === 'IN_TRANSIT' ? 'active' : ''}`}
                onClick={() => setTransferStatusFilter('IN_TRANSIT')}
              >
                In Transit <span className="sales-pill-count">{transfers.filter((t) => t.status === 'IN_TRANSIT').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${transferStatusFilter === 'COMPLETED' ? 'active' : ''}`}
                onClick={() => setTransferStatusFilter('COMPLETED')}
              >
                Completed <span className="sales-pill-count">{transfers.filter((t) => t.status === 'COMPLETED').length}</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box">
                <Search size={13} className="sales-search-icon" />
                <input
                  type="text"
                  placeholder="Filter reference, SKU, route…"
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
                style={{ height: '32px', fontSize: '12px' }}
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
                    <th style={{ width: '26%' }}>ITEM & SKU</th>
                    <th style={{ width: '15%' }}>ROUTE</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>QUANTITY</th>
                    <th style={{ width: '17%' }}>REASON</th>
                    <th style={{ width: '10%' }}>STATUS</th>
                    <th style={{ width: '8%', textAlign: 'right' }}>ACTION</th>
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
                          <div>
                            <span className="sales-ref-badge">{transfer.sku}</span>
                          </div>
                          <div
                            style={{
                              color: 'var(--sp-text-secondary)',
                              fontSize: '11.5px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '230px',
                              marginTop: '2px'
                            }}
                            title={transfer.itemName}
                          >
                            {transfer.itemName}
                          </div>
                        </td>
                        <td>
                          <span className="route-tag">
                            {transfer.sourceCode} <span className="route-arrow">→</span> {transfer.destinationCode}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px', fontWeight: 600 }}>
                          {transfer.quantity.toLocaleString()}
                        </td>
                        <td style={{ color: 'var(--sp-text-secondary)', maxWidth: '180px' }} title={transfer.reason}>
                          <span className="truncate-text" style={{ maxWidth: '170px', fontSize: '11.5px' }}>
                            {transfer.reason}
                          </span>
                        </td>
                        <td>
                          <Status label={transfer.status.replace('_', ' ')} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            {transfer.status === 'DRAFT' && canManage && (
                              <button
                                type="button"
                                className="button button-secondary"
                                disabled={saving}
                                onClick={() => transitionTransfer(transfer.id, 'approve')}
                                style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                              >
                                Approve
                              </button>
                            )}
                            {transfer.status === 'APPROVED' && canManage && (
                              <button
                                type="button"
                                className="button button-primary"
                                disabled={saving}
                                onClick={() => transitionTransfer(transfer.id, 'dispatch')}
                                style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                              >
                                Dispatch
                              </button>
                            )}
                            {transfer.status === 'IN_TRANSIT' && canManage && (
                              <button
                                type="button"
                                className="button button-primary"
                                disabled={saving}
                                onClick={() => transitionTransfer(transfer.id, 'receive')}
                                style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                              >
                                Receive
                              </button>
                            )}
                            {['DRAFT', 'APPROVED'].includes(transfer.status) && canManage && (
                              <button
                                type="button"
                                className="button button-secondary"
                                disabled={saving}
                                onClick={() => transitionTransfer(transfer.id, 'cancel')}
                                style={{ height: '24px', padding: '0 6px', fontSize: '11px', color: 'var(--sp-danger)' }}
                                title="Cancel transfer"
                              >
                                Cancel
                              </button>
                            )}
                            {['COMPLETED', 'CANCELLED'].includes(transfer.status) && (
                              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
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

      {/* TAB 3: FACILITY DIRECTORY */}
      {activeTab === 'facilities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Simple, Clean Single-Row Toolbar */}
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
                    <th style={{ width: '15%' }}>LOCATION CODE</th>
                    <th style={{ width: '30%' }}>FACILITY NAME</th>
                    <th style={{ width: '25%' }}>WORKSPACE BRANCH</th>
                    <th style={{ width: '18%' }}>STATUS & ROLE</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>ACTION</th>
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
                            <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                              {wh.name}
                            </span>
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
                              className="button button-secondary"
                              onClick={() => {
                                setSelectedWarehouseId(wh.id);
                                setActiveTab('stock');
                              }}
                              style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
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
          <div className="record-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, 95vw)' }}>
            <div className="modal-title">
              <div>
                <h2>New Warehouse Location</h2>
                <p>Register a physical storage warehouse, production depot, or workshop.</p>
              </div>
              <button type="button" onClick={() => setIsAddWarehouseOpen(false)} aria-label="Close dialog">
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
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
          <div className="record-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(500px, 95vw)' }}>
            <div className="modal-title">
              <div>
                <h2>Request Stock Transfer</h2>
                <p>Move inventory between warehouses. Outbound ledger entry is created upon dispatch.</p>
              </div>
              <button type="button" onClick={() => setIsTransferModalOpen(false)} aria-label="Close dialog">
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
              <label>
                Item to transfer
                <select
                  name="itemId"
                  required
                  value={transferItemId}
                  onChange={(e) => setTransferItemId(e.target.value)}
                >
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
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
    </div>
  );
}
