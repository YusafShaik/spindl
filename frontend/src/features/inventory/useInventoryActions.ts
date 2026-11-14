import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import type { DashboardMetrics } from '../../app/useTenantData';
import type { InventoryMovement, ItemSummary } from '../../types/inventory';

interface InventoryActionState {
  adjustingItem: ItemSummary | null; setAdjustingItem: Dispatch<SetStateAction<ItemSummary | null>>; adjustmentKey: string; setAdjustmentKey: Dispatch<SetStateAction<string>>;
  thresholdItem: ItemSummary | null; setThresholdItem: Dispatch<SetStateAction<ItemSummary | null>>;
  setItems: Dispatch<SetStateAction<ItemSummary[]>>; setMovements: Dispatch<SetStateAction<InventoryMovement[]>>; setMetrics: Dispatch<SetStateAction<DashboardMetrics>>;
  setSaving: Dispatch<SetStateAction<boolean>>; notify: (message: string) => void;
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
async function get<T>(path: string): Promise<T> { const response = await apiFetch(`${API}${path}`); return response.json() as Promise<T>; }
async function responseBody(response: Response, fallback: string): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => ({})); const body = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : fallback); return body;
}
export function useInventoryActions(state: InventoryActionState) {
  const { notify, setSaving } = state;
  const openAdjustment = (item: ItemSummary): void => { state.setAdjustingItem(item); state.setAdjustmentKey(crypto.randomUUID()); };
  const saveThreshold = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const item = state.thresholdItem; if (!item) return; const form = new FormData(event.currentTarget); setSaving(true);
    try { const saved = await responseBody(await apiFetch(`${API}/items/${item.id}/low-stock-threshold`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowStockThreshold: Number(form.get('lowStockThreshold')) }) }), 'Could not update low-stock threshold');
      if (typeof saved.id !== 'string' || typeof saved.sku !== 'string') throw new Error('Invalid item response'); const updated = saved as unknown as ItemSummary; state.setItems(rows => rows.map(row => row.id === updated.id ? updated : row)); state.setMetrics(await get<DashboardMetrics>('/dashboard/summary')); state.setThresholdItem(null); notify(`${updated.sku} alert threshold updated`);
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  const submitAdjustment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const item = state.adjustingItem; if (!item) return; const form = new FormData(event.currentTarget); setSaving(true);
    try { const saved = await responseBody(await apiFetch(`${API}/inventory/adjustments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: item.id, quantityDelta: Number(form.get('quantityDelta')), reason: form.get('reason'), idempotencyKey: state.adjustmentKey, warehouseId: form.get('warehouseId') }) }), 'Could not post this stock adjustment');
      const [items, movements, summary] = await Promise.all([get<ItemSummary[]>('/items'), get<InventoryMovement[]>('/inventory/movements'), get<DashboardMetrics>('/dashboard/summary')]); state.setItems(items); state.setMovements(movements); state.setMetrics(summary); state.setAdjustingItem(null); state.setAdjustmentKey('');
      notify(`Stock adjusted · ${typeof saved.sku === 'string' ? saved.sku : item.sku} ${typeof saved.quantityDelta === 'number' && saved.quantityDelta > 0 ? '+' : ''}${String(saved.quantityDelta ?? '')}`);
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  return { openAdjustment, saveThreshold, submitAdjustment };
}
