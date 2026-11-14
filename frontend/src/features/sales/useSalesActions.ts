import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import type { useTenantData } from '../../app/useTenantData';
import type { CustomerCreditNote, SalesInvoice, SalesOrder, SalesQuote } from '../../types/sales';
import type { ItemSummary, InventoryMovement } from '../../types/inventory';
import type { CustomerRecord } from '../../types/customer';
import type { TransactionRecord } from '../../types/transaction';

type SalesDataActions = Pick<ReturnType<typeof useTenantData>, 'setItems' | 'setCustomers' | 'setCustomerCredits' | 'setTransactions' | 'setQuotes' | 'setSalesOrders' | 'setInvoices' | 'setMovements' | 'setMetrics'>;
interface SalesActionState extends SalesDataActions {
  conversionQuote: SalesQuote | null; setConversionQuote: Dispatch<SetStateAction<SalesQuote | null>>;
  dispatchingOrder: SalesOrder | null; setDispatchingOrder: Dispatch<SetStateAction<SalesOrder | null>>; dispatchKey: string; setDispatchKey: Dispatch<SetStateAction<string>>;
  invoicingOrder: SalesOrder | null; setInvoicingOrder: Dispatch<SetStateAction<SalesOrder | null>>; invoiceKey: string; setInvoiceKey: Dispatch<SetStateAction<string>>;
  payingInvoice: SalesInvoice | null; setPayingInvoice: Dispatch<SetStateAction<SalesInvoice | null>>; paymentKey: string; setPaymentKey: Dispatch<SetStateAction<string>>;
  creditingInvoice: SalesInvoice | null; setCreditingInvoice: Dispatch<SetStateAction<SalesInvoice | null>>; customerCreditKey: string; setCustomerCreditKey: Dispatch<SetStateAction<string>>;
  refundingCredit: CustomerCreditNote | null; setRefundingCredit: Dispatch<SetStateAction<CustomerCreditNote | null>>; refundKey: string; setRefundKey: Dispatch<SetStateAction<string>>;
  setSaving: Dispatch<SetStateAction<boolean>>; notify: (message: string) => void;
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
async function json<T>(path: string): Promise<T> { const response = await apiFetch(`${API}${path}`); const body: unknown = await response.json(); return body as T; }
async function save<T = Record<string, unknown>>(response: Response, fallback: string): Promise<T> { const value: unknown = await response.json().catch(() => ({})); const body = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : fallback); return value as T; }
function currency(value: unknown): number | string { return typeof value === 'number' || typeof value === 'string' ? value : 0; }

export function useSalesActions(state: SalesActionState) {
  const { notify, setSaving } = state;
  const quoteAction = async (quote: SalesQuote, action: string): Promise<void> => {
    if (action === 'convert') { state.setConversionQuote(quote); return; }
    try {
      if (action === 'convert') { const saved = await save<SalesOrder>(await apiFetch(`${API}/quotes/${quote.id}/${action}`, { method: 'POST' }), `Could not ${action} quote`); state.setSalesOrders(rows => [saved, ...rows]); state.setQuotes(rows => rows.map(row => row.id === quote.id ? { ...row, converted: true } : row)); notify(`${saved.orderNumber} created with stock reserved`); }
      else { const saved = await save<SalesQuote>(await apiFetch(`${API}/quotes/${quote.id}/${action}`, { method: 'POST' }), `Could not ${action} quote`); state.setQuotes(rows => rows.map(row => row.id === saved.id ? saved : row)); notify(`${saved.quoteNumber} ${action === 'send' ? 'sent' : action === 'accept' ? 'accepted' : 'rejected'}`); }
    } catch (error: unknown) { notify(message(error)); }
  };
  const submitQuoteConversion = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const quote = state.conversionQuote; if (!quote) return; const form = new FormData(event.currentTarget); setSaving(true);
    try { const saved = await save<SalesOrder>(await apiFetch(`${API}/quotes/${quote.id}/convert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines: quote.lines.map(line => ({ quoteLineId: line.id, warehouseId: form.get(`warehouse-${line.id}`) })) }) }), 'Could not convert quote');
      const [orders, items, summary] = await Promise.all([json<SalesOrder[]>('/sales-orders'), json<ItemSummary[]>('/items'), json<import('../../app/useTenantData').DashboardMetrics>('/dashboard/summary')]); state.setSalesOrders(orders); state.setItems(items); state.setMetrics(summary); state.setQuotes(rows => rows.map(row => row.id === quote.id ? { ...row, converted: true } : row)); state.setConversionQuote(null); notify(`${saved.orderNumber} created with stock reserved by warehouse`);
    } catch (error: unknown) { notify(message(error)); } finally { setSaving(false); }
  };
  const openDispatch = (order: SalesOrder): void => { state.setDispatchingOrder(order); state.setDispatchKey(crypto.randomUUID()); };
  const openInvoice = (order: SalesOrder): void => { state.setInvoicingOrder(order); state.setInvoiceKey(crypto.randomUUID()); };
  const openPayment = (invoice: SalesInvoice): void => { state.setPayingInvoice(invoice); state.setPaymentKey(crypto.randomUUID()); };
  const openCustomerCredit = (invoice: SalesInvoice): void => { state.setCreditingInvoice(invoice); state.setCustomerCreditKey(crypto.randomUUID()); };
  const openRefund = (credit: CustomerCreditNote): void => { state.setRefundingCredit(credit); state.setRefundKey(crypto.randomUUID()); };
  const submitInvoice = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const order = state.invoicingOrder; if (!order) return; const form = new FormData(event.currentTarget); setSaving(true);
    try { const saved = await save<{invoiceNumber:string;total:number|string}>(await apiFetch(`${API}/sales-orders/${order.id}/invoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: state.invoiceKey, dueDate: form.get('dueDate') || null }) }), 'Could not issue this invoice');
      const [invoices, orders, customers, summary] = await Promise.all([json<SalesInvoice[]>('/invoices'), json<SalesOrder[]>('/sales-orders'), json<CustomerRecord[]>('/customers'), json<import('../../app/useTenantData').DashboardMetrics>('/dashboard/summary')]); state.setInvoices(invoices); state.setSalesOrders(orders); state.setCustomers(customers); state.setMetrics(summary); state.setInvoicingOrder(null); state.setInvoiceKey(''); notify(`${saved.invoiceNumber} issued · ${formatCurrency(saved.total)}`);
    } catch (error: unknown) { notify(message(error)); } finally { setSaving(false); }
  };
  const submitPayment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const invoice = state.payingInvoice; if (!invoice) return; const form = new FormData(event.currentTarget); setSaving(true);
    try { const saved = await save<{amountPaid:number|string}>(await apiFetch(`${API}/invoices/${invoice.id}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: state.paymentKey, amount: Number(form.get('amount')), method: form.get('method'), reference: form.get('reference') || null }) }), 'Could not record this payment');
      const [invoices, customers, summary] = await Promise.all([json<SalesInvoice[]>('/invoices'), json<CustomerRecord[]>('/customers'), json<import('../../app/useTenantData').DashboardMetrics>('/dashboard/summary')]); state.setInvoices(invoices); state.setCustomers(customers); state.setMetrics(summary); state.setPayingInvoice(null); state.setPaymentKey(''); notify(`Payment recorded · ${formatCurrency(saved.amountPaid)} paid`);
    } catch (error: unknown) { notify(message(error)); } finally { setSaving(false); }
  };
  const submitCustomerCredit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const invoice = state.creditingInvoice; if (!invoice) return; const form = new FormData(event.currentTarget); const lines = invoice.lines.map(line => ({ invoiceLineId: line.id, quantity: Number(form.get(`return-${line.id}`) || 0), disposition: form.get(`disposition-${line.id}`) || 'RESTOCK' })).filter(line => line.quantity > 0);
    if (!lines.length) { notify('Enter a return quantity for at least one invoice line'); return; } setSaving(true);
    try { const saved = await save<{creditNumber:string;total:number|string}>(await apiFetch(`${API}/invoices/${invoice.id}/credits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: state.customerCreditKey, reason: form.get('reason'), lines }) }), 'Could not post this customer return');
      const [invoices, credits, items, movements, summary, transactions] = await Promise.all([json<SalesInvoice[]>('/invoices'), json<CustomerCreditNote[]>('/customer-credit-notes'), json<ItemSummary[]>('/items'), json<InventoryMovement[]>('/inventory/movements'), json<import('../../app/useTenantData').DashboardMetrics>('/dashboard/summary'), json<TransactionRecord[]>('/transactions')]); state.setInvoices(invoices); state.setCustomerCredits(credits); state.setItems(items); state.setMovements(movements); state.setMetrics(summary); state.setTransactions(transactions); state.setCreditingInvoice(null); state.setCustomerCreditKey(''); notify(`${saved.creditNumber} posted · ${formatCurrency(saved.total)} credited`);
    } catch (error: unknown) { notify(message(error)); } finally { setSaving(false); }
  };
  const submitRefund = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const credit = state.refundingCredit; if (!credit) return; const form = new FormData(event.currentTarget); setSaving(true);
    try { const saved = await save<{amountRefunded:number|string}>(await apiFetch(`${API}/customer-credit-notes/${credit.id}/refunds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: state.refundKey, amount: Number(form.get('amount')), method: form.get('method'), reference: form.get('reference') || null }) }), 'Could not post this refund');
      const [credits, transactions] = await Promise.all([json<CustomerCreditNote[]>('/customer-credit-notes'), json<TransactionRecord[]>('/transactions')]); state.setCustomerCredits(credits); state.setTransactions(transactions); state.setRefundingCredit(null); state.setRefundKey(''); notify(`Refund recorded · ${formatCurrency(saved.amountRefunded)} refunded`);
    } catch (error: unknown) { notify(message(error)); } finally { setSaving(false); }
  };
  const submitDispatch = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const order = state.dispatchingOrder; if (!order) return; const form = new FormData(event.currentTarget); const payload = { idempotencyKey: state.dispatchKey, lines: order.lines.map(line => ({ salesOrderLineId: line.id, quantity: Number(form.get(`ship-${line.id}`) || 0) })).filter(line => line.quantity > 0) }; setSaving(true);
    try { const shipment = await save<{shipmentNumber:string;shippedUnits:number}>(await apiFetch(`${API}/sales-orders/${order.id}/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), 'Could not dispatch this order');
      const [orders, items, summary] = await Promise.all([json<SalesOrder[]>('/sales-orders'), json<ItemSummary[]>('/items'), json<import('../../app/useTenantData').DashboardMetrics>('/dashboard/summary')]); state.setSalesOrders(orders); state.setItems(items); state.setMetrics(summary); state.setDispatchingOrder(null); state.setDispatchKey(''); notify(`${shipment.shipmentNumber} dispatched · ${shipment.shippedUnits} units shipped`);
    } catch (error: unknown) { notify(message(error)); } finally { setSaving(false); }
  };
  return { quoteAction, submitQuoteConversion, openDispatch, openInvoice, openPayment, openCustomerCredit, openRefund, submitInvoice, submitPayment, submitCustomerCredit, submitRefund, submitDispatch };
}
