import { useEffect, useState, type FormEvent, type MouseEvent, type SetStateAction, type Dispatch } from 'react';
import { Plus } from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';
import type { ItemSummary } from '../../types/inventory';
import type { PurchaseOrder, PurchaseRequisition, ReorderSuggestion, SupplierSummary } from '../../types/purchasing';

interface PurchaseRequisitionPanelProps {
  requisitions: PurchaseRequisition[];
  suppliers: SupplierSummary[];
  items: ItemSummary[];
  role?: string;
  notify: (message: string) => void;
  onRequisitions: Dispatch<SetStateAction<PurchaseRequisition[]>>;
  onCreatedOrder: (order: PurchaseOrder) => void;
}

interface RequisitionDraftLine {
  itemId: string;
  quantity: string | number;
}

interface SelectedReorderLine {
  quantity: string | number;
  unitPrice: string;
}

type ReorderSelection = Record<string, SelectedReorderLine>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function apiError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  return new Error(body.detail || body.message || fallback);
}

export function PurchaseRequisitionPanel({ requisitions, suppliers, items, role, notify, onRequisitions, onCreatedOrder }: PurchaseRequisitionPanelProps) {
  const [creating, setCreating] = useState(false);
  const [converting, setConverting] = useState<PurchaseRequisition | null>(null);
  const [rejecting, setRejecting] = useState<PurchaseRequisition | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestKey, setRequestKey] = useState('');
  const [conversionKey, setConversionKey] = useState('');
  const [lines, setLines] = useState<RequisitionDraftLine[]>([{ itemId: '', quantity: 1 }]);

  const openCreate = (): void => {
    setLines([{ itemId: '', quantity: 1 }]);
    setRequestKey(crypto.randomUUID());
    setCreating(true);
  };
  const updateLine = (index: number, key: keyof RequisitionDraftLine, value: string): void => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
  };

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      idempotencyKey: requestKey,
      needByDate: form.get('needByDate') || null,
      notes: form.get('notes') || null,
      lines: lines.filter((line) => line.itemId).map((line) => ({ itemId: line.itemId, quantity: Number(line.quantity) })),
    };
    if (!payload.lines.length) { notify('Add at least one item'); return; }
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/purchase-requisitions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw await apiError(response, 'Could not submit requisition');
      const body: PurchaseRequisition = await response.json();
      onRequisitions((current) => [body, ...current.filter((row) => row.id !== body.id)]);
      setCreating(false);
      setRequestKey('');
      notify(`${body.requisitionNumber} submitted for approval`);
    } catch (error) { notify(getErrorMessage(error)); }
    finally { setSaving(false); }
  };

  const approve = async (requisition: PurchaseRequisition): Promise<void> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/purchase-requisitions/${requisition.id}/approve`, { method: 'POST' });
      if (!response.ok) throw await apiError(response, 'Could not approve requisition');
      const body: PurchaseRequisition = await response.json();
      onRequisitions((current) => current.map((row) => row.id === body.id ? body : row));
      notify(`${body.requisitionNumber} approved`);
    } catch (error) { notify(getErrorMessage(error)); }
    finally { setSaving(false); }
  };

  const reject = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!rejecting) return;
    const reason = new FormData(event.currentTarget).get('reason');
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/purchase-requisitions/${rejecting.id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
      if (!response.ok) throw await apiError(response, 'Could not reject requisition');
      const body: PurchaseRequisition = await response.json();
      onRequisitions((current) => current.map((row) => row.id === body.id ? body : row));
      setRejecting(null);
      notify(`${body.requisitionNumber} rejected`);
    } catch (error) { notify(getErrorMessage(error)); }
    finally { setSaving(false); }
  };

  const convert = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!converting) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      idempotencyKey: conversionKey,
      supplierId: form.get('supplierId'),
      lines: converting.lines.map((line) => ({ requisitionLineId: line.id, unitPrice: Number(form.get(`price-${line.id}`)) })),
    };
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/purchase-requisitions/${converting.id}/convert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw await apiError(response, 'Could not convert requisition');
      const body: PurchaseOrder = await response.json();
      const requisitionResponse = await apiFetch(`${API}/purchase-requisitions`);
      if (!requisitionResponse.ok) throw new Error('Purchase order created, but requisition list did not refresh');
      onRequisitions(await requisitionResponse.json());
      onCreatedOrder(body);
      setConverting(null);
      setConversionKey('');
      notify(`${body.orderNumber} created as a draft purchase order`);
    } catch (error) { notify(getErrorMessage(error)); }
    finally { setSaving(false); }
  };
  const openConvert = (requisition: PurchaseRequisition): void => { setConverting(requisition); setConversionKey(crypto.randomUUID()); };
  const managers = ['OWNER', 'ADMIN', 'MANAGER'].includes(role ?? '');
  const closeOnBackdrop = (event: MouseEvent<HTMLDivElement>, close: () => void): void => {
    if (event.target === event.currentTarget && !saving) close();
  };

  return <>
    <div className="sales-table-card">
      <div className="sales-toolbar" style={{ padding: '12px 16px', borderBottom: '1px solid var(--sp-border)', marginBottom: 0 }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
            Internal Requisitions <span className="sales-subnav-badge" style={{ marginLeft: '6px' }}>{requisitions.length}</span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
            Submit an item request, get manager approval, then convert it into a supplier PO.
          </div>
        </div>
        <button type="button" className="sales-action-btn primary" onClick={openCreate}>
          <Plus size={13} /> New requisition
        </button>
      </div>

      <div className="sales-table-scroll">
        <table className="sales-table">
          <thead>
            <tr>
              <th style={{ width: '150px' }}>REQUISITION #</th>
              <th style={{ width: '120px' }}>NEED BY</th>
              <th>REQUESTED ITEMS</th>
              <th style={{ width: '120px' }}>STATUS</th>
              <th style={{ width: '140px' }}>PURCHASE ORDER</th>
              <th style={{ width: '180px', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {requisitions.length ? (
              requisitions.map((requisition) => (
                <tr key={requisition.id} className="sales-row">
                  <td>
                    <span className="sales-ref-badge">{requisition.requisitionNumber}</span>
                  </td>
                  <td>
                    <span className="sales-date-cell">{requisition.needByDate || '—'}</span>
                  </td>
                  <td>
                    <div className="sales-items-preview">
                      {requisition.lines.map((line, idx) => (
                        <span key={line.id || idx} className="sales-item-tag">
                          <span className="sales-item-sku">{line.sku}</span>
                          <span className="sales-item-qty">× {line.quantity}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Status label={requisition.status.toLowerCase().replace('_', ' ')} />
                  </td>
                  <td>
                    {requisition.purchaseOrderNumber ? (
                      <span className="sales-ref-badge">{requisition.purchaseOrderNumber}</span>
                    ) : (
                      <span className="sales-sub-ref">—</span>
                    )}
                  </td>
                  <td>
                    <div className="sales-actions-cell">
                      {requisition.status === 'SUBMITTED' && managers && (
                        <>
                          <button
                            type="button"
                            className="sales-action-btn primary"
                            disabled={saving}
                            onClick={() => void approve(requisition)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="sales-action-btn ghost"
                            disabled={saving}
                            onClick={() => setRejecting(requisition)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {requisition.status === 'APPROVED' && (
                        <button
                          type="button"
                          className="sales-action-btn primary"
                          disabled={saving}
                          onClick={() => openConvert(requisition)}
                        >
                          Create draft PO
                        </button>
                      )}
                      {requisition.status === 'CONVERTED' && (
                        <span className="sales-status-chip completed">Converted</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="sales-empty-cell">
                  <div className="sales-empty-state">
                    <div className="sales-empty-title">No purchase requisitions yet</div>
                    <div className="sales-empty-desc">
                      Add an internal item request to trigger manager approval and supplier PO conversion.
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    {creating && <div className="modal-backdrop" onMouseDown={(event) => closeOnBackdrop(event, () => setCreating(false))}><form className="record-modal" onSubmit={(event) => void create(event)}><div className="modal-title"><div><h2>New purchase requisition</h2><p>Submit quantities for manager approval. Prices are set when purchasing converts it to a PO.</p></div><button type="button" disabled={saving} onClick={() => setCreating(false)}>×</button></div>{lines.map((line, index) => <div className="receive-line" key={index}><label>Item<select value={line.itemId} onChange={(event) => updateLine(index, 'itemId', event.target.value)} required><option value="">Choose item</option>{items.map((item) => <option key={item.id} value={item.id} disabled={lines.some((other, otherIndex) => otherIndex !== index && other.itemId === item.id)}>{item.sku} · {item.name}</option>)}</select></label><label>Quantity<input type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} required/></label>{lines.length > 1 && <button type="button" className="mini-action muted" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Remove line</button>}</div>)}<button type="button" className="mini-action muted" onClick={() => setLines((current) => [...current, { itemId: '', quantity: 1 }])}>Add another item</button><label>Need by<input name="needByDate" type="date"/></label><label>Notes<textarea name="notes" maxLength={1000} rows={3} placeholder="Reason or delivery requirements"/></label><div className="modal-actions"><button className="button button-secondary" type="button" disabled={saving} onClick={() => setCreating(false)}>Cancel</button><button className="button button-primary" disabled={saving || !items.length}>{saving ? 'Submitting…' : 'Submit requisition'}</button></div></form></div>}
    {rejecting && <div className="modal-backdrop" onMouseDown={(event) => closeOnBackdrop(event, () => setRejecting(null))}><form className="record-modal" onSubmit={(event) => void reject(event)}><div className="modal-title"><div><h2>Reject · {rejecting.requisitionNumber}</h2><p>Give the requester a reason for the decision.</p></div><button type="button" disabled={saving} onClick={() => setRejecting(null)}>×</button></div><label>Reason<textarea name="reason" rows={3} maxLength={500} required/></label><div className="modal-actions"><button className="button button-secondary" type="button" disabled={saving} onClick={() => setRejecting(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Rejecting…' : 'Reject request'}</button></div></form></div>}
    {converting && <div className="modal-backdrop" onMouseDown={(event) => closeOnBackdrop(event, () => setConverting(null))}><form className="record-modal" onSubmit={(event) => void convert(event)}><div className="modal-title"><div><h2>Create PO · {converting.requisitionNumber}</h2><p>Choose the supplier and provide a unit price for each requested item.</p></div><button type="button" disabled={saving} onClick={() => setConverting(null)}>×</button></div><label>Supplier<select name="supplierId" required defaultValue=""><option value="">Choose supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} ({supplier.code})</option>)}</select></label>{converting.lines.map((line) => <div className="receive-line" key={line.id}><b>{line.sku} · {line.itemName} × {line.quantity}</b><label>Unit price (₹)<input name={`price-${line.id}`} type="number" min="0" max="999999999999.99" step="0.01" required/></label></div>)}<div className="modal-actions"><button className="button button-secondary" type="button" disabled={saving} onClick={() => setConverting(null)}>Cancel</button><button className="button button-primary" disabled={saving || !suppliers.length}>{saving ? 'Creating…' : 'Create draft PO'}</button></div></form></div>}
  </>;
}

interface ReorderSuggestionsProps {
  suppliers: SupplierSummary[];
  notify: (message: string) => void;
  onCreated: (order: PurchaseOrder) => void;
}

export function ReorderSuggestions({ suppliers, notify, onCreated }: ReorderSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [selection, setSelection] = useState<ReorderSelection>({});
  const [supplierId, setSupplierId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = async (): Promise<void> => {
    const response = await apiFetch(`${API}/purchase-orders/reorder-suggestions`);
    if (!response.ok) throw new Error('Could not load reorder suggestions');
    const rows: ReorderSuggestion[] = await response.json();
    setSuggestions(rows);
  };
  useEffect(() => {
    let current = true;
    apiFetch(`${API}/purchase-orders/reorder-suggestions`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not load reorder suggestions')))
      .then((rows: ReorderSuggestion[]) => { if (current) setSuggestions(rows); })
      .catch((error: unknown) => { if (current) notify(getErrorMessage(error)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);
  const toggle = (item: ReorderSuggestion, checked: boolean): void => setSelection((previous) => {
    const next = { ...previous };
    if (checked) next[item.itemId] = { quantity: item.suggestedQuantity, unitPrice: '' };
    else delete next[item.itemId];
    return next;
  });
  const update = (itemId: string, field: keyof SelectedReorderLine, value: string): void => setSelection((previous) => ({ ...previous, [itemId]: { ...previous[itemId], [field]: value } }));
  const createOrder = async (): Promise<void> => {
    const selected = suggestions.filter((item) => selection[item.itemId]);
    if (!supplierId || !selected.length) return;
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/purchase-orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplierId, notes: 'Draft created from reorder suggestions', lines: selected.map((item) => ({ itemId: item.itemId, quantity: Number(selection[item.itemId].quantity), unitPrice: Number(selection[item.itemId].unitPrice) })) }) });
      if (!response.ok) throw await apiError(response, 'Could not create replenishment order');
      const body: PurchaseOrder = await response.json();
      onCreated(body);
      notify(`${body.orderNumber} created with ${selected.length} replenishment line${selected.length === 1 ? '' : 's'}`);
      setSelection({});
      await load();
    } catch (error) { notify(getErrorMessage(error)); }
    finally { setSaving(false); }
  };
  const selectedCount = Object.keys(selection).length;
  return (
    <div className="sales-table-card">
      <div className="sales-toolbar" style={{ padding: '12px 16px', borderBottom: '1px solid var(--sp-border)', marginBottom: 0 }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
            Reorder Suggestions <span className="sales-subnav-badge" style={{ marginLeft: '6px' }}>{suggestions.length}</span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
            Automated quantities bring available inventory back to minimum thresholds considering open purchase orders.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="sales-empty-cell">
          <div className="sales-empty-state">
            <div className="sales-empty-title">Analyzing stock thresholds…</div>
            <div className="sales-empty-desc">Checking available inventory against reorder points and incoming purchase orders.</div>
          </div>
        </div>
      ) : suggestions.length ? (
        <>
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>SELECT</th>
                  <th style={{ width: '240px' }}>ITEM</th>
                  <th style={{ width: '120px' }}>AVAILABLE</th>
                  <th style={{ width: '120px' }}>THRESHOLD</th>
                  <th style={{ width: '120px' }}>OPEN PO</th>
                  <th style={{ width: '150px' }}>SUGGESTED QTY</th>
                  <th style={{ width: '160px' }}>UNIT COST (₹)</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((item) => (
                  <tr key={item.itemId} className="sales-row">
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.sku}`}
                        checked={!!selection[item.itemId]}
                        onChange={(event) => toggle(item, event.target.checked)}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="sales-ref-badge" style={{ width: 'fit-content' }}>{item.sku}</span>
                        <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>{item.itemName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="sales-fulfillment-tag pending">
                        {item.availableQuantity} {item.unit}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                        {item.reorderThreshold} {item.unit}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                        {item.incomingQuantity} {item.unit}
                      </span>
                    </td>
                    <td>
                      {selection[item.itemId] ? (
                        <input
                          className="sales-search-input"
                          style={{
                            height: '28px',
                            border: '1px solid var(--sp-border)',
                            borderRadius: '4px',
                            padding: '0 6px',
                            width: '90px',
                            background: 'var(--sp-surface)'
                          }}
                          type="number"
                          min="1"
                          max="2147483647"
                          value={selection[item.itemId].quantity}
                          onChange={(event) => update(item.itemId, 'quantity', event.target.value)}
                        />
                      ) : (
                        <span style={{ fontWeight: 600, color: 'var(--sp-text)' }}>
                          {item.suggestedQuantity} {item.unit}
                        </span>
                      )}
                    </td>
                    <td>
                      {selection[item.itemId] ? (
                        <input
                          className="sales-search-input"
                          style={{
                            height: '28px',
                            border: '1px solid var(--sp-border)',
                            borderRadius: '4px',
                            padding: '0 6px',
                            width: '100px',
                            background: 'var(--sp-surface)'
                          }}
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={selection[item.itemId].unitPrice}
                          onChange={(event) => update(item.itemId, 'unitPrice', event.target.value)}
                          placeholder="Enter cost"
                        />
                      ) : (
                        <span className="sales-sub-ref">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sales-toolbar" style={{ padding: '12px 16px', borderTop: '1px solid var(--sp-border)', margin: 0, background: 'var(--sp-surface-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Supplier:
                <select
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  style={{
                    height: '30px',
                    borderRadius: '6px',
                    border: '1px solid var(--sp-border)',
                    padding: '0 8px',
                    background: 'var(--sp-surface)',
                    fontSize: '12px',
                    color: 'var(--sp-text)'
                  }}
                  required
                >
                  <option value="">Choose supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.code})
                    </option>
                  ))}
                </select>
              </label>
              <span className="sales-item-tag">
                {selectedCount} item{selectedCount === 1 ? '' : 's'} selected
              </span>
            </div>

            <button
              type="button"
              className="sales-action-btn primary"
              disabled={saving || !selectedCount || !supplierId || suggestions.filter((item) => selection[item.itemId]).some((item) => !Number(selection[item.itemId]?.quantity) || selection[item.itemId]?.unitPrice === '')}
              onClick={() => void createOrder()}
            >
              {saving ? 'Creating…' : 'Create draft PO'}
            </button>
          </div>
        </>
      ) : (
        <div className="sales-empty-cell">
          <div className="sales-empty-state">
            <div className="sales-empty-title">Stock levels healthy</div>
            <div className="sales-empty-desc">No replenishment is needed. All inventory is covered by on-hand stock and incoming purchase orders.</div>
          </div>
        </div>
      )}
    </div>
  );
}
