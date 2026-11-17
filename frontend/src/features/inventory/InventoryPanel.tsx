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
  Search,
  SlidersHorizontal,
  Warehouse,
  X,
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { CustomFieldEditor } from '../customers/CustomFieldEditor';
import { InventoryWarehousePanel } from './InventoryWarehousePanel';
import { InventoryCycleCountPanel } from './InventoryCycleCountPanel';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency, formatCompactRupees } from '../../lib/utils/currency';
import type {
  InventoryMovement,
  InventoryMovementPage,
  ItemSummary,
} from '../../types/inventory';

type InventoryTab = 'stock' | 'movements' | 'warehouses' | 'counts';
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
          <span className="metric-label">Total catalog SKUs</span>
          <b className="metric-val">
            {allItems.length} <small>items</small>
          </b>
          <span className="metric-sub">Across all categories</span>
        </div>
        <div className="inventory-metric-card">
          <span className="metric-label">On-hand inventory</span>
          <b className="metric-val">
            {totalUnitsOnHand.toLocaleString()} <small>units</small>
          </b>
          <span className="metric-sub">Total physical balance</span>
        </div>
        <div className="inventory-metric-card">
          <span className="metric-label">Low-stock alerts</span>
          <b className={`metric-val ${lowStockCount > 0 ? 'text-warning' : 'text-positive'}`}>
            {lowStockCount} <small>{lowStockCount === 1 ? 'alert' : 'alerts'}</small>
          </b>
          <span className="metric-sub">
            {lowStockCount > 0 ? 'Items below reorder point' : 'All items well stocked'}
          </span>
        </div>
        <div className="inventory-metric-card">
          <span className="metric-label">Catalog asset value</span>
          <b className="metric-val">{formatCompactRupees(totalValuation)}</b>
          <span className="metric-sub">Stock × unit cost</span>
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
            className={`inventory-subnav-tab ${activeTab === 'warehouses' ? 'active' : ''}`}
            onClick={() => setActiveTab('warehouses')}
          >
            <Warehouse size={15} aria-hidden="true" />
            Warehouses & transfers
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
        <section className="panel directory-panel product-directory-panel">
          <div className="panel-header directory-top">
            <div>
              <h2>
                Stock overview <span className="record-count">{filteredStockItems.length}</span>
              </h2>
              <p>On-hand, reserved, and available quantities with threshold alerts.</p>
            </div>
            {query && (
              <button className="button button-secondary" onClick={() => setQuery('')}>
                Clear filter
              </button>
            )}
          </div>

          {/* Category & Alert Filter Pills + Search */}
          <div className="table-controls table-controls-enhanced">
            <div className="tx-tabs" role="tablist">
              <button
                type="button"
                className={`tx-tab-btn ${categoryFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('ALL')}
              >
                All items <span className="tab-count">{categoryCounts.all}</span>
              </button>
              <button
                type="button"
                className={`tx-tab-btn ${categoryFilter === 'RAW' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('RAW')}
              >
                Raw materials <span className="tab-count">{categoryCounts.raw}</span>
              </button>
              <button
                type="button"
                className={`tx-tab-btn ${categoryFilter === 'WIP' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('WIP')}
              >
                Work in progress <span className="tab-count">{categoryCounts.wip}</span>
              </button>
              <button
                type="button"
                className={`tx-tab-btn ${categoryFilter === 'FINISHED' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('FINISHED')}
              >
                Finished goods <span className="tab-count">{categoryCounts.finished}</span>
              </button>
              <button
                type="button"
                className={`tx-tab-btn ${categoryFilter === 'LOW_STOCK' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('LOW_STOCK')}
              >
                Low stock alerts{' '}
                <span
                  className="tab-count"
                  style={
                    categoryCounts.lowStock > 0
                      ? { background: 'var(--sp-warning-soft)', color: 'var(--sp-warning)' }
                      : undefined
                  }
                >
                  {categoryCounts.lowStock}
                </span>
              </button>
            </div>

            <div className="table-search-actions">
              <div className="search-box">
                <Search size={14} aria-hidden="true" />
                <input
                  className="search-input"
                  placeholder="Search products or SKU..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd>/</kbd>
              </div>
              {query && (
                <button className="filter-button" onClick={() => setQuery('')}>
                  <SlidersHorizontal size={14} aria-hidden="true" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Stock Overview Table */}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>SKU</th>
                  <th>CATEGORY</th>
                  <th>TYPE</th>
                  <th style={{ textAlign: 'right' }}>ON HAND</th>
                  <th style={{ textAlign: 'right' }}>RESERVED</th>
                  <th style={{ textAlign: 'right' }}>AVAILABLE</th>
                  <th>THRESHOLD</th>
                  <th style={{ textAlign: 'right' }}>UNIT PRICE</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
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
                    <tr key={item.sku}>
                      <td>
                        <div className="party-cell">
                          <span className={`party-avatar ${item.tone || 'lavender'}`}>
                            {item.mark || item.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="party-name">
                            <b>{item.name}</b>
                            {item.barcode && <small>Barcode · {item.barcode}</small>}
                          </div>
                        </div>
                      </td>
                      <td className="ref-cell">{item.sku}</td>
                      <td>{item.category}</td>
                      <td>
                        <span className="type-cell">{typeLabel}</span>
                      </td>
                      <td className="amount-cell" style={{ textAlign: 'right' }}>
                        {item.stock.toLocaleString()} <span className="unit">{item.unit}</span>
                      </td>
                      <td className="amount-cell" style={{ textAlign: 'right', color: 'var(--sp-text-muted)' }}>
                        {Number(item.reserved || 0).toLocaleString()}
                      </td>
                      <td
                        className="amount-cell"
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          color: isLowStock ? 'var(--sp-warning)' : 'var(--sp-text)',
                        }}
                      >
                        {Number(item.available ?? item.stock).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`status ${isLowStock ? 'status-amber' : 'status-purple'}`}
                          title={`Alert threshold: ${item.lowStockThreshold} ${item.unit}`}
                        >
                          {item.lowStockThreshold} {item.unit}
                        </span>
                      </td>
                      <td className="amount-cell" style={{ textAlign: 'right' }}>
                        {item.price}
                      </td>
                      <td>
                        <Status label={item.state} />
                      </td>
                      <td>
                        <div className="action-inline">
                          <CustomFieldEditor resource="items" recordId={item.id} />
                          <button
                            className="mini-action"
                            onClick={() => onAdjust(item)}
                            title="Adjust physical stock quantity"
                          >
                            Adjust
                          </button>
                          <button
                            className="mini-action muted"
                            onClick={() => {
                              setMovementItemId(item.id);
                              setMovementPage((p) => ({ ...p, page: 0 }));
                              setActiveTab('movements');
                            }}
                            title="Inspect item in movement ledger"
                          >
                            Ledger
                          </button>
                          <button
                            className="mini-action muted"
                            onClick={() => onThreshold(item)}
                            title="Configure low-stock alert threshold"
                          >
                            Threshold
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredStockItems.length && (
                  <tr>
                    <td className="empty-cell" colSpan={11}>
                      {query ? `No items match “${query}”.` : 'No items found in this category.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB B: Movement Ledger */}
      {activeTab === 'movements' && (
        <section className="panel directory-panel inventory-movement-history">
          <div className="panel-header directory-top">
            <div>
              <h2>
                Inventory movement history{' '}
                <span className="record-count">{movementPage.totalElements}</span>
              </h2>
              <p>Traceable ledger of all stock additions, deductions, transfers, and corrections.</p>
            </div>
            <button
              className="button button-secondary"
              disabled={movementExporting}
              onClick={exportLedger}
            >
              <Download size={14} aria-hidden="true" />
              {movementExporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>

          {/* Movement Filters Bar */}
          <div className="movement-filters">
            <div className="search-box">
              <Search size={14} aria-hidden="true" />
              <input
                className="search-input"
                placeholder="Search SKU, item, warehouse, reason, reference…"
                value={movementSearch}
                onChange={(event) => {
                  setMovementSearch(event.target.value);
                  setMovementPage((p) => ({ ...p, page: 0 }));
                }}
              />
            </div>
            <label>
              From
              <input
                type="date"
                value={movementFrom}
                onChange={(event) => {
                  setMovementFrom(event.target.value);
                  setMovementPage((p) => ({ ...p, page: 0 }));
                }}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={movementTo}
                onChange={(event) => {
                  setMovementTo(event.target.value);
                  setMovementPage((p) => ({ ...p, page: 0 }));
                }}
              />
            </label>

            {selectedItemForLedger && (
              <div className="active-item-filter-chip">
                <span>
                  Filtered by <b>{selectedItemForLedger.sku}</b> ({selectedItemForLedger.name})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMovementItemId('');
                    setMovementPage((p) => ({ ...p, page: 0 }));
                  }}
                  aria-label="Clear item filter"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Movement Table */}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>DATE & TIME</th>
                  <th>WAREHOUSE</th>
                  <th>ITEM</th>
                  <th>REASON</th>
                  <th>REFERENCE</th>
                  <th style={{ textAlign: 'right' }}>CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {movementLoading ? (
                  <tr>
                    <td className="empty-cell" colSpan={6}>
                      Loading movement ledger…
                    </td>
                  </tr>
                ) : movementRows.length ? (
                  movementRows.map((movement) => {
                    const isPositive = movement.quantityDelta > 0;

                    return (
                      <tr key={movement.id}>
                        <td className="date-cell">
                          {new Date(movement.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>
                          <b>{movement.warehouseName || movement.warehouseCode || 'Main Warehouse'}</b>
                        </td>
                        <td>
                          <div className="party-name">
                            <b>{movement.itemName}</b>
                            <small>{movement.sku}</small>
                          </div>
                        </td>
                        <td>
                          <span className="type-cell">{movement.reason}</span>
                        </td>
                        <td className="ref-cell">{movement.sourceReference}</td>
                        <td className="amount-cell" style={{ textAlign: 'right' }}>
                          <span className={`status ${isPositive ? 'status-green' : 'status-red'}`}>
                            {isPositive ? (
                              <ArrowUpRight size={12} aria-hidden="true" />
                            ) : (
                              <ArrowDownLeft size={12} aria-hidden="true" />
                            )}
                            {isPositive ? '+' : ''}
                            {movement.quantityDelta}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="empty-cell" colSpan={6}>
                      No movement records match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="movement-pagination">
            <span>
              Showing{' '}
              {movementPage.totalElements
                ? movementPage.page * movementPage.pageSize + 1
                : 0}
              –
              {Math.min(
                (movementPage.page + 1) * movementPage.pageSize,
                movementPage.totalElements
              )}{' '}
              of {movementPage.totalElements} records
            </span>
            <div className="pagination-buttons">
              <button
                className="mini-action muted"
                disabled={movementPage.page <= 0 || movementLoading}
                onClick={() =>
                  setMovementPage((p) => ({ ...p, page: Math.max(0, p.page - 1) }))
                }
              >
                Previous
              </button>
              <span>
                Page {movementPage.totalPages ? movementPage.page + 1 : 0} of{' '}
                {movementPage.totalPages}
              </span>
              <button
                className="mini-action muted"
                disabled={
                  !movementPage.totalPages ||
                  movementPage.page >= movementPage.totalPages - 1 ||
                  movementLoading
                }
                onClick={() => setMovementPage((p) => ({ ...p, page: p.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TAB C: Warehouses & Transfers */}
      {activeTab === 'warehouses' && (
        <InventoryWarehousePanel
          items={allItems}
          role={role}
          notify={notify}
          onPosted={onRefresh}
        />
      )}

      {/* TAB D: Cycle Counts */}
      {activeTab === 'counts' && (
        <InventoryCycleCountPanel role={role} notify={notify} onPosted={onRefresh} />
      )}
    </div>
  );
}
