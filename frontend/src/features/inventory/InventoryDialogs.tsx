import { useEffect, useState, type FormEventHandler } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import type { ItemSummary, WarehouseSummary } from '../../types/inventory';

interface ModalSubmissionProps {
  item: ItemSummary;
  saving: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

interface AdjustmentModalProps extends ModalSubmissionProps {}
interface ThresholdModalProps extends ModalSubmissionProps {}

export function AdjustmentModal({ item, saving, onClose, onSubmit }: AdjustmentModalProps) {
  const [warehouses,setWarehouses]=useState<WarehouseSummary[]>([]);const [warehouseId,setWarehouseId]=useState('');
  useEffect(()=>{let current=true;apiFetch(`${API}/inventory/warehouses`).then(response=>response.ok?response.json():Promise.reject(new Error('Could not load warehouses'))).then((data: WarehouseSummary[])=>{if(!current)return;setWarehouses(data);setWarehouseId((data.find(warehouse=>warehouse.isDefault)||data[0])?.id||'');}).catch((error: unknown)=>console.error(error));return()=>{current=false;};},[]);
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)onClose();}}><form className="record-modal" onSubmit={onSubmit}><div className="modal-title"><div><h2>Adjust stock · {item.sku}</h2><p>{item.name} · {item.stock} on hand across warehouses, {item.reserved} reserved.</p></div><button type="button" disabled={saving} onClick={onClose}>×</button></div><label>Warehouse<select name="warehouseId" value={warehouseId} onChange={event=>setWarehouseId(event.target.value)} required>{warehouses.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label>Quantity change<input name="quantityDelta" type="number" min={-Number(item.available)} max="2147483647" step="1" defaultValue="1" required/></label><p className="form-note">Use a positive number to add stock and a negative number to remove it. Reserved or quality-held quantities cannot be removed.</p><label>Reason<select name="reason" defaultValue="Count correction"><option>Count correction</option><option>Damaged stock</option><option>Found stock</option><option>Other adjustment</option></select></label><div className="modal-actions"><button className="button button-secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving||!warehouseId}>{saving?'Posting…':'Post adjustment'}</button></div></form></div>;
}

export function ThresholdModal({ item, saving, onClose, onSubmit }: ThresholdModalProps) {
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)onClose();}}><form className="record-modal" onSubmit={onSubmit}><div className="modal-title"><div><h2>Low-stock alert · {item.sku}</h2><p>Show an alert when available stock reaches this level.</p></div><button type="button" disabled={saving} onClick={onClose}>×</button></div><label>Available quantity threshold<input name="lowStockThreshold" type="number" min="0" defaultValue={item.lowStockThreshold} required/></label><p className="form-note">Current available stock is {item.available} {item.unit}.</p><div className="modal-actions"><button className="button button-secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving?'Saving…':'Save threshold'}</button></div></form></div>;
}
