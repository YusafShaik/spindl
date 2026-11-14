import { useEffect, useState } from 'react';
import { API, apiFetch } from '../lib/api/client';
import type { CustomerCreditNote, SalesInvoice, SalesOrder, SalesQuote } from '../types/sales';
import type { CustomerRecord } from '../types/customer';
import type { InventoryMovement, ItemSummary } from '../types/inventory';
import type { PurchaseOrder, PurchaseRequisition, SupplierBill, SupplierCreditNote, SupplierSummary } from '../types/purchasing';
import type { TransactionRecord } from '../types/transaction';

export interface DashboardMetrics {
  salesThisMonth: number; openOrders: number; inventoryValue: number; activeCustomers: number;
  lowStockItems: number; accountsReceivable: number; overdueReceivables: number;
  accountsPayable: number; overduePayables: number;
}
export interface DashboardTrendPoint { label: string; sales: number | string | null; purchases: number | string | null; }

const emptyMetrics: DashboardMetrics = { salesThisMonth: 0, openOrders: 0, inventoryValue: 0, activeCustomers: 0, lowStockItems: 0, accountsReceivable: 0, overdueReceivables: 0, accountsPayable: 0, overduePayables: 0 };

export function useTenantData(session: unknown) {
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseRequisitions, setPurchaseRequisitions] = useState<PurchaseRequisition[]>([]);
  const [supplierBills, setSupplierBills] = useState<SupplierBill[]>([]);
  const [supplierCredits, setSupplierCredits] = useState<SupplierCreditNote[]>([]);
  const [customerCredits, setCustomerCredits] = useState<CustomerCreditNote[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [quotes, setQuotes] = useState<SalesQuote[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [trend, setTrend] = useState<DashboardTrendPoint[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [apiOnline, setApiOnline] = useState(false);

  useEffect(() => {
    if (!session) return;
    const load = async (): Promise<void> => {
      const [summary, itemData, customerData, supplierData, orderData, requisitionData, quoteData, salesOrderData, invoiceData, movementData, billData, creditData, customerCreditData, transactionData, trendData] = await Promise.all([
        apiFetch(`${API}/dashboard/summary`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/items`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/customers`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/suppliers`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/purchase-orders`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/purchase-requisitions`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/quotes`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/sales-orders`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/invoices`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/inventory/movements`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/supplier-bills`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/supplier-credit-notes`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/customer-credit-notes`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/transactions`).then((response) => response.ok ? response.json() : Promise.reject()),
        apiFetch(`${API}/dashboard/trend?months=6`).then((response) => response.ok ? response.json() : Promise.reject()),
      ]);
      setMetrics(summary); setItems(itemData); setCustomers(customerData); setSuppliers(supplierData); setPurchaseOrders(orderData); setPurchaseRequisitions(requisitionData); setQuotes(quoteData); setSalesOrders(salesOrderData); setInvoices(invoiceData); setMovements(movementData); setSupplierBills(billData); setSupplierCredits(creditData); setCustomerCredits(customerCreditData); setTransactions(transactionData); setTrend(trendData); setApiOnline(true);
    };
    void load().catch(() => setApiOnline(false));
  }, [session]);

  return { items, setItems, customers, setCustomers, suppliers, setSuppliers, purchaseOrders, setPurchaseOrders, purchaseRequisitions, setPurchaseRequisitions, supplierBills, setSupplierBills, supplierCredits, setSupplierCredits, customerCredits, setCustomerCredits, transactions, setTransactions, quotes, setQuotes, salesOrders, setSalesOrders, invoices, setInvoices, movements, setMovements, trend, setTrend, metrics, setMetrics, apiOnline, setApiOnline };
}
