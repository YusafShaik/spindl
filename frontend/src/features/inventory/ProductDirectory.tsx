import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Check,
  CheckCircle2,
  Download,
  Edit2,
  FolderTree,
  IndianRupee,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  X
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { CustomFieldEditor } from '../customers/CustomFieldEditor';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import type { InventoryMovement, ItemSummary } from '../../types/inventory';

export interface ProductDirectoryProps {
  title: string;
  subtitle: string;
  query: string;
  setQuery: (query: string) => void;
  data: ItemSummary[];
  allItems?: ItemSummary[];
  movements?: InventoryMovement[];
  notify: (message: string) => void;
  onAdjust?: ((item: ItemSummary) => void) | null;
  onThreshold?: ((item: ItemSummary) => void) | null;
  onNewItem?: () => void;
  onRefresh?: () => Promise<void>;
  role?: string;
}

type ProductSubTab = 'catalog' | 'pricing' | 'thresholds';
type ItemTypeFilter = 'ALL' | 'FINISHED' | 'RAW' | 'WIP' | 'SERVICE' | 'LOW_STOCK';

function parseAmount(val: string | number | null | undefined): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function isItemLowStock(item: ItemSummary): boolean {
  const avail = item.available !== undefined && item.available !== null ? Number(item.available) : Number(item.stock || 0);
  const threshold = Number(item.lowStockThreshold || 0);
  return avail <= threshold;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function apiError(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.detail === 'string' ? value.detail : typeof value.message === 'string' ? value.message : undefined;
}

/* Quick Edit Item Modal */
interface EditProductModalProps {
  item: ItemSummary;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
  notify: (msg: string) => void;
}

function EditProductModal({ item, onClose, onRefresh, notify }: EditProductModalProps) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState(item.unit || 'pcs');
  const [unitPrice, setUnitPrice] = useState(item.unitPrice ? String(item.unitPrice) : '0');
  const [itemType, setItemType] = useState(item.itemType || 'FINISHED');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim(),
        unitPrice: parseFloat(unitPrice) || 0,
        active: true,
        itemType: itemType.trim().toUpperCase()
      };

      const res = await apiFetch(`${API}/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiError(body) ?? 'Failed to update item details');
      if (onRefresh) await onRefresh();
      notify(`Item ${item.sku} updated successfully`);
      onClose();
    } catch (err) {
      notify(messageFrom(err, 'Could not save product changes'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form className="record-modal" onSubmit={handleSubmit} style={{ width: 'min(520px, 95vw)' }}>
        <div className="modal-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Edit2 size={15} />
            </div>
            <div>
              <h2>Edit Catalog Item</h2>
              <p>SKU: <strong>{item.sku}</strong></p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
              Product / Item Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={saving}
              style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Item Type
              </label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)' }}
              >
                <option value="FINISHED">Finished Good</option>
                <option value="RAW">Raw Material</option>
                <option value="WIP">Work in Progress (WIP)</option>
                <option value="SERVICE">Service</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Unit Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Unit of Measure
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                disabled={saving}
                placeholder="pcs, kg, m, svc"
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)' }}
              />
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
          <button type="button" className="button button-secondary" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Item Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* Quick Low Stock Threshold Modal */
interface EditThresholdModalProps {
  item: ItemSummary;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
  notify: (msg: string) => void;
}

function EditThresholdModal({ item, onClose, onRefresh, notify }: EditThresholdModalProps) {
  const [threshold, setThreshold] = useState(item.lowStockThreshold ?? 10);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch(`${API}/items/${item.id}/low-stock-threshold`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lowStockThreshold: Number(threshold) })
      });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiError(body) ?? 'Failed to update reorder threshold');
      if (onRefresh) await onRefresh();
      notify(`Reorder threshold for ${item.sku} set to ${threshold} ${item.unit}`);
      onClose();
    } catch (err) {
      notify(messageFrom(err, 'Could not save threshold'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form className="record-modal" onSubmit={handleSubmit} style={{ width: 'min(440px, 95vw)' }}>
        <div className="modal-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SlidersHorizontal size={15} />
            </div>
            <div>
              <h2>Reorder Trigger Threshold</h2>
              <p>{item.name} (<code>{item.sku}</code>)</p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
              Minimum Safe Inventory Level ({item.unit})
            </label>
            <input
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              required
              disabled={saving}
              style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '4px', display: 'block' }}>
              When available stock falls at or below this value, an automated low stock warning is raised.
            </span>
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--sp-surface-hover)', borderRadius: '6px', border: '1px solid var(--sp-border)', fontSize: '12px', color: 'var(--sp-text)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: 'var(--sp-text-secondary)' }}>Current on-hand stock:</span>
              <strong>{item.stock} {item.unit}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--sp-text-secondary)' }}>Net available for allocation:</span>
              <strong>{item.available ?? item.stock} {item.unit}</strong>
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
          <button type="button" className="button button-secondary" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Update Threshold'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* Item Specification Drawer / Modal */
interface ProductSpecsDrawerProps {
  item: ItemSummary;
  onClose: () => void;
  onEdit?: () => void;
  onThreshold?: () => void;
}

function ProductSpecsDrawer({ item, onClose, onEdit, onThreshold }: ProductSpecsDrawerProps) {
  const price = parseAmount(item.unitPrice || item.price);
  const stock = item.stock || 0;
  const valuation = price * stock;
  const available = item.available ?? stock;
  const isLowStock = isItemLowStock(item);

  const typeLabels: Record<string, string> = {
    RAW: 'Raw Material',
    WIP: 'Work in Progress',
    FINISHED: 'Finished Good',
    SERVICE: 'Service'
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="record-modal" style={{ width: 'min(580px, 95vw)', maxHeight: '88vh' }}>
        <div className="modal-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`sales-customer-avatar ${item.tone || 'lavender'}`}>
              {item.mark}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '16px' }}>{item.name}</h2>
                <span className="sales-ref-badge">{item.sku}</span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                Category: <strong>{item.category}</strong> · {typeLabels[item.itemType] || 'Product'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>

        {/* 4-Stat KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', margin: '14px 0' }}>
          <div style={{ padding: '12px 14px', background: 'var(--sp-surface-hover)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Commercial Unit Price
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--sp-text)', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(price)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)', marginTop: '2px' }}>
              Per {item.unit}
            </div>
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--sp-surface-hover)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Total Asset Valuation
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--sp-text)', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(valuation)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)', marginTop: '2px' }}>
              Based on {stock.toLocaleString()} {item.unit} on-hand
            </div>
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--sp-surface-hover)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Physical Stock On Hand
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--sp-text)', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
              {stock.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--sp-text-muted)' }}>{item.unit}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)', marginTop: '2px' }}>
              {item.reserved || 0} {item.unit} reserved for orders
            </div>
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--sp-surface-hover)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Net Available to Allocate
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: isLowStock ? '#d97706' : 'var(--sp-text)', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
              {available.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--sp-text-muted)' }}>{item.unit}</span>
            </div>
            <div style={{ fontSize: '11px', color: isLowStock ? '#d97706' : 'var(--sp-text-secondary)', marginTop: '2px' }}>
              {isLowStock ? 'Below reorder threshold' : 'Sufficient stock level'}
            </div>
          </div>
        </div>

        {/* Master Properties Card */}
        <div className="linear-properties-card" style={{ marginBottom: '14px' }}>
          <div className="linear-properties-title">Product Master Data & Rules</div>

          <div className="linear-property-row">
            <span className="linear-property-label">Item Classification</span>
            <span className="linear-property-value">
              <span className={`product-type-badge ${item.itemType?.toLowerCase() || 'finished'}`}>
                {typeLabels[item.itemType] || 'Finished Good'}
              </span>
            </span>
          </div>

          <div className="linear-property-row">
            <span className="linear-property-label">Category Group</span>
            <span className="linear-property-value" style={{ fontWeight: 500 }}>
              {item.category}
            </span>
          </div>

          <div className="linear-property-row">
            <span className="linear-property-label">Operational Status</span>
            <span className="linear-property-value">
              <Status label={item.state} />
            </span>
          </div>

          <div className="linear-property-row">
            <span className="linear-property-label">Reorder Level Alarm</span>
            <span className="linear-property-value">
              ≤ <strong>{item.lowStockThreshold}</strong> {item.unit}
            </span>
          </div>

          <div className="linear-property-row">
            <span className="linear-property-label">Health & Risk Check</span>
            <span className="linear-property-value">
              {isLowStock ? (
                <span className="customer-risk-chip hold">
                  <AlertTriangle size={10} /> Low Stock Alert
                </span>
              ) : (
                <span className="customer-risk-chip good">
                  <CheckCircle2 size={10} /> Stock Level Safe
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Health Advisory Banner */}
        {isLowStock ? (
          <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '11.5px', color: '#b45309' }}>
              <strong>Inventory Warning:</strong> Available stock ({available} {item.unit}) has dropped to or below the safety threshold ({item.lowStockThreshold} {item.unit}). Create a purchase or production order to replenish.
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <CheckCircle2 size={14} color="#059669" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '11.5px', color: '#065f46' }}>
              Stock level is healthy and ready for quotation or immediate fulfillment.
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {onEdit && (
              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
              >
                <Edit2 size={12} /> Edit Details
              </button>
            )}
            {onThreshold && (
              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => {
                  onClose();
                  onThreshold();
                }}
              >
                <SlidersHorizontal size={12} /> Set Threshold
              </button>
            )}
          </div>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductDirectory({
  query,
  setQuery,
  data,
  notify,
  onNewItem,
  onRefresh
}: ProductDirectoryProps) {
  const [activeTab, setActiveTab] = useState<ProductSubTab>('catalog');
  const [typeFilter, setTypeFilter] = useState<ItemTypeFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [pricingQuery, setPricingQuery] = useState('');
  const [thresholdQuery, setThresholdQuery] = useState('');
  const [thresholdFilter, setThresholdFilter] = useState<'ALL' | 'LOW' | 'SAFE'>('ALL');
  const [editingItem, setEditingItem] = useState<ItemSummary | null>(null);
  const [thresholdItem, setThresholdItem] = useState<ItemSummary | null>(null);
  const [specsItem, setSpecsItem] = useState<ItemSummary | null>(null);

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    data.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [data]);

  // Executive KPI Calculations across catalog items
  const { totalValuation, finishedCount, rawCount, wipCount, serviceCount, lowStockCount, inStockPct, totalStockUnits } =
    useMemo(() => {
      let sumValuation = 0;
      let finished = 0;
      let raw = 0;
      let wip = 0;
      let service = 0;
      let low = 0;
      let stockUnits = 0;

      for (const item of data) {
        const price = parseAmount(item.unitPrice || item.price);
        const stock = item.stock || 0;
        sumValuation += price * stock;
        stockUnits += stock;

        const type = (item.itemType || 'FINISHED').toUpperCase();
        if (type === 'FINISHED') finished++;
        else if (type === 'RAW') raw++;
        else if (type === 'WIP') wip++;
        else if (type === 'SERVICE') service++;

        if (isItemLowStock(item)) low++;
      }

      const total = data.length;
      const inStockPct = total > 0 ? Math.round(((total - low) / total) * 100) : 100;

      return {
        totalValuation: sumValuation,
        finishedCount: finished,
        rawCount: raw,
        wipCount: wip,
        serviceCount: service,
        lowStockCount: low,
        inStockPct,
        totalStockUnits: stockUnits
      };
    }, [data]);

  // Tab 1 Filtered Items
  const filteredItems = useMemo(() => {
    return data.filter((item) => {
      const type = (item.itemType || 'FINISHED').toUpperCase();
      if (typeFilter === 'FINISHED' && type !== 'FINISHED') return false;
      if (typeFilter === 'RAW' && type !== 'RAW') return false;
      if (typeFilter === 'WIP' && type !== 'WIP') return false;
      if (typeFilter === 'SERVICE' && type !== 'SERVICE') return false;
      if (typeFilter === 'LOW_STOCK' && !isItemLowStock(item)) return false;

      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

      if (query.trim()) {
        const q = query.toLowerCase();
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        if (!matchSku && !matchName && !matchCat) return false;
      }

      return true;
    });
  }, [data, typeFilter, categoryFilter, query]);

  // Tab 2 Filtered Items for Pricing
  const filteredPricingItems = useMemo(() => {
    if (!pricingQuery.trim()) return data;
    const q = pricingQuery.toLowerCase();
    return data.filter(
      (i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
    );
  }, [data, pricingQuery]);

  // Tab 3 Filtered Items for Thresholds
  const filteredThresholdItems = useMemo(() => {
    return data.filter((item) => {
      const isLow = isItemLowStock(item);
      if (thresholdFilter === 'LOW' && !isLow) return false;
      if (thresholdFilter === 'SAFE' && isLow) return false;

      if (thresholdQuery.trim()) {
        const q = thresholdQuery.toLowerCase();
        return item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data, thresholdFilter, thresholdQuery]);

  // CSV Export
  const exportCatalogCSV = () => {
    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Item Type',
      'Unit of Measure',
      'Unit Price (₹)',
      'Stock on Hand',
      'Reserved Quantity',
      'Available Quantity',
      'Low Stock Threshold',
      'Inventory Valuation (₹)',
      'Stock State'
    ];

    const rows = filteredItems.map((item) => {
      const price = parseAmount(item.unitPrice || item.price);
      const stock = item.stock || 0;
      const valuation = price * stock;

      return [
        `"${item.sku}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category}"`,
        `"${item.itemType || 'FINISHED'}"`,
        `"${item.unit}"`,
        price,
        stock,
        item.reserved || 0,
        item.available ?? stock,
        item.lowStockThreshold,
        valuation,
        `"${item.state}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `product_catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Exported ${filteredItems.length} catalog items to CSV`);
  };

  return (
    <div className="sales-screen-layout">
      {/* 1. Executive Catalog KPI Strip */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">TOTAL CATALOG ITEMS</span>
            <Boxes size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">{data.length} SKUs</div>
          <div className="sales-metric-sub">
            <span className="kpi-badge kpi-badge-purple">{finishedCount} Finished</span>
            <span>{rawCount} Raw · {wipCount} WIP · {serviceCount} Svc</span>
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">PORTFOLIO BOOK VALUE</span>
            <IndianRupee size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">{formatCurrency(totalValuation)}</div>
          <div className="sales-metric-sub">
            <span className="kpi-badge kpi-badge-neutral">On-hand assets</span>
            <span>Total catalog valuation</span>
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">STOCK HEALTH & REORDER</span>
            <AlertTriangle size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">
            {lowStockCount > 0 ? `${lowStockCount} Low Stock` : 'Healthy'}
          </div>
          <div className="sales-metric-sub">
            <span className={`kpi-badge ${lowStockCount > 0 ? 'kpi-badge-warning' : 'kpi-badge-positive'}`}>
              {inStockPct}%
            </span>
            <span>safe operational level</span>
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">PRODUCT CATEGORIES</span>
            <FolderTree size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">
            {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
          </div>
          <div className="sales-metric-sub">
            <span className="kpi-badge kpi-badge-neutral">{totalStockUnits.toLocaleString()} units</span>
            <span>Across catalog lines</span>
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <Boxes size={14} />
            <span>All Catalog Items</span>
            <span className="sales-subnav-badge">{data.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'pricing' ? 'active' : ''}`}
            onClick={() => setActiveTab('pricing')}
          >
            <Tag size={14} />
            <span>Pricing & Valuation</span>
            <span className="sales-subnav-badge">{data.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'thresholds' ? 'active' : ''}`}
            onClick={() => setActiveTab('thresholds')}
          >
            <SlidersHorizontal size={14} />
            <span>Stock & Reorder Rules</span>
            {lowStockCount > 0 ? (
              <span className="sales-subnav-badge" style={{ color: '#d97706', background: 'rgba(245, 158, 11, 0.15)' }}>
                {lowStockCount} low
              </span>
            ) : (
              <span className="sales-subnav-badge">Healthy</span>
            )}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={exportCatalogCSV}
            title="Export filtered catalog to CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>

          {onNewItem && (
            <button
              type="button"
              className="button button-primary"
              onClick={onNewItem}
            >
              <Plus size={13} />
              <span>New item</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. SUB-TAB 1: All Catalog Items Register */}
      {activeTab === 'catalog' && (
        <>
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${typeFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setTypeFilter('ALL')}
              >
                All <span className="sales-pill-count">{data.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${typeFilter === 'FINISHED' ? 'active' : ''}`}
                onClick={() => setTypeFilter('FINISHED')}
              >
                Finished <span className="sales-pill-count">{finishedCount}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${typeFilter === 'RAW' ? 'active' : ''}`}
                onClick={() => setTypeFilter('RAW')}
              >
                Raw <span className="sales-pill-count">{rawCount}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${typeFilter === 'WIP' ? 'active' : ''}`}
                onClick={() => setTypeFilter('WIP')}
              >
                WIP <span className="sales-pill-count">{wipCount}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${typeFilter === 'SERVICE' ? 'active' : ''}`}
                onClick={() => setTypeFilter('SERVICE')}
              >
                Services <span className="sales-pill-count">{serviceCount}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${typeFilter === 'LOW_STOCK' ? 'active' : ''}`}
                onClick={() => setTypeFilter('LOW_STOCK')}
              >
                Low Stock {lowStockCount > 0 && <span className="sales-pill-count" style={{ color: '#d97706' }}>{lowStockCount}</span>}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {categories.length > 1 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--sp-border)',
                    background: 'var(--sp-surface)',
                    color: 'var(--sp-text)'
                  }}
                  aria-label="Filter by Category"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}

              <div className="sales-search-box">
                <Search size={14} className="sales-search-icon" />
                <input
                  className="sales-search-input"
                  placeholder="Search catalog by name, SKU, or category..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd className="sales-search-kbd">/</kbd>
              </div>
            </div>
          </div>

          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>PRODUCT & SPECIFICATION</th>
                    <th style={{ width: '110px' }}>SKU</th>
                    <th style={{ width: '120px' }}>TYPE</th>
                    <th style={{ width: '90px' }}>ON HAND</th>
                    <th style={{ width: '110px' }}>RESERVED / AVAIL</th>
                    <th style={{ width: '100px' }}>UNIT PRICE</th>
                    <th style={{ width: '95px' }}>STATUS</th>
                    <th style={{ width: '155px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="sales-empty-cell">
                        <div className="sales-empty-state">
                          <Boxes size={32} className="sales-empty-icon" />
                          <div className="sales-empty-title">No catalog items found</div>
                          <div className="sales-empty-desc">
                            {query || categoryFilter !== 'ALL' || typeFilter !== 'ALL'
                              ? 'No products match your current filters.'
                              : 'Add your first catalog item to start selling and manufacturing.'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const typeClass = (item.itemType || 'finished').toLowerCase();
                      const typeLabels: Record<string, string> = {
                        RAW: 'Raw Material',
                        WIP: 'Work in Progress',
                        FINISHED: 'Finished Good',
                        SERVICE: 'Service'
                      };

                      return (
                        <tr key={item.sku} className="sales-row">
                          {/* Product & Spec */}
                          <td>
                            <div className="sales-customer-cell">
                              <span className={`sales-customer-avatar ${item.tone || 'lavender'}`}>
                                {item.mark}
                              </span>
                              <div className="customer-info-cell" style={{ minWidth: 0, overflow: 'hidden' }}>
                                <strong
                                  style={{
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                    maxWidth: '220px',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => setSpecsItem(item)}
                                  title="View product details"
                                >
                                  {item.name}
                                </strong>
                                <small>Category: {item.category}</small>
                              </div>
                            </div>
                          </td>

                          {/* SKU */}
                          <td>
                            <button
                              type="button"
                              className="sales-ref-badge interactive"
                              onClick={() => setSpecsItem(item)}
                              title="Inspect product specifications"
                            >
                              {item.sku}
                            </button>
                          </td>

                          {/* Item Type */}
                          <td>
                            <span className={`product-type-badge ${typeClass}`}>
                              {typeLabels[item.itemType] || 'Finished Good'}
                            </span>
                          </td>

                          {/* On Hand */}
                          <td>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {item.stock.toLocaleString()}
                            </span>{' '}
                            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>{item.unit}</span>
                          </td>

                          {/* Reserved / Avail */}
                          <td>
                            <div style={{ fontSize: '11.5px', color: isItemLowStock(item) ? '#d97706' : 'var(--sp-text)' }}>
                              <strong>{Number(item.available ?? item.stock).toLocaleString()}</strong> avail
                            </div>
                            <small style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)' }}>
                              {Number(item.reserved || 0).toLocaleString()} reserved
                            </small>
                          </td>

                          {/* Unit Price */}
                          <td>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(item.unitPrice || item.price)}
                            </span>
                          </td>

                          {/* Status */}
                          <td>
                            <Status label={item.state} />
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'right' }}>
                            <div className="sales-actions-cell" style={{ justifyContent: 'flex-end', gap: '5px' }}>
                              <CustomFieldEditor resource="items" recordId={item.id} label="Fields" />

                              <button
                                type="button"
                                className="sales-action-btn secondary"
                                onClick={() => setSpecsItem(item)}
                                title="View specifications"
                              >
                                Specs
                              </button>

                              <button
                                type="button"
                                className="sales-action-btn secondary"
                                onClick={() => setEditingItem(item)}
                                title="Edit item pricing and details"
                              >
                                <Edit2 size={11} />
                                <span>Edit</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 4. SUB-TAB 2: Pricing & Valuation Register */}
      {activeTab === 'pricing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Pricing Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sales-metric-label">TOTAL ASSET VALUATION</span>
                <IndianRupee size={15} color="#8b5cf6" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--sp-text)', margin: '4px 0 2px' }}>
                {formatCurrency(totalValuation)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                Across {data.length} registered products
              </div>
            </div>

            <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sales-metric-label">FINISHED GOODS VALUATION</span>
                <Package size={15} color="#10b981" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--sp-text)', margin: '4px 0 2px' }}>
                {formatCurrency(
                  data
                    .filter((i) => (i.itemType || 'FINISHED') === 'FINISHED')
                    .reduce((acc, i) => acc + parseAmount(i.unitPrice || i.price) * (i.stock || 0), 0)
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                {finishedCount} saleable finished products
              </div>
            </div>

            <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sales-metric-label">RAW MATERIALS & WIP ASSETS</span>
                <Boxes size={15} color="#0284c7" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--sp-text)', margin: '4px 0 2px' }}>
                {formatCurrency(
                  data
                    .filter((i) => ['RAW', 'WIP'].includes((i.itemType || '').toUpperCase()))
                    .reduce((acc, i) => acc + parseAmount(i.unitPrice || i.price) * (i.stock || 0), 0)
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                {rawCount + wipCount} production inputs
              </div>
            </div>
          </div>

          {/* Pricing Toolbar */}
          <div className="sales-toolbar" style={{ marginTop: '2px' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text-secondary)' }}>
              Pricing & commercial valuation by SKU
            </div>
            <div className="sales-search-box">
              <Search size={14} className="sales-search-icon" />
              <input
                className="sales-search-input"
                placeholder="Filter pricing items..."
                value={pricingQuery}
                onChange={(e) => setPricingQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Pricing Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>PRODUCT</th>
                    <th style={{ width: '120px' }}>SKU</th>
                    <th style={{ width: '100px' }}>UNIT</th>
                    <th style={{ minWidth: '120px' }}>UNIT PRICE</th>
                    <th style={{ width: '110px' }}>ON HAND</th>
                    <th style={{ minWidth: '140px' }}>BOOK VALUATION</th>
                    <th style={{ width: '130px' }}>SALES STATUS</th>
                    <th style={{ minWidth: '120px', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPricingItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="sales-empty-cell">
                        <div className="sales-empty-state">
                          <Tag size={28} className="sales-empty-icon" />
                          <div className="sales-empty-title">No pricing items found</div>
                          <div className="sales-empty-desc">No products match your search filter.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPricingItems.map((item) => {
                      const price = parseAmount(item.unitPrice || item.price);
                      const stock = item.stock || 0;
                      const valuation = price * stock;

                      return (
                        <tr key={item.sku} className="sales-row">
                          <td>
                            <strong
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSpecsItem(item)}
                              title="Inspect specifications"
                            >
                              {item.name}
                            </strong>
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>{item.category}</div>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="sales-ref-badge interactive"
                              onClick={() => setSpecsItem(item)}
                            >
                              {item.sku}
                            </button>
                          </td>

                          <td>
                            <span className="sales-warehouse-pill">{item.unit}</span>
                          </td>

                          <td>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(price)}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: '12.5px', color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {stock.toLocaleString()}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(valuation)}
                            </span>
                          </td>

                          <td>
                            <span className="customer-risk-chip good">
                              <Check size={11} /> Ready to Quote
                            </span>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              onClick={() => setEditingItem(item)}
                            >
                              Edit Price
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
        </div>
      )}

      {/* 5. SUB-TAB 3: Stock & Reorder Rules Register */}
      {activeTab === 'thresholds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Threshold Health Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sales-metric-label">OPERATING SAFETY RATIO</span>
                {lowStockCount > 0 ? <AlertTriangle size={15} color="#d97706" /> : <CheckCircle2 size={15} color="#10b981" />}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: lowStockCount > 0 ? '#d97706' : 'var(--sp-text)', margin: '4px 0 2px' }}>
                {inStockPct}% In Stock
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                {data.length - lowStockCount} of {data.length} products above threshold
              </div>
            </div>

            <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sales-metric-label">REORDER ALERTS</span>
                {lowStockCount > 0 ? <AlertTriangle size={15} color="#d97706" /> : <CheckCircle2 size={15} color="#10b981" />}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: lowStockCount > 0 ? '#d97706' : 'var(--sp-text)', margin: '4px 0 2px' }}>
                {lowStockCount} {lowStockCount === 1 ? 'Item' : 'Items'} to Restock
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                Requires PO or manufacturing work order
              </div>
            </div>
          </div>

          {/* Thresholds Toolbar */}
          <div className="sales-toolbar" style={{ marginTop: '2px' }}>
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${thresholdFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setThresholdFilter('ALL')}
              >
                All Rules <span className="sales-pill-count">{data.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${thresholdFilter === 'LOW' ? 'active' : ''}`}
                onClick={() => setThresholdFilter('LOW')}
              >
                Low Stock Alerts <span className="sales-pill-count" style={{ color: lowStockCount > 0 ? '#d97706' : undefined }}>{lowStockCount}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${thresholdFilter === 'SAFE' ? 'active' : ''}`}
                onClick={() => setThresholdFilter('SAFE')}
              >
                Healthy Stock <span className="sales-pill-count">{data.length - lowStockCount}</span>
              </button>
            </div>

            <div className="sales-search-box">
              <Search size={14} className="sales-search-icon" />
              <input
                className="sales-search-input"
                placeholder="Filter rules by SKU or product..."
                value={thresholdQuery}
                onChange={(e) => setThresholdQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Threshold Rules Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>PRODUCT & SKU</th>
                    <th style={{ width: '130px' }}>TYPE</th>
                    <th style={{ width: '110px' }}>ON HAND</th>
                    <th style={{ width: '100px' }}>RESERVED</th>
                    <th style={{ width: '110px' }}>AVAILABLE</th>
                    <th style={{ minWidth: '130px' }}>REORDER AT</th>
                    <th style={{ width: '130px' }}>HEALTH</th>
                    <th style={{ minWidth: '140px', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredThresholdItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="sales-empty-cell">
                        <div className="sales-empty-state">
                          <SlidersHorizontal size={28} className="sales-empty-icon" />
                          <div className="sales-empty-title">No threshold rules match</div>
                          <div className="sales-empty-desc">No products match your current threshold filter.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredThresholdItems.map((item) => {
                      const isLow = isItemLowStock(item);

                      return (
                        <tr key={item.sku} className="sales-row">
                          <td>
                            <strong
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSpecsItem(item)}
                              title="Inspect specifications"
                            >
                              {item.name}
                            </strong>
                            <div style={{ marginTop: '2px' }}>
                              <button
                                type="button"
                                className="sales-ref-badge interactive"
                                onClick={() => setSpecsItem(item)}
                              >
                                {item.sku}
                              </button>
                            </div>
                          </td>

                          <td>
                            <span className={`product-type-badge ${(item.itemType || 'finished').toLowerCase()}`}>
                              {item.itemType || 'FINISHED'}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                              {item.stock} {item.unit}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                              {item.reserved || 0} {item.unit}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: '12.5px', fontWeight: 500, color: isLow ? '#d97706' : 'var(--sp-text)' }}>
                              {item.available ?? item.stock} {item.unit}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: '12.5px', color: 'var(--sp-text)' }}>
                              ≤ <strong>{item.lowStockThreshold}</strong> {item.unit}
                            </span>
                          </td>

                          <td>
                            {isLow ? (
                              <span className="customer-risk-chip hold">
                                <AlertTriangle size={10} /> Low Stock
                              </span>
                            ) : (
                              <span className="customer-risk-chip good">
                                <CheckCircle2 size={10} /> Safe
                              </span>
                            )}
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              onClick={() => setThresholdItem(item)}
                            >
                              Set Threshold
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
        </div>
      )}

      {/* 6. Modals & Drawers */}
      {editingItem && (
        <EditProductModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onRefresh={onRefresh}
          notify={notify}
        />
      )}

      {thresholdItem && (
        <EditThresholdModal
          item={thresholdItem}
          onClose={() => setThresholdItem(null)}
          onRefresh={onRefresh}
          notify={notify}
        />
      )}

      {specsItem && (
        <ProductSpecsDrawer
          item={specsItem}
          onClose={() => setSpecsItem(null)}
          onEdit={() => setEditingItem(specsItem)}
          onThreshold={() => setThresholdItem(specsItem)}
        />
      )}
    </div>
  );
}
