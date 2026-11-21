import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  ClipboardCheck,
  Download,
  Filter,
  History,
  IndianRupee,
  Package,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { CustomFieldEditor } from '../customers/CustomFieldEditor';
import { InventoryCycleCountPanel } from './InventoryCycleCountPanel';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency, formatCompactRupees } from '../../lib/utils/currency';
import type {
  InventoryMovement,
  InventoryMovementPage,
  ItemSummary,
} from '../../types/inventory';

type InventoryTab = 'stock' | 'movements' | 'counts';
type CategoryFilter = 'ALL' | 'RAW' | 'WIP' | 'FINISHED' | 'LOW_STOCK';

interface MovementPagination {
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

interface InventoryPanelProps {
  data: ItemSummary[];
  allItems: ItemSummary[];
  movements?: InventoryMovement[];
  query: string;
  setQuery: (query: string) => void;
  notify: (message: string) => void;
  role?: string;
  onAdjust: (item: ItemSummary) => void;
  onThreshold: (item: ItemSummary) => void;
  onRefresh: () => Promise<void>;
}

export function InventoryPanel({
  data,
  allItems,
  movements = [],
  query,
  setQuery,
  notify,
  role,
  onAdjust,
  onThreshold,
  onRefresh,
}: InventoryPanelProps) {
  const [activeTab, setActiveTab] = useState<InventoryTab>('stock');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');

  // Movement Ledger state
  const [movementRows, setMovementRows] = useState<InventoryMovement[]>([]);
  const [movementPage, setMovementPage] = useState<MovementPagination>({
    page: 0,
    pageSize: 20,
    totalElements: 0,
    totalPages: 0,
  });
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementExporting, setMovementExporting] = useState(false);
  const [movementSearch, setMovementSearch] = useState('');
  const [movementFrom, setMovementFrom] = useState('');
  const [movementTo, setMovementTo] = useState('');
  const [movementItemId, setMovementItemId] = useState('');

  // Top metric calculations
  const itemUnitMap = useMemo(() => new Map(allItems.map((i) => [i.id, i.unit])), [allItems]);
  const totalUnitsOnHand = useMemo(
    () => allItems.reduce((sum, item) => sum + Number(item.stock || 0), 0),
    [allItems]
  );
  const lowStockItems = useMemo(
    () => allItems.filter((item) => Number(item.available) <= Number(item.lowStockThreshold)),
    [allItems]
  );
  const lowStockCount = lowStockItems.length;

  const totalValuation = useMemo(
    () => allItems.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.unitPrice || 0), 0),
    [allItems]
  );

  // Category counts
  const categoryCounts = useMemo(() => {
    let raw = 0;
    let wip = 0;
    let finished = 0;
    for (const item of allItems) {
      if (item.itemType === 'RAW') raw++;
      else if (item.itemType === 'WIP') wip++;
      else if (item.itemType === 'FINISHED') finished++;
    }
    return { all: allItems.length, raw, wip, finished, lowStock: lowStockCount };
  }, [allItems, lowStockCount]);

  // Filtered items in Stock Overview tab
  const filteredStockItems = useMemo(() => {
    return data.filter((item) => {
      if (categoryFilter === 'RAW' && item.itemType !== 'RAW') return false;
      if (categoryFilter === 'WIP' && item.itemType !== 'WIP') return false;
      if (categoryFilter === 'FINISHED' && item.itemType !== 'FINISHED') return false;
      if (categoryFilter === 'LOW_STOCK' && Number(item.available) > Number(item.lowStockThreshold)) return false;
      return true;
    });
  }, [data, categoryFilter]);

  // Fetch movements when Movement Ledger tab is active or filters change
  useEffect(() => {
    if (activeTab !== 'movements') return;
    let current = true;
    setMovementLoading(true);

    const params = new URLSearchParams({
      page: String(movementPage.page),
      size: '20',
    });
    if (movementSearch.trim()) params.set('q', movementSearch.trim());
    if (movementFrom) params.set('from', movementFrom);
    if (movementTo) params.set('to', movementTo);
    if (movementItemId) params.set('itemId', movementItemId);

    apiFetch(`${API}/inventory/movements/search?${params}`)
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error('Could not load movement history'))
      )
      .then((result: InventoryMovementPage) => {
        if (current) {
          setMovementRows(result.items);
          setMovementPage((p) => ({
            ...p,
            page: result.page,
            pageSize: result.pageSize,
            totalElements: result.totalElements,
            totalPages: result.totalPages,
          }));
        }
      })
      .catch((error: unknown) => {
        if (current) console.error(error);
      })
      .finally(() => {
        if (current) setMovementLoading(false);
      });

    return () => {
      current = false;
    };
  }, [activeTab, movementPage.page, movementSearch, movementFrom, movementTo, movementItemId, movements]);

  // Export movement ledger
  const exportLedger = async () => {
    setMovementExporting(true);
    try {
      const params = new URLSearchParams();
      if (movementSearch.trim()) params.set('q', movementSearch.trim());
      if (movementFrom) params.set('from', movementFrom);
      if (movementTo) params.set('to', movementTo);
      if (movementItemId) params.set('itemId', movementItemId);

      const response = await apiFetch(`${API}/inventory/movements/export?${params}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || body.message || 'Could not export movement history');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'spindl-inventory-movements.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify('Inventory movement CSV downloaded');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setMovementExporting(false);
    }
  };

  const selectedItemForLedger = useMemo(
    () => (movementItemId ? allItems.find((item) => item.id === movementItemId) : null),
    [movementItemId, allItems]
  );

  return (
    <div className="inventory-screen-layout">
      {/* 1. Top Inventory Metric Strip */}
      <div className="inventory-metric-strip">
        <div className="inventory-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">TOTAL CATALOG SKUS</span>
            <Boxes size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">{allItems.length} SKUs</div>
          <div className="sales-metric-sub">
            <span className="kpi-badge kpi-badge-neutral">All categories</span>
            <span>Active registered items</span>
          </div>
        </div>

        <div className="inventory-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">ON-HAND INVENTORY</span>
            <Package size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">{totalUnitsOnHand.toLocaleString()} Units</div>
          <div className="sales-metric-sub">
            <span className="kpi-badge kpi-badge-purple">Counted</span>
            <span>Total physical stock balance</span>
          </div>
        </div>

        <div className="inventory-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">LOW-STOCK ALERTS</span>
            <AlertTriangle size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">
            {lowStockCount > 0 ? `${lowStockCount} Low Stock` : 'Healthy'}
          </div>
          <div className="sales-metric-sub">
            <span className={`kpi-badge ${lowStockCount > 0 ? 'kpi-badge-warning' : 'kpi-badge-positive'}`}>
              {lowStockCount > 0 ? `${lowStockCount} below reorder` : 'Safe levels'}
            </span>
            <span>reorder threshold alerts</span>
          </div>
        </div>

        <div className="inventory-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">CATALOG ASSET VALUE</span>
            <IndianRupee size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">{formatCompactRupees(totalValuation)}</div>
          <div className="sales-metric-sub">
            <span className="kpi-badge kpi-badge-neutral">Valuation</span>
            <span>Stock × unit purchase price</span>
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="inventory-subnav-container">
        <div className="inventory-subnav-tabs" role="tablist" aria-label="Inventory modules">
          <button
            type="button"
            className={`inventory-subnav-tab ${activeTab === 'stock' ? 'active' : ''}`}
            onClick={() => setActiveTab('stock')}
          >
            <Boxes size={15} aria-hidden="true" />
            Stock overview
            <span className="subnav-badge">{allItems.length}</span>
          </button>
          <button
            type="button"
            className={`inventory-subnav-tab ${activeTab === 'movements' ? 'active' : ''}`}
            onClick={() => setActiveTab('movements')}
          >
            <History size={15} aria-hidden="true" />
            Movement ledger
            {movementPage.totalElements > 0 && (
              <span className="subnav-badge">{movementPage.totalElements}</span>
            )}
          </button>
          <button
            type="button"
            className={`inventory-subnav-tab ${activeTab === 'counts' ? 'active' : ''}`}
            onClick={() => setActiveTab('counts')}
          >
            <ClipboardCheck size={15} aria-hidden="true" />
            Cycle counts
          </button>
        </div>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB A: Stock Overview */}
      {activeTab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Common Category & Alert Filter + Search */}
          <div className="sales-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} style={{ color: 'var(--sp-text-muted)', flexShrink: 0 }} aria-hidden="true" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                  style={{
                    height: '32px',
                    padding: '0 28px 0 10px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: '1px solid var(--sp-border)',
                    background: 'var(--sp-surface)',
                    color: 'var(--sp-text)',
                    cursor: 'pointer',
                  }}
                  aria-label="Filter catalog items by category or stock status"
                >
                  <option value="ALL">All Items ({categoryCounts.all})</option>
                  <option value="RAW">Raw Materials ({categoryCounts.raw})</option>
                  <option value="WIP">Work in Progress ({categoryCounts.wip})</option>
                  <option value="FINISHED">Finished Goods ({categoryCounts.finished})</option>
                  <option value="LOW_STOCK">Low Stock Alerts ({categoryCounts.lowStock})</option>
                </select>
              </div>
            </div>

            <div className="sales-search-box">
              <Search size={14} className="sales-search-icon" aria-hidden="true" />
              <input
                className="sales-search-input"
                placeholder="Search products or SKU..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd className="sales-search-kbd">/</kbd>
            </div>
          </div>

          {/* Stock Overview Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>PRODUCT & CATEGORY</th>
                    <th style={{ width: '110px' }}>SKU</th>
                    <th style={{ width: '115px' }}>TYPE</th>
                    <th style={{ width: '90px', textAlign: 'right' }}>ON HAND</th>
                    <th style={{ width: '115px', textAlign: 'right' }}>RESERVED / AVAIL</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>UNIT PRICE</th>
                    <th style={{ width: '110px' }}>STATUS & ALERT</th>
                    <th style={{ width: '190px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStockItems.map((item) => {
                    const isLowStock = Number(item.available) <= Number(item.lowStockThreshold);
                    const typeLabel =
                      ({
                        RAW: 'Raw material',
                        WIP: 'Work in progress',
                        FINISHED: 'Finished good',
                        SERVICE: 'Service',
                      }[item.itemType] || 'Finished good');

                    return (
                      <tr key={item.sku} className="sales-row">
                        <td>
                          <div className="sales-customer-cell">
                            <span className={`sales-customer-avatar ${item.tone || 'lavender'}`}>
                              {item.mark || item.name.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="customer-info-cell" style={{ minWidth: 0, overflow: 'hidden' }}>
                              <strong style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block', maxWidth: '175px' }}>
                                {item.name}
                              </strong>
                              <small>Category: {item.category}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="sales-ref-badge">{item.sku}</span>
                        </td>
                        <td>
                          <span className={`product-type-badge ${(item.itemType || 'finished').toLowerCase()}`}>
                            {typeLabel}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                            {item.stock.toLocaleString()}
                          </span>{' '}
                          <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>{item.unit}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11.5px', color: isLowStock ? 'var(--sp-warning)' : 'var(--sp-text)' }}>
                            <strong>{Number(item.available ?? item.stock).toLocaleString()}</strong> avail
                          </div>
                          <small style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)' }}>
                            {Number(item.reserved || 0).toLocaleString()} reserved
                          </small>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(item.unitPrice || item.price)}
                          </span>
                        </td>
                        <td>
                          <Status label={item.state} />
                          <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                            Min: <strong>{item.lowStockThreshold}</strong> {item.unit}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="sales-actions-cell" style={{ justifyContent: 'flex-end', gap: '4px' }}>
                            <CustomFieldEditor resource="items" recordId={item.id} label="Fields" />
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              onClick={() => onAdjust(item)}
                              title="Adjust physical stock quantity"
                            >
                              Adjust
                            </button>
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              onClick={() => onThreshold(item)}
                              title="Configure low-stock alert threshold"
                            >
                              Threshold
                            </button>
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              onClick={() => {
                                setMovementItemId(item.id);
                                setMovementPage((p) => ({ ...p, page: 0 }));
                                setActiveTab('movements');
                              }}
                              title="Inspect item in movement ledger"
                              style={{ padding: '0 6px' }}
                            >
                              <History size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredStockItems.length && (
                    <tr>
                      <td colSpan={8} className="sales-empty-cell">
                        <div className="sales-empty-state">
                          <Boxes size={32} className="sales-empty-icon" />
                          <div className="sales-empty-title">No inventory items found</div>
                          <div className="sales-empty-desc">
                            {query ? `No items match “${query}”.` : 'No items found in this category.'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB B: Movement Ledger */}
      {activeTab === 'movements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Movement Toolbar */}
          <div className="sales-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <div className="sales-search-box" style={{ maxWidth: '360px', width: '100%', flexShrink: 0 }}>
                <Search size={14} className="sales-search-icon" aria-hidden="true" />
                <input
                  className="sales-search-input"
                  placeholder="Filter movements by SKU, item, warehouse, reason..."
                  value={movementSearch}
                  onChange={(event) => {
                    setMovementSearch(event.target.value);
                    setMovementPage((p) => ({ ...p, page: 0 }));
                  }}
                />
                {movementSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setMovementSearch('');
                      setMovementPage((p) => ({ ...p, page: 0 }));
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--sp-text-muted)', display: 'flex', alignItems: 'center' }}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--sp-text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                <span>From</span>
                <input
                  type="date"
                  value={movementFrom}
                  onChange={(event) => {
                    setMovementFrom(event.target.value);
                    setMovementPage((p) => ({ ...p, page: 0 }));
                  }}
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--sp-border)',
                    background: 'var(--sp-surface)',
                    color: 'var(--sp-text)',
                  }}
                />
                <span>To</span>
                <input
                  type="date"
                  value={movementTo}
                  onChange={(event) => {
                    setMovementTo(event.target.value);
                    setMovementPage((p) => ({ ...p, page: 0 }));
                  }}
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--sp-border)',
                    background: 'var(--sp-surface)',
                    color: 'var(--sp-text)',
                  }}
                />
                {(movementFrom || movementTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMovementFrom('');
                      setMovementTo('');
                      setMovementPage((p) => ({ ...p, page: 0 }));
                    }}
                    className="sales-action-btn secondary"
                    style={{ height: '32px', padding: '0 8px', fontSize: '11.5px' }}
                  >
                    Reset
                  </button>
                )}
              </div>

              {selectedItemForLedger && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'var(--sp-surface-hover)',
                    border: '1px solid var(--sp-border)',
                    color: 'var(--sp-text)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <span>
                    Item: <b>{selectedItemForLedger.sku}</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMovementItemId('');
                      setMovementPage((p) => ({ ...p, page: 0 }));
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'var(--sp-text-muted)' }}
                    aria-label="Clear item filter"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            <div style={{ flexShrink: 0 }}>
              <button
                type="button"
                className="sales-action-btn secondary"
                disabled={movementExporting}
                onClick={exportLedger}
                style={{ height: '32px', padding: '0 12px', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <Download size={13} aria-hidden="true" />
                {movementExporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>

          {/* Movement Table Card */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '160px' }}>DATE & TIME</th>
                    <th style={{ minWidth: '240px' }}>ITEM & SPECIFICATION</th>
                    <th style={{ width: '150px' }}>WAREHOUSE</th>
                    <th style={{ width: '150px' }}>REASON</th>
                    <th style={{ width: '160px' }}>REFERENCE</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>QUANTITY CHANGE</th>
                  </tr>
                </thead>
                <tbody>
                  {movementLoading ? (
                    <tr>
                      <td colSpan={6} className="sales-empty-cell">
                        <div className="sales-empty-state">
                          <div className="sales-empty-title">Loading movement ledger…</div>
                        </div>
                      </td>
                    </tr>
                  ) : movementRows.length ? (
                    movementRows.map((movement) => {
                      const isPositive = movement.quantityDelta > 0;
                      const itemUnit = itemUnitMap.get(movement.itemId) || '';

                      return (
                        <tr key={movement.id} className="sales-row">
                          <td style={{ color: 'var(--sp-text-secondary)', fontSize: '12px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {new Date(movement.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <strong style={{ fontSize: '12.5px', color: 'var(--sp-text)' }}>
                                {movement.itemName}
                              </strong>
                              <div>
                                <span
                                  className="sales-ref-badge"
                                  style={{
                                    fontSize: '11px',
                                    fontFamily: 'var(--sp-font-mono, monospace)',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {movement.sku}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '12.5px', color: 'var(--sp-text)' }}>
                              {movement.warehouseName || movement.warehouseCode || 'Main Warehouse'}
                            </span>
                          </td>
                          <td>
                            <span className="sales-type-badge">{movement.reason}</span>
                          </td>
                          <td>
                            <span
                              className="sales-ref-badge"
                              style={{
                                fontSize: '11px',
                                fontFamily: 'var(--sp-font-mono, monospace)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {movement.sourceReference}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                fontWeight: 600,
                                fontSize: '12.5px',
                                fontVariantNumeric: 'tabular-nums',
                                color: isPositive ? '#16a34a' : '#dc2626',
                              }}
                            >
                              {isPositive ? `+${movement.quantityDelta.toLocaleString()}` : movement.quantityDelta.toLocaleString()}
                              {itemUnit && (
                                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--sp-text-muted)', marginLeft: '4px' }}>
                                  {itemUnit}
                                </span>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="sales-empty-cell">
                        <div className="sales-empty-state">
                          <Boxes size={32} className="sales-empty-icon" />
                          <div className="sales-empty-title">No movement records found</div>
                          <div className="sales-empty-desc">
                            No movement records match the current filters.
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="sales-pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--sp-border)', fontSize: '12px', color: 'var(--sp-text-muted)' }}>
              <span>
                Showing{' '}
                <strong style={{ color: 'var(--sp-text)' }}>
                  {movementPage.totalElements ? movementPage.page * movementPage.pageSize + 1 : 0}
                </strong>{' '}
                –{' '}
                <strong style={{ color: 'var(--sp-text)' }}>
                  {Math.min((movementPage.page + 1) * movementPage.pageSize, movementPage.totalElements)}
                </strong>{' '}
                of <strong style={{ color: 'var(--sp-text)' }}>{movementPage.totalElements}</strong> movements
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  disabled={movementPage.page <= 0 || movementLoading}
                  onClick={() => setMovementPage((p) => ({ ...p, page: Math.max(0, p.page - 1) }))}
                  style={{ height: '28px', padding: '0 10px' }}
                >
                  Previous
                </button>
                <span>
                  Page {movementPage.totalPages ? movementPage.page + 1 : 0} of {movementPage.totalPages || 1}
                </span>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  disabled={!movementPage.totalPages || movementPage.page >= movementPage.totalPages - 1 || movementLoading}
                  onClick={() => setMovementPage((p) => ({ ...p, page: p.page + 1 }))}
                  style={{ height: '28px', padding: '0 10px' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB C: Cycle Counts */}
      {activeTab === 'counts' && (
        <InventoryCycleCountPanel role={role} notify={notify} onPosted={onRefresh} />
      )}
    </div>
  );
}
