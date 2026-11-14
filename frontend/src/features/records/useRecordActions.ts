import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import type { DashboardMetrics } from '../../app/useTenantData';
import type { CustomerRecord } from '../../types/customer';
import type { ItemSummary } from '../../types/inventory';
import type { PurchaseOrder, SupplierSummary } from '../../types/purchasing';
import type { SalesQuote } from '../../types/sales';
import type { CustomFieldDefinition, CustomFieldResource, RecordKind } from './RecordModal';

interface RecordActionState {
  kind: RecordKind | null; setKind: Dispatch<SetStateAction<RecordKind | null>>; setSection: Dispatch<SetStateAction<string>>;
  setCustomers: Dispatch<SetStateAction<CustomerRecord[]>>; setSuppliers: Dispatch<SetStateAction<SupplierSummary[]>>; setPurchaseOrders: Dispatch<SetStateAction<PurchaseOrder[]>>; setQuotes: Dispatch<SetStateAction<SalesQuote[]>>; setItems: Dispatch<SetStateAction<ItemSummary[]>>;
  setSaving: Dispatch<SetStateAction<boolean>>; setApiOnline: Dispatch<SetStateAction<boolean>>; setMetrics: Dispatch<SetStateAction<DashboardMetrics>>; notify: (message: string) => void;
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function object(value: unknown): Record<string, unknown> | null { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null; }
export function useRecordActions(state: RecordActionState) {
  const submitNew = async (event: FormEvent<HTMLFormElement>, customDefinitions: CustomFieldDefinition[] = [], customResource: CustomFieldResource | null = null): Promise<void> => {
    event.preventDefault(); const kind = state.kind; if (!kind) return; const form = new FormData(event.currentTarget);
    const isCustomer = kind === 'Customer'; const isSupplier = kind === 'Supplier'; const isPurchaseOrder = kind === 'Purchase order'; const isQuote = kind === 'Quotation';
    const endpoint = isCustomer ? 'customers' : isSupplier ? 'suppliers' : isPurchaseOrder ? 'purchase-orders' : isQuote ? 'quotes' : 'items';
    const payload = isCustomer || isSupplier
      ? { code: form.get('code'), name: form.get('name'), email: form.get('email'), status: 'Active', ...(isCustomer ? { customerType: form.get('customerType'), contactName: form.get('contactName'), phone: form.get('phone'), addressLine1: form.get('addressLine1'), addressLine2: form.get('addressLine2'), city: form.get('city'), region: form.get('region'), postalCode: form.get('postalCode'), countryCode: form.get('countryCode'), taxId: form.get('taxId'), paymentTermsDays: Number(form.get('paymentTermsDays') || 0), creditLimit: Number(form.get('creditLimit') || 0), tags: form.get('tags'), creditHold: form.get('creditHold') === 'on' } : { contactName: form.get('contactName'), phone: form.get('phone'), addressLine1: form.get('addressLine1'), addressLine2: form.get('addressLine2'), city: form.get('city'), region: form.get('region'), postalCode: form.get('postalCode'), countryCode: form.get('countryCode'), taxId: form.get('taxId'), paymentTermsDays: Number(form.get('paymentTermsDays') || 0), leadTimeDays: Number(form.get('leadTimeDays') || 0), rating: form.get('rating') ? Number(form.get('rating')) : null, notes: form.get('notes') }) }
      : isPurchaseOrder ? { supplierId: form.get('supplierId'), notes: form.get('notes'), lines: [{ itemId: form.get('itemId'), quantity: Number(form.get('quantity')), unitPrice: Number(form.get('price')) }] }
        : isQuote ? { customerId: form.get('customerId'), validUntil: form.get('validUntil') || null, notes: form.get('notes'), lines: [{ itemId: form.get('itemId'), quantity: Number(form.get('quantity')), unitPrice: Number(form.get('price')) }] }
          : { sku: form.get('code'), name: form.get('name'), barcode: form.get('barcode') || null, category: form.get('category'), openingStock: Number(form.get('stock')), unit: form.get('unit'), unitPrice: Number(form.get('price')), lowStockThreshold: Number(form.get('lowStockThreshold')), itemType: form.get('itemType') || 'FINISHED' };
    state.setSaving(true);
    try {
      const response = await apiFetch(`${API}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const value: unknown = await response.json().catch(() => ({})); const saved = object(value);
      if (!response.ok) throw new Error(typeof saved?.detail === 'string' ? saved.detail : typeof saved?.message === 'string' ? saved.message : 'Could not save this record');
      if (!saved || typeof saved.id !== 'string') throw new Error('The server returned an invalid record response.');
      let customSaveError = '';
      if (customResource && customDefinitions.length) {
        const values: Record<string, unknown> = {};
        for (const field of customDefinitions) { let value: unknown = form.get(`custom_${field.fieldKey}`); if ((value === null || value === '') && field.defaultValue !== null && field.defaultValue !== undefined) value = field.defaultValue; if (value === null || value === '') continue; if (field.fieldType === 'NUMBER') value = Number(value); if (field.fieldType === 'BOOLEAN') value = value === true || value === 'true'; values[field.fieldKey] = value; }
        try { const customResponse = await apiFetch(`${API}/custom-fields/${customResource}/${saved.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) }); if (!customResponse.ok) { const body = object(await customResponse.json().catch(() => ({}))); customSaveError = typeof body?.detail === 'string' ? body.detail : typeof body?.message === 'string' ? body.message : 'custom field values were not saved'; } }
        catch (error: unknown) { customSaveError = message(error) || 'custom field values could not be saved'; }
      }
      if (isCustomer) { state.setCustomers(rows => [saved as unknown as CustomerRecord, ...rows]); state.setSection('Customers'); }
      else if (isSupplier) { state.setSuppliers(rows => [saved as unknown as SupplierSummary, ...rows]); state.setSection('Purchases'); }
      else if (isPurchaseOrder) { state.setPurchaseOrders(rows => [saved as unknown as PurchaseOrder, ...rows]); state.setSection('Purchases'); }
      else if (isQuote) { state.setQuotes(rows => [saved as unknown as SalesQuote, ...rows]); state.setSection('Sales'); }
      else { state.setItems(rows => [saved as unknown as ItemSummary, ...rows]); state.setSection('Products'); }
      state.setApiOnline(true); state.setKind(null); state.notify(customSaveError ? `${kind} created, but ${customSaveError}` : `${kind} saved to PostgreSQL`);
      state.setMetrics(await (await apiFetch(`${API}/dashboard/summary`)).json());
    } catch (error: unknown) { state.notify(message(error)); } finally { state.setSaving(false); }
  };
  return { submitNew };
}
