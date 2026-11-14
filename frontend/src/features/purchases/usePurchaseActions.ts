import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import type { InventoryMovement, ItemSummary } from '../../types/inventory';
import type { DashboardMetrics } from '../../app/useTenantData';
import type { PurchaseOrder, SupplierBill, SupplierCreditNote } from '../../types/purchasing';

interface PurchaseActionState {
  receivingOrder: PurchaseOrder | null; setReceivingOrder: Dispatch<SetStateAction<PurchaseOrder | null>>; receivingKey: string; setReceivingKey: Dispatch<SetStateAction<string>>;
  returningOrder: PurchaseOrder | null; setReturningOrder: Dispatch<SetStateAction<PurchaseOrder | null>>; returnKey: string; setReturnKey: Dispatch<SetStateAction<string>>;
  billingOrder: PurchaseOrder | null; setBillingOrder: Dispatch<SetStateAction<PurchaseOrder | null>>; billKey: string; setBillKey: Dispatch<SetStateAction<string>>;
  payingBill: SupplierBill | null; setPayingBill: Dispatch<SetStateAction<SupplierBill | null>>; billPaymentKey: string; setBillPaymentKey: Dispatch<SetStateAction<string>>;
  creditingBill: SupplierBill | null; setCreditingBill: Dispatch<SetStateAction<SupplierBill | null>>; creditKey: string; setCreditKey: Dispatch<SetStateAction<string>>;
  setSaving: Dispatch<SetStateAction<boolean>>; setPurchaseOrders: Dispatch<SetStateAction<PurchaseOrder[]>>; setItems: Dispatch<SetStateAction<ItemSummary[]>>; setMovements: Dispatch<SetStateAction<InventoryMovement[]>>;
  setSupplierBills: Dispatch<SetStateAction<SupplierBill[]>>; setSupplierCredits: Dispatch<SetStateAction<SupplierCreditNote[]>>; setMetrics: Dispatch<SetStateAction<DashboardMetrics>>; notify: (message: string) => void;
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
async function readBody(response: Response, fallback: string): Promise<Record<string, unknown>> {
  const parsed: unknown = await response.json().catch(() => ({}));
  const body = typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : fallback);
  return body;
}
const get = (path: string) => apiFetch(`${API}${path}`).then(response => response.json());

export function usePurchaseActions(state: PurchaseActionState) {
  const { setSaving, notify } = state;
  const approveOrder = async (order: PurchaseOrder): Promise<void> => {
    try { const saved = await readBody(await apiFetch(`${API}/purchase-orders/${order.id}/approve`, { method: 'POST' }), 'Could not approve purchase order'); state.setPurchaseOrders(rows => rows.map(row => row.id === saved.id ? saved as unknown as PurchaseOrder : row)); notify(saved.status === 'approved' ? `${order.orderNumber} approved` : `${order.orderNumber} approval recorded; another approver is required`); }
    catch (error: unknown) { notify(errorMessage(error)); }
  };
  const openReceipt = (order: PurchaseOrder): void => { state.setReceivingOrder(order); state.setReceivingKey(crypto.randomUUID()); };
  const openReturn = (order: PurchaseOrder): void => { state.setReturningOrder(order); state.setReturnKey(crypto.randomUUID()); };
  const submitReceipt = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const order = state.receivingOrder; if (!order) return; const form = new FormData(event.currentTarget);
    const payload = { idempotencyKey: state.receivingKey, lines: order.lines.map(line => ({ purchaseOrderLineId: line.id, acceptedQuantity: Number(form.get(`accepted-${line.id}`) || 0), rejectedQuantity: Number(form.get(`rejected-${line.id}`) || 0), warehouseId: form.get(`warehouse-${line.id}`) })).filter(line => line.acceptedQuantity + line.rejectedQuantity > 0) };
    setSaving(true); try { const receipt = await readBody(await apiFetch(`${API}/purchase-orders/${order.id}/receive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), 'Could not post goods receipt');
      const [orders, items, summary] = await Promise.all([get('/purchase-orders'), get('/items'), get('/dashboard/summary')]); state.setPurchaseOrders(orders); state.setItems(items); state.setMetrics(summary); state.setReceivingOrder(null); state.setReceivingKey(''); notify(`${receipt.receiptNumber} posted · ${receipt.postedUnits} accepted units added to stock`);
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  const submitReturn = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const order = state.returningOrder; if (!order) return; const form = new FormData(event.currentTarget);
    const payload = { idempotencyKey: state.returnKey, reason: form.get('reason'), lines: order.lines.map(line => ({ purchaseOrderLineId: line.id, quantity: Number(form.get(`return-${line.id}`) || 0) })).filter(line => line.quantity > 0) };
    setSaving(true); try { const saved = await readBody(await apiFetch(`${API}/purchase-orders/${order.id}/return`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), 'Could not post this supplier return');
      const [orders, items, movements, summary] = await Promise.all([get('/purchase-orders'), get('/items'), get('/inventory/movements'), get('/dashboard/summary')]); state.setPurchaseOrders(orders); state.setItems(items); state.setMovements(movements); state.setMetrics(summary); state.setReturningOrder(null); state.setReturnKey(''); notify(`${saved.returnNumber} posted · ${saved.returnedUnits} units returned to supplier`);
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  const openBill = (order: PurchaseOrder): void => { state.setBillingOrder(order); state.setBillKey(crypto.randomUUID()); };
  const openBillPayment = (bill: SupplierBill): void => { state.setPayingBill(bill); state.setBillPaymentKey(crypto.randomUUID()); };
  const openSupplierCredit = (bill: SupplierBill): void => { state.setCreditingBill(bill); state.setCreditKey(crypto.randomUUID()); };
  const submitBill = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const order = state.billingOrder; if (!order) return; const form = new FormData(event.currentTarget); setSaving(true);
    try { const saved = await readBody(await apiFetch(`${API}/purchase-orders/${order.id}/bill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: state.billKey, dueDate: form.get('dueDate') || null }) }), 'Could not record supplier bill');
      const [bills, orders, summary] = await Promise.all([get('/supplier-bills'), get('/purchase-orders'), get('/dashboard/summary')]); state.setSupplierBills(bills); state.setPurchaseOrders(orders); state.setMetrics(summary); state.setBillingOrder(null); state.setBillKey(''); notify(`${saved.billNumber} recorded · ${formatCurrency(typeof saved.total === 'string' || typeof saved.total === 'number' ? saved.total : 0)} payable`);
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  const submitBillPayment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const bill = state.payingBill; if (!bill) return; const form = new FormData(event.currentTarget); setSaving(true);
    try { const saved = await readBody(await apiFetch(`${API}/supplier-bills/${bill.id}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: state.billPaymentKey, amount: Number(form.get('amount')), method: form.get('method'), reference: form.get('reference') || null }) }), 'Could not post supplier payment');
      const [bills, summary] = await Promise.all([get('/supplier-bills'), get('/dashboard/summary')]); state.setSupplierBills(bills); state.setMetrics(summary); state.setPayingBill(null); state.setBillPaymentKey(''); notify(`Supplier payment recorded · ${formatCurrency(typeof saved.amountPaid === 'string' || typeof saved.amountPaid === 'number' ? saved.amountPaid : 0)} paid`);
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  const submitSupplierCredit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const bill = state.creditingBill; if (!bill) return; const form = new FormData(event.currentTarget);
    const payload = { idempotencyKey: state.creditKey, reason: form.get('reason'), lines: bill.lines.map(line => ({ supplierBillLineId: line.id, quantity: Number(form.get(`credit-${line.id}`) || 0) })).filter(line => line.quantity > 0) }; setSaving(true);
    try { const saved = await readBody(await apiFetch(`${API}/supplier-bills/${bill.id}/credits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), 'Could not post supplier credit');
      const [bills, credits, orders, items, movements, summary] = await Promise.all([get('/supplier-bills'), get('/supplier-credit-notes'), get('/purchase-orders'), get('/items'), get('/inventory/movements'), get('/dashboard/summary')]); state.setSupplierBills(bills); state.setSupplierCredits(credits); state.setPurchaseOrders(orders); state.setItems(items); state.setMovements(movements); state.setMetrics(summary); state.setCreditingBill(null); state.setCreditKey(''); notify(`${saved.creditNumber} posted · ${formatCurrency(typeof saved.total === 'string' || typeof saved.total === 'number' ? saved.total : 0)} credited and ${saved.creditedUnits} units returned`);
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  return { approveOrder, openReceipt, openReturn, openBill, openBillPayment, openSupplierCredit, submitReceipt, submitReturn, submitBill, submitBillPayment, submitSupplierCredit };
}
