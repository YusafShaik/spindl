import type { Dispatch, SetStateAction } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import type { DashboardMetrics } from '../../app/useTenantData';
import type { CustomerRecord } from '../../types/customer';
import type { CsvImportPreview, ExportResource, ImportResource } from '../../types/imports';
import type { InventoryMovement, ItemSummary } from '../../types/inventory';
interface ImportActionState {
  resource: ImportResource; file: File | null; setFile: Dispatch<SetStateAction<File | null>>;
  preview: CsvImportPreview | null; setPreview: Dispatch<SetStateAction<CsvImportPreview | null>>; idempotencyKey: string; setIdempotencyKey: Dispatch<SetStateAction<string>>;
  setItems: Dispatch<SetStateAction<ItemSummary[]>>; setCustomers: Dispatch<SetStateAction<CustomerRecord[]>>; setMovements: Dispatch<SetStateAction<InventoryMovement[]>>; setMetrics: Dispatch<SetStateAction<DashboardMetrics>>;
  setSaving: Dispatch<SetStateAction<boolean>>; notify: (message: string) => void;
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
async function fetchData<T>(path: string): Promise<T> { const response = await apiFetch(`${API}${path}`); return response.json() as Promise<T>; }
export function useImportActions(state: ImportActionState) {
  const { notify, setSaving } = state;
  const previewImport = async (): Promise<void> => {
    if (!state.file) { notify('Choose a CSV file first'); return; } setSaving(true);
    try { const form = new FormData(); form.append('file', state.file); const response = await apiFetch(`${API}/imports/${state.resource}/preview`, { method: 'POST', body: form });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || 'Could not preview this import'); }
      state.setPreview(await response.json()); state.setIdempotencyKey(crypto.randomUUID());
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  const exportMasterData = async (resource: ExportResource): Promise<void> => {
    setSaving(true); try { const response = await apiFetch(`${API}/imports/${resource}/export`); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail || body.message || 'Could not export records'); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `spindl-${resource.toLowerCase()}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); notify(`${resource.replaceAll('_', ' ').toLowerCase()} CSV downloaded`);
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  const commitImport = async (): Promise<void> => {
    if (!state.file || !state.preview || state.preview.errors.length) { notify('Preview and resolve all row errors before importing'); return; } setSaving(true);
    try { const form = new FormData(); form.append('file', state.file); const response = await apiFetch(`${API}/imports/${state.resource}/commit`, { method: 'POST', headers: { 'Idempotency-Key': state.idempotencyKey }, body: form });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || 'Could not import this file'); }
      const value: unknown = await response.json(); const result = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
      if (!result.imported) { state.setPreview(current => current ? { ...current, errors: Array.isArray(result.errors) ? result.errors as CsvImportPreview['errors'] : [] } : current); notify('Resolve the import errors and preview again'); return; }
      const [items, customers, movements, summary] = await Promise.all([fetchData<ItemSummary[]>('/items'), fetchData<CustomerRecord[]>('/customers'), fetchData<InventoryMovement[]>('/inventory/movements'), fetchData<DashboardMetrics>('/dashboard/summary')]);
      state.setItems(items); state.setCustomers(customers); state.setMovements(movements); state.setMetrics(summary); state.setFile(null); state.setPreview(null); state.setIdempotencyKey('');
      notify(`${String(result.rowsImported ?? 0)} ${state.resource.toLowerCase()} imported${result.replayed ? ' (previous request confirmed)' : ''}`);
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  return { previewImport, exportMasterData, commitImport };
}
