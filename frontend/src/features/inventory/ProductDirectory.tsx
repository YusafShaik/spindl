import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  Download,
  Edit2,
  ExternalLink,
  Filter,
  IndianRupee,
  Layers,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Warehouse,
  Wrench,
  X
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { CustomFieldEditor } from '../customers/CustomFieldEditor';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import type { InventoryMovement, ItemSummary } from '../../types/inventory';
import type { ManufacturingBom } from '../manufacturing/ManufacturingPanel';

export interface ProductDirectoryProps {
  title: string;
  subtitle: string;
  query: string;
  setQuery: (query: string) => void;
  data: ItemSummary[];
  allItems?: ItemSummary[];
  movements?: InventoryMovement[];
  boms?: ManufacturingBom[];
  notify: (message: string) => void;
  onAdjust?: ((item: ItemSummary) => void) | null;
  onThreshold?: ((item: ItemSummary) => void) | null;
  onNewItem?: () => void;
  onRefresh?: () => Promise<void>;
  role?: string;
}

type ProductSubTab = 'catalog' | 'pricing' | 'thresholds' | 'boms';
type ItemTypeFilter = 'ALL' | 'FINISHED' | 'RAW' | 'WIP' | 'SERVICE' | 'LOW_STOCK';

function parseAmount(val: string | number | null | undefined): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
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
  const [barcode, setBarcode] = useState(item.barcode || '');
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
        itemType: itemType.trim().toUpperCase(),
        barcode: barcode.trim() || null
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

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
              Barcode (EAN-13 / Code-128)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                disabled={saving}
                placeholder="Optional scanner barcode..."
                style={{ width: '100%', height: '34px', padding: '0 10px 0 30px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}
              />
              <Barcode size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--sp-text-muted)' }} />
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
  boms?: ManufacturingBom[];
  onClose: () => void;
  onEdit?: () => void;
}

function ProductSpecsDrawer({ item, boms = [], onClose, onEdit }: ProductSpecsDrawerProps) {
  const associatedBom = boms.find((b) => b.finishedItemId === item.id || b.finishedSku === item.sku);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="record-modal" style={{ width: 'min(580px, 95vw)', maxHeight: '88vh' }}>
        <div className="modal-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`sales-customer-avatar ${item.tone || 'lavender'}`}>
              {item.mark}
            </span>
            <div>
              <h2>{item.name}</h2>
              <p>SKU: <code>{item.sku}</code> · {item.category}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>

        {/* Spec Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ padding: '10px 12px', background: 'var(--sp-surface-hover)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', textTransform: 'uppercase', fontWeight: 500 }}>Commercial Price</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--sp-text)', marginTop: '2px' }}>
              {formatCurrency(item.unitPrice || item.price)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)' }}>Per {item.unit}</div>
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--sp-surface-hover)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', textTransform: 'uppercase', fontWeight: 500 }}>Total Book Value</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--sp-text)', marginTop: '2px' }}>
              {formatCurrency(parseAmount(item.unitPrice || item.price) * (item.stock || 0))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)' }}>Based on {item.stock} {item.unit} in stock</div>
          </div>
        </div>

        {/* Details Table */}
        <div style={{ border: '1px solid var(--sp-border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--sp-surface-hover)', fontSize: '11.5px', borderBottom: '1px solid var(--sp-border)' }}>
            <span style={{ color: 'var(--sp-text-secondary)' }}>Item Classification</span>
            <span className={`product-type-badge ${item.itemType?.toLowerCase() || 'finished'}`}>
              {({ RAW: 'Raw Material', WIP: 'Work in Progress', FINISHED: 'Finished Good', SERVICE: 'Service' })[item.itemType] || 'Finished Good'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '11.5px', borderBottom: '1px solid var(--sp-border)' }}>
            <span style={{ color: 'var(--sp-text-secondary)' }}>Barcode / GTIN</span>
            <span className="product-barcode-chip">
              <Barcode size={12} /> {item.barcode || 'Not assigned'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--sp-surface-hover)', fontSize: '11.5px', borderBottom: '1px solid var(--sp-border)' }}>
            <span style={{ color: 'var(--sp-text-secondary)' }}>Stock Status</span>
            <Status label={item.state} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '11.5px', borderBottom: '1px solid var(--sp-border)' }}>
            <span style={{ color: 'var(--sp-text-secondary)' }}>Stock Allocation</span>
            <span><strong>{item.stock}</strong> on hand · <strong>{item.reserved || 0}</strong> reserved · <strong>{item.available ?? item.stock}</strong> available</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--sp-surface-hover)', fontSize: '11.5px' }}>
            <span style={{ color: 'var(--sp-text-secondary)' }}>Reorder Threshold</span>
            <span><strong>{item.lowStockThreshold}</strong> {item.unit}</span>
          </div>
        </div>

        {/* BOM Linkage */}
        {associatedBom && (
          <div style={{ padding: '12px', background: 'var(--sp-surface-subtle)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} style={{ color: 'var(--sp-brand)' }} />
                <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)' }}>Active Bill of Materials ({associatedBom.revision})</span>
              </div>
              <span className="sales-status-chip completed">{associatedBom.status}</span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
              Engineered with {associatedBom.lines?.length || 0} component lines. Effective from {associatedBom.effectiveFrom}.
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {onEdit && (
            <button
              type="button"
              className="sales-action-btn secondary"
              onClick={() => {
                onClose();
                onEdit();
              }}
            >
              <Edit2 size={13} /> Edit Specification
            </button>
          )}
          <button type="button" className="button button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductDirectory({
  title,
  subtitle,
  query,
  setQuery,
  data,
  allItems = [],
  boms: initialBoms,
  notify,
  onAdjust,
  onThreshold,
  onNewItem,
  onRefresh
}: ProductDirectoryProps) {
  const [activeTab, setActiveTab] = useState<ProductSubTab>('catalog');
  const [typeFilter, setTypeFilter] = useState<ItemTypeFilter>('ALL');
  const [editingItem, setEditingItem] = useState<ItemSummary | null>(null);
  const [thresholdItem, setThresholdItem] = useState<ItemSummary | null>(null);
  const [specsItem, setSpecsItem] = useState<ItemSummary | null>(null);

  // BOM state
  const [boms, setBoms] = useState<ManufacturingBom[]>(initialBoms || []);
  const [selectedBomId, setSelectedBomId] = useState<string>('');

  // Fetch BOMs if not provided
  useEffect(() => {
    let current = true;
    apiFetch(`${API}/boms`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: ManufacturingBom[]) => {
        if (current && Array.isArray(rows)) {
          setBoms(rows);
          if (rows.length > 0 && !selectedBomId) {
            setSelectedBomId(rows[0].id);
          }
        }
      })
      .catch(() => {
        // Soft fallback
      });
    return () => {
      current = false;
    };
  }, []);

  // Executive KPI Calculations across catalog items
  const { totalValuation, finishedCount, rawCount, wipCount, serviceCount, lowStockCount, inStockPct } =
    useMemo(() => {
      let sumValuation = 0;
      let finished = 0;
      let raw = 0;
      let wip = 0;
      let service = 0;
      let low = 0;

      for (const item of data) {
        const price = parseAmount(item.unitPrice || item.price);
        const stock = item.stock || 0;
        sumValuation += price * stock;

        const type = (item.itemType || 'FINISHED').toUpperCase();
        if (type === 'FINISHED') finished++;
        else if (type === 'RAW') raw++;
        else if (type === 'WIP') wip++;
        else if (type === 'SERVICE') service++;

        const isLow = (item.available ?? item.stock) <= (item.lowStockThreshold || 0);
        if (isLow && type !== 'SERVICE') low++;
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
        inStockPct
      };
    }, [data]);

  // Tab 1 Filtered Items
  const filteredItems = useMemo(() => {
    return data.filter((item) => {
      const type = (item.itemType || 'FINISHED').toUpperCase();
      if (typeFilter === 'FINISHED') return type === 'FINISHED';
      if (typeFilter === 'RAW') return type === 'RAW';
      if (typeFilter === 'WIP') return type === 'WIP';
      if (typeFilter === 'SERVICE') return type === 'SERVICE';
      if (typeFilter === 'LOW_STOCK') return (item.available ?? item.stock) <= (item.lowStockThreshold || 0);
      return true;
    });
  }, [data, typeFilter]);

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
      'Stock State',
      'Barcode'
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
        `"${item.state}"`,
        `"${item.barcode || ''}"`
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

  const selectedBom = boms.find((b) => b.id === selectedBomId) || boms[0];

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
            <span className="sales-metric-label">ENGINEERING & ASSEMBLIES</span>
            <Layers size={14} className="sales-metric-icon" aria-hidden="true" />
          </div>
          <div className="sales-metric-val">
            {boms.length} Active {boms.length === 1 ? 'Spec' : 'Specs'}
          </div>
          <div className="sales-metric-sub">
            <span className="kpi-badge kpi-badge-neutral">BOMs</span>
            <span>Production sub-assemblies</span>
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

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'boms' ? 'active' : ''}`}
            onClick={() => setActiveTab('boms')}
          >
            <Layers size={14} />
            <span>BOM & Assemblies</span>
            <span className="sales-subnav-badge">{boms.length} specs</span>
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

            <div className="sales-search-box">
              <Search size={14} className="sales-search-icon" />
              <input
                className="sales-search-input"
                placeholder="Search catalog by name, SKU, barcode, or category..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd className="sales-search-kbd">/</kbd>
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
                            {query ? 'No products match your search query.' : 'Add your first catalog item to start selling and manufacturing.'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const typeClass = (item.itemType || 'finished').toLowerCase();

                      return (
                        <tr key={item.sku} className="sales-row">
                          {/* Product & Spec */}
                          <td>
                            <div className="sales-customer-cell">
                              <span className={`sales-customer-avatar ${item.tone || 'lavender'}`}>
                                {item.mark}
                              </span>
                              <div className="customer-info-cell" style={{ minWidth: 0, overflow: 'hidden' }}>
                                <strong style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block', maxWidth: '220px' }}>{item.name}</strong>
                                <small>Category: {item.category}</small>
                                {item.barcode && (
                                  <div style={{ marginTop: '2px' }}>
                                    <span className="product-barcode-chip">
                                      <Barcode size={10} /> {item.barcode}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* SKU */}
                          <td>
                            <span className="sales-ref-badge">{item.sku}</span>
                          </td>

                          {/* Item Type */}
                          <td>
                            <span className={`product-type-badge ${typeClass}`}>
                              {({ RAW: 'Raw Material', WIP: 'Work in Progress', FINISHED: 'Finished Good', SERVICE: 'Service' })[item.itemType] || 'Finished Good'}
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
                            <div style={{ fontSize: '11.5px', color: 'var(--sp-text)' }}>
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
                  {data.map((item) => {
                    const price = parseAmount(item.unitPrice || item.price);
                    const stock = item.stock || 0;
                    const valuation = price * stock;

                    return (
                      <tr key={item.sku} className="sales-row">
                        <td>
                          <strong>{item.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>{item.category}</div>
                        </td>

                        <td>
                          <span className="sales-ref-badge">{item.sku}</span>
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
                  })}
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
                <CheckCircle2 size={15} color="#10b981" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--sp-text)', margin: '4px 0 2px' }}>
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
                {lowStockCount} Items to Restock
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                Requires PO or manufacturing work order
              </div>
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
                  {data.map((item) => {
                    const isLow = (item.available ?? item.stock) <= (item.lowStockThreshold || 0);

                    return (
                      <tr key={item.sku} className="sales-row">
                        <td>
                          <strong>{item.name}</strong>
                          <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {item.sku}
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
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. SUB-TAB 4: BOM & Assemblies Register */}
      {activeTab === 'boms' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '16px' }}>
          {/* BOM Finished Goods Selector */}
          <div className="sales-table-card" style={{ padding: '14px', height: 'fit-content' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--sp-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Engineered Assemblies ({boms.length})
            </div>
            {boms.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                No active BOMs found in workspace.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {boms.map((bom) => {
                  const isSelected = bom.id === selectedBomId || (selectedBom && selectedBom.id === bom.id);

                  return (
                    <button
                      key={bom.id}
                      type="button"
                      onClick={() => setSelectedBomId(bom.id)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--sp-brand)' : 'var(--sp-border)',
                        background: isSelected ? 'var(--sp-brand-soft)' : 'var(--sp-surface)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '12.5px', color: isSelected ? 'var(--sp-brand)' : 'var(--sp-text)' }}>
                          {bom.finishedItemName || bom.finishedSku}
                        </strong>
                        <span className="sales-ref-badge" style={{ fontSize: '10px' }}>{bom.revision}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '4px' }}>
                        <span>{bom.lines?.length || 0} components</span>
                        <span style={{ color: '#059669', fontWeight: 600 }}>{bom.status}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* BOM Specification Card */}
          <div className="sales-table-card" style={{ padding: '16px 20px' }}>
            {selectedBom ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '14px', borderBottom: '1px solid var(--sp-border)', marginBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
                        {selectedBom.finishedItemName}
                      </h3>
                      <span className="sales-ref-badge">{selectedBom.finishedSku}</span>
                      <span className="sales-status-chip completed">{selectedBom.status}</span>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', margin: '4px 0 0' }}>
                      Revision: <strong>{selectedBom.revision}</strong> · Effective from: {selectedBom.effectiveFrom}
                    </p>
                  </div>
                </div>

                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '10px' }}>
                  Components & Raw Materials Required per 1 Unit:
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedBom.lines && selectedBom.lines.length > 0 ? (
                    selectedBom.lines.map((line, idx) => {
                      const compItem = data.find((it) => it.id === line.componentItemId || it.sku === line.sku);
                      const compUnit = compItem?.unit || 'units';

                      return (
                        <div key={line.id || idx} className="product-bom-component-row">
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong style={{ fontSize: '13px', color: 'var(--sp-text)' }}>{line.itemName || line.sku}</strong>
                              <span className="sales-ref-badge" style={{ fontSize: '10.5px' }}>{line.sku}</span>
                            </div>
                            {line.alternativeGroup && (
                              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                                Alt Group: {line.alternativeGroup}
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {line.quantityPerUnit} {compUnit} / unit
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)', marginTop: '1px' }}>
                              Scrap allowance: {line.scrapAllowancePercent}%
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                      No components defined in this BOM revision.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="sales-empty-state" style={{ padding: '60px 20px' }}>
                <Layers size={36} className="sales-empty-icon" />
                <div className="sales-empty-title">Select a Bill of Materials</div>
                <div className="sales-empty-desc">
                  Choose a finished product on the left to inspect its multi-level component structure and scrap allowances.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. ERP Product Engineering & Catalog Governance Guide */}
      <div className="sales-pipeline-banner">
        <div className="sales-pipeline-header">
          <div className="sales-pipeline-title">
            <span className="sales-pipeline-dot" />
            <span>Product Lifecycle & Engineering Catalog Governance</span>
          </div>
          <span className="sales-pipeline-tag">ISO 9001 · ERP Master Data</span>
        </div>

        <div className="sales-pipeline-stages">
          <div className="sales-pipeline-step">
            <div className="sales-step-num">01</div>
            <div className="sales-step-content">
              <b>Specification & SKU</b>
              <span>Item typing (Finished, Raw, WIP, Service) & barcode mapping</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">02</div>
            <div className="sales-step-content">
              <b>Costing & Pricing</b>
              <span>Unit pricing, asset book valuation & commercial margins</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">03</div>
            <div className="sales-step-content">
              <b>Engineering & BOMs</b>
              <span>Component consumption, scrap allowances & revision control</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">04</div>
            <div className="sales-step-content">
              <b>Stock Thresholds</b>
              <span>Reorder level alarms, safety stock & replenishment rules</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">05</div>
            <div className="sales-step-content">
              <b>Commercial Release</b>
              <span>Quotation availability, POS sales & customer fulfillments</span>
            </div>
          </div>
        </div>
      </div>

      {/* 8. Modals & Drawers */}
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
          boms={boms}
          onClose={() => setSpecsItem(null)}
          onEdit={() => setEditingItem(specsItem)}
        />
      )}
    </div>
  );
}
