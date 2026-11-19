import { useState, useMemo, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Filter,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  ShoppingCart,
  Star,
  TrendingDown,
  TrendingUp,
  Truck,
  X,
  XCircle
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { CustomFieldEditor } from '../customers/CustomFieldEditor';
import type { PurchaseOrder, PurchaseRequisition, SupplierBill, SupplierCreditNote, SupplierSummary } from '../../types/purchasing';

type PurchaseTab = 'orders' | 'requisitions' | 'reorder' | 'suppliers' | 'bills' | 'credits';
type PoFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
type BillFilter = 'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
type SupplierFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface PurchaseDirectoryProps {
  orders: PurchaseOrder[];
  bills: SupplierBill[];
  credits: SupplierCreditNote[];
  payables: number | string;
  suppliers: SupplierSummary[];
  query: string;
  setQuery: (query: string) => void;
  onApprove: (order: PurchaseOrder) => void;
  onReceive: (order: PurchaseOrder) => void;
  onReturn: (order: PurchaseOrder) => void;
  onBill: (order: PurchaseOrder) => void;
  onPayment: (bill: SupplierBill) => void;
  onCredit: (bill: SupplierBill) => void;
  onNewSupplier: () => void;
  onNewOrder?: () => void;
  requisitionSection: ReactNode;
  reorderSection: ReactNode;
  requisitions?: PurchaseRequisition[];
}

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function money(value: number | string | null | undefined): string {
  const num = Number(value || 0);
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(iso);
  }
}

export function PurchaseDirectory({
  orders,
  bills,
  credits,
  payables,
  suppliers,
  query,
  setQuery,
  onApprove,
  onReceive,
  onReturn,
  onBill,
  onPayment,
  onCredit,
  onNewSupplier,
  onNewOrder,
  requisitionSection,
  reorderSection,
  requisitions = []
}: PurchaseDirectoryProps) {
  const [activeTab, setActiveTab] = useState<PurchaseTab>('orders');
  const [poFilter, setPoFilter] = useState<PoFilter>('ALL');
  const [billFilter, setBillFilter] = useState<BillFilter>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>('ALL');

  // Executive KPI Calculations
  const totalCommittedPoValue = useMemo(() => {
    return orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  }, [orders]);

  const pendingDeliveryCount = useMemo(() => {
    return orders.filter(o => o.status !== 'received').length;
  }, [orders]);

  const totalAccountsPayable = useMemo(() => {
    return Number(payables || 0);
  }, [payables]);

  const unpaidBillsCount = useMemo(() => {
    return bills.filter(b => b.status !== 'paid').length;
  }, [bills]);

  const avgSupplierLeadTime = useMemo(() => {
    if (!suppliers.length) return 14;
    const total = suppliers.reduce((sum, s) => sum + (s.leadTimeDays || 0), 0);
    return Math.round(total / suppliers.length);
  }, [suppliers]);

  const pendingRequisitionsCount = useMemo(() => {
    return requisitions.filter(r => r.status === 'SUBMITTED').length;
  }, [requisitions]);

  // Tab 1: Purchase Orders Filtering
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const qLower = query.toLowerCase().trim();
      const matchesSearch = !qLower || (
        order.orderNumber.toLowerCase().includes(qLower) ||
        order.supplierName.toLowerCase().includes(qLower) ||
        order.status.toLowerCase().includes(qLower) ||
        (order.notes && order.notes.toLowerCase().includes(qLower)) ||
        order.lines.some(l => l.sku.toLowerCase().includes(qLower) || l.itemName.toLowerCase().includes(qLower))
      );
      if (!matchesSearch) return false;

      if (poFilter === 'PENDING') return ['draft', 'pending_approval'].includes(order.status);
      if (poFilter === 'APPROVED') return order.status === 'approved';
      if (poFilter === 'PARTIALLY_RECEIVED') return order.status === 'partially_received';
      if (poFilter === 'RECEIVED') return order.status === 'received';
      return true;
    });
  }, [orders, query, poFilter]);

  // Tab 4: Suppliers Filtering
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => {
      const qLower = query.toLowerCase().trim();
      const matchesSearch = !qLower || (
        supplier.name.toLowerCase().includes(qLower) ||
        supplier.code.toLowerCase().includes(qLower) ||
        (supplier.email && supplier.email.toLowerCase().includes(qLower)) ||
        (supplier.contactName && supplier.contactName.toLowerCase().includes(qLower)) ||
        (supplier.city && supplier.city.toLowerCase().includes(qLower))
      );
      if (!matchesSearch) return false;

      if (supplierFilter === 'ACTIVE') return supplier.status.toLowerCase() === 'active';
      if (supplierFilter === 'INACTIVE') return supplier.status.toLowerCase() !== 'active';
      return true;
    });
  }, [suppliers, query, supplierFilter]);

  // Tab 5: Supplier Bills Filtering
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const qLower = query.toLowerCase().trim();
      const matchesSearch = !qLower || (
        bill.billNumber.toLowerCase().includes(qLower) ||
        bill.supplierName.toLowerCase().includes(qLower) ||
        bill.orderNumber.toLowerCase().includes(qLower) ||
        bill.status.toLowerCase().includes(qLower) ||
        (bill.lines && bill.lines.some(l => l.sku.toLowerCase().includes(qLower) || l.itemName.toLowerCase().includes(qLower)))
      );
      if (!matchesSearch) return false;

      if (billFilter === 'UNPAID') return bill.status === 'unpaid';
      if (billFilter === 'PARTIALLY_PAID') return bill.status === 'partially_paid';
      if (billFilter === 'PAID') return bill.status === 'paid';
      return true;
    });
  }, [bills, query, billFilter]);

  // Tab 6: Supplier Credits Filtering
  const filteredCredits = useMemo(() => {
    return credits.filter(credit => {
      const qLower = query.toLowerCase().trim();
      return !qLower || (
        credit.creditNumber.toLowerCase().includes(qLower) ||
        credit.supplierName.toLowerCase().includes(qLower) ||
        credit.billNumber.toLowerCase().includes(qLower) ||
        credit.orderNumber.toLowerCase().includes(qLower) ||
        credit.reason.toLowerCase().includes(qLower)
      );
    });
  }, [credits, query]);

  return (
    <div className="sales-screen-layout">
      {/* 1. Executive Purchasing KPI Strip */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">COMMITTED PROCUREMENT</span>
            <ShoppingCart size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">{money(totalCommittedPoValue)}</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{pendingDeliveryCount} Pending</span>
            <span style={{ color: 'var(--sp-text-muted)' }}>· {orders.length - pendingDeliveryCount} received</span>
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">ACCOUNTS PAYABLE</span>
            <Receipt size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">{money(totalAccountsPayable)}</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-warning">{unpaidBillsCount} Unpaid</span>
            <span style={{ color: 'var(--sp-text-muted)' }}>across {bills.length} total bills</span>
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">ACTIVE SUPPLIERS</span>
            <Building2 size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">{suppliers.length} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>Vendors</span></div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">Tier-1 certified</span>
            <span style={{ color: 'var(--sp-text-muted)' }}>Avg {avgSupplierLeadTime}d lead</span>
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">REQUISITIONS & ALERTS</span>
            <Boxes size={13} className="sales-metric-icon" />
          </div>
          <div className="sales-metric-val">{pendingRequisitionsCount} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>Pending</span></div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{requisitions.length} Requests</span>
            <span style={{ color: 'var(--sp-text-muted)' }}>Automated reorder</span>
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs" role="tablist" aria-label="Purchases modules">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <ShoppingCart size={14} />
            <span>Purchase Orders</span>
            <span className="sales-subnav-badge">{orders.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'requisitions' ? 'active' : ''}`}
            onClick={() => setActiveTab('requisitions')}
          >
            <FileText size={14} />
            <span>Requisitions</span>
            <span className="sales-subnav-badge">{requisitions.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'reorder' ? 'active' : ''}`}
            onClick={() => setActiveTab('reorder')}
          >
            <Boxes size={14} />
            <span>Reorder Suggestions</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => setActiveTab('suppliers')}
          >
            <Building2 size={14} />
            <span>Suppliers</span>
            <span className="sales-subnav-badge">{suppliers.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'bills' ? 'active' : ''}`}
            onClick={() => setActiveTab('bills')}
          >
            <Receipt size={14} />
            <span>Supplier Bills</span>
            <span className="sales-subnav-badge">{bills.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'credits' ? 'active' : ''}`}
            onClick={() => setActiveTab('credits')}
          >
            <RotateCcw size={14} />
            <span>Credit Notes</span>
            <span className="sales-subnav-badge">{credits.length}</span>
          </button>
        </div>

        <div className="sales-subnav-actions">
          {activeTab === 'orders' && onNewOrder && (
            <button
              type="button"
              className="button button-primary"
              onClick={onNewOrder}
            >
              <Plus size={13} />
              <span>New purchase order</span>
            </button>
          )}
          {activeTab === 'suppliers' && onNewSupplier && (
            <button
              type="button"
              className="button button-primary"
              onClick={onNewSupplier}
            >
              <Plus size={13} />
              <span>New supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Toolbar: Status Filter Pills (Left) + Search (Right) */}
      {(activeTab === 'orders' || activeTab === 'suppliers' || activeTab === 'bills' || activeTab === 'credits') && (
        <div className="sales-toolbar">
          <div className="sales-pill-group" role="tablist" aria-label="Status filters">
            {activeTab === 'orders' && (
              <>
                <button
                  type="button"
                  className={`sales-pill-btn ${poFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setPoFilter('ALL')}
                >
                  All <span className="sales-pill-count">{orders.length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${poFilter === 'PENDING' ? 'active' : ''}`}
                  onClick={() => setPoFilter('PENDING')}
                >
                  Pending Approval <span className="sales-pill-count">{orders.filter(o => ['draft', 'pending_approval'].includes(o.status)).length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${poFilter === 'APPROVED' ? 'active' : ''}`}
                  onClick={() => setPoFilter('APPROVED')}
                >
                  Approved <span className="sales-pill-count">{orders.filter(o => o.status === 'approved').length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${poFilter === 'PARTIALLY_RECEIVED' ? 'active' : ''}`}
                  onClick={() => setPoFilter('PARTIALLY_RECEIVED')}
                >
                  Partially Received <span className="sales-pill-count">{orders.filter(o => o.status === 'partially_received').length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${poFilter === 'RECEIVED' ? 'active' : ''}`}
                  onClick={() => setPoFilter('RECEIVED')}
                >
                  Received <span className="sales-pill-count">{orders.filter(o => o.status === 'received').length}</span>
                </button>
              </>
            )}

            {activeTab === 'suppliers' && (
              <>
                <button
                  type="button"
                  className={`sales-pill-btn ${supplierFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setSupplierFilter('ALL')}
                >
                  All <span className="sales-pill-count">{suppliers.length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${supplierFilter === 'ACTIVE' ? 'active' : ''}`}
                  onClick={() => setSupplierFilter('ACTIVE')}
                >
                  Active <span className="sales-pill-count">{suppliers.filter(s => s.status.toLowerCase() === 'active').length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${supplierFilter === 'INACTIVE' ? 'active' : ''}`}
                  onClick={() => setSupplierFilter('INACTIVE')}
                >
                  Inactive <span className="sales-pill-count">{suppliers.filter(s => s.status.toLowerCase() !== 'active').length}</span>
                </button>
              </>
            )}

            {activeTab === 'bills' && (
              <>
                <button
                  type="button"
                  className={`sales-pill-btn ${billFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setBillFilter('ALL')}
                >
                  All <span className="sales-pill-count">{bills.length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${billFilter === 'UNPAID' ? 'active' : ''}`}
                  onClick={() => setBillFilter('UNPAID')}
                >
                  Unpaid <span className="sales-pill-count">{bills.filter(b => b.status === 'unpaid').length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${billFilter === 'PARTIALLY_PAID' ? 'active' : ''}`}
                  onClick={() => setBillFilter('PARTIALLY_PAID')}
                >
                  Partially Paid <span className="sales-pill-count">{bills.filter(b => b.status === 'partially_paid').length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${billFilter === 'PAID' ? 'active' : ''}`}
                  onClick={() => setBillFilter('PAID')}
                >
                  Paid <span className="sales-pill-count">{bills.filter(b => b.status === 'paid').length}</span>
                </button>
              </>
            )}
          </div>

          <div className="sales-search-box">
            <Search size={14} className="sales-search-icon" />
            <input
              className="sales-search-input"
              placeholder={
                activeTab === 'orders' ? 'Search orders by PO #, supplier, sku...'
                : activeTab === 'suppliers' ? 'Search suppliers by name, code, contact, city...'
                : activeTab === 'bills' ? 'Search bills by bill #, supplier, PO #...'
                : 'Search credit notes by credit #, supplier, reason...'
              }
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query ? (
              <button type="button" className="sales-search-clear" onClick={() => setQuery('')}>
                <X size={12} />
              </button>
            ) : (
              <kbd className="sales-search-kbd">/</kbd>
            )}
          </div>
        </div>
      )}

      {/* 4. Active Sub-Tab Content */}

      {/* SUB-TAB 1: PURCHASE ORDERS */}
      {activeTab === 'orders' && (
        <div className="sales-table-card">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>ORDER #</th>
                  <th style={{ width: '180px' }}>SUPPLIER</th>
                  <th>ITEMS · RECEIVED / ORDERED</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>TOTAL</th>
                  <th style={{ width: '110px' }}>STATUS</th>
                  <th style={{ width: '220px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length ? (
                  filteredOrders.map(order => {
                    const isFullyReceived = order.lines.every(l => l.receivedQuantity >= l.orderedQuantity);
                    return (
                      <tr key={order.id} className="sales-row">
                        <td>
                          <span className="sales-ref-badge">{order.orderNumber}</span>
                        </td>
                        <td>
                          <div className="sales-customer-cell">
                            <span className="sales-customer-avatar">{getInitials(order.supplierName)}</span>
                            <span className="sales-customer-name" title={order.supplierName}>
                              {order.supplierName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="sales-order-lines-list">
                            {order.lines.map(line => {
                              const done = line.receivedQuantity >= line.orderedQuantity;
                              return (
                                <div key={line.id} className="sales-order-line-item">
                                  <span className="sales-item-sku">{line.sku}</span>
                                  <span className={`sales-fulfillment-tag ${done ? 'shipped' : 'pending'}`}>
                                    {line.receivedQuantity}/{line.orderedQuantity} received
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="sales-amount-cell">
                          {money(order.total)}
                        </td>
                        <td>
                          <Status label={order.status.replace('_', ' ')} />
                        </td>
                        <td>
                          <div className="sales-actions-cell">
                            <CustomFieldEditor resource="purchase_orders" recordId={order.id} label="Fields" />
                            {['draft', 'pending_approval'].includes(order.status) && (
                              <button
                                type="button"
                                className="sales-action-btn primary"
                                onClick={() => onApprove(order)}
                              >
                                <Check size={12} /> {order.status === 'draft' ? 'Approve' : 'Add approval'}
                              </button>
                            )}
                            {['approved', 'partially_received'].includes(order.status) && (
                              <button
                                type="button"
                                className="sales-action-btn primary"
                                onClick={() => onReceive(order)}
                              >
                                <Truck size={12} /> Receive
                              </button>
                            )}
                            {order.lines.some(line => line.returnableQuantity > 0) && (
                              <button
                                type="button"
                                className="sales-action-btn ghost"
                                onClick={() => onReturn(order)}
                              >
                                <RotateCcw size={12} /> Return goods
                              </button>
                            )}
                            {order.lines.some(line => line.billableQuantity > 0) && (
                              <button
                                type="button"
                                className="sales-action-btn secondary"
                                onClick={() => onBill(order)}
                              >
                                <Receipt size={12} /> Record bill
                              </button>
                            )}
                            {isFullyReceived && !order.lines.some(line => line.billableQuantity > 0 || line.returnableQuantity > 0) && (
                              <span className="sales-status-chip completed">
                                <CheckCircle2 size={12} /> Fulfilled
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <ShoppingCart size={24} className="sales-empty-icon" />
                        <div className="sales-empty-title">No purchase orders found</div>
                        <div className="sales-empty-desc">
                          {query || poFilter !== 'ALL'
                            ? 'No purchase orders match your filter criteria.'
                            : 'Create a supplier and start by submitting a purchase order or converting an approved requisition.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: REQUISITIONS */}
      {activeTab === 'requisitions' && (
        <div className="purchases-workflow-wrap">
          {requisitionSection}
        </div>
      )}

      {/* SUB-TAB 3: REORDER SUGGESTIONS */}
      {activeTab === 'reorder' && (
        <div className="purchases-workflow-wrap">
          {reorderSection}
        </div>
      )}

      {/* SUB-TAB 4: SUPPLIERS */}
      {activeTab === 'suppliers' && (
        <div className="sales-table-card">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '220px' }}>SUPPLIER</th>
                  <th style={{ width: '180px' }}>PRIMARY CONTACT</th>
                  <th style={{ width: '130px' }}>LOCATION</th>
                  <th style={{ width: '130px' }}>PAYMENT TERMS</th>
                  <th style={{ width: '110px' }}>LEAD TIME</th>
                  <th style={{ width: '100px' }}>RATING</th>
                  <th style={{ width: '90px' }}>STATUS</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length ? (
                  filteredSuppliers.map(supplier => (
                    <tr key={supplier.id} className="sales-row">
                      <td>
                        <div className="sales-customer-cell">
                          <span className="sales-customer-avatar">{getInitials(supplier.name)}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span className="sales-customer-name" title={supplier.name}>
                              {supplier.name}
                            </span>
                            <span className="sales-sub-ref">{supplier.code}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 500, color: 'var(--sp-text)' }}>{supplier.contactName || '—'}</span>
                          <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>{supplier.email}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                          {supplier.city ? `${supplier.city}, ${supplier.countryCode || 'IN'}` : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="sales-item-tag">
                          Net {supplier.paymentTermsDays || 0} days
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                          {supplier.leadTimeDays || 0} days
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 600, color: '#f59e0b' }}>
                          <Star size={11} fill="#f59e0b" /> {Number(supplier.rating || 0).toFixed(1)}
                        </span>
                      </td>
                      <td>
                        <Status label={supplier.status} />
                      </td>
                      <td>
                        <div className="sales-actions-cell">
                          <CustomFieldEditor resource="suppliers" recordId={supplier.id} label="Fields" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <Building2 size={24} className="sales-empty-icon" />
                        <div className="sales-empty-title">No suppliers found</div>
                        <div className="sales-empty-desc">
                          {query
                            ? 'No suppliers match your search criteria.'
                            : 'Click "+ New supplier" above to register your manufacturing vendors and partners.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: SUPPLIER BILLS */}
      {activeTab === 'bills' && (
        <div className="sales-table-card">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>BILL #</th>
                  <th style={{ width: '160px' }}>SUPPLIER</th>
                  <th style={{ width: '100px' }}>PO REF</th>
                  <th style={{ width: '90px' }}>DUE DATE</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>TOTAL</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>PAID / CREDITED</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>BALANCE</th>
                  <th style={{ width: '85px' }}>STATUS</th>
                  <th style={{ width: '145px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.length ? (
                  filteredBills.map(bill => {
                    const balanceNum = Number(bill.balance || 0);
                    const isDuePast = bill.dueDate && new Date(bill.dueDate).getTime() < Date.now() && balanceNum > 0;
                    return (
                      <tr key={bill.id} className="sales-row">
                        <td>
                          <span className="sales-ref-badge">{bill.billNumber}</span>
                        </td>
                        <td>
                          <div className="sales-customer-cell">
                            <span className="sales-customer-avatar">{getInitials(bill.supplierName)}</span>
                            <span className="sales-customer-name" title={bill.supplierName} style={{ maxWidth: '140px' }}>
                              {bill.supplierName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="sales-sub-ref">{bill.orderNumber || '—'}</span>
                        </td>
                        <td>
                          <span className={`sales-date-cell ${isDuePast ? 'overdue' : ''}`}>
                            {formatDate(bill.dueDate)}
                          </span>
                        </td>
                        <td className="sales-amount-cell">
                          {money(bill.total)}
                        </td>
                        <td className="sales-amount-cell muted" style={{ textAlign: 'right' }}>
                          <div>{money(bill.amountPaid)}</div>
                          {Number(bill.amountCredited || 0) > 0 && (
                            <small style={{ fontSize: '10px', color: 'var(--sp-text-muted)', display: 'block' }}>
                              {money(bill.amountCredited)} cr
                            </small>
                          )}
                        </td>
                        <td className={`sales-amount-cell ${balanceNum > 0 ? 'outstanding' : 'settled'}`}>
                          {money(bill.balance)}
                        </td>
                        <td>
                          <Status label={bill.status.replace('_', ' ')} />
                        </td>
                        <td>
                          <div className="sales-actions-cell">
                            {balanceNum > 0 && (
                              <button
                                type="button"
                                className="sales-action-btn primary"
                                onClick={() => onPayment(bill)}
                              >
                                <CreditCard size={12} /> Pay
                              </button>
                            )}
                            {bill.lines.some(line => line.creditableQuantity > 0) && (
                              <button
                                type="button"
                                className="sales-action-btn ghost"
                                onClick={() => onCredit(bill)}
                              >
                                <RotateCcw size={12} /> Credit
                              </button>
                            )}
                            {balanceNum <= 0 && !bill.lines.some(line => line.creditableQuantity > 0) && (
                              <span className="sales-status-chip completed">
                                <CheckCircle2 size={12} /> Settled
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <Receipt size={24} className="sales-empty-icon" />
                        <div className="sales-empty-title">No supplier bills found</div>
                        <div className="sales-empty-desc">
                          {query || billFilter !== 'ALL'
                            ? 'No supplier bills match your search criteria.'
                            : 'Receive shipped items on approved purchase orders, then click "Record bill" to register payables.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: SUPPLIER CREDIT NOTES */}
      {activeTab === 'credits' && (
        <div className="sales-table-card">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>CREDIT NOTE #</th>
                  <th style={{ width: '180px' }}>SUPPLIER</th>
                  <th style={{ width: '120px' }}>BILL REF</th>
                  <th style={{ width: '120px' }}>PO REF</th>
                  <th>RETURN REASON</th>
                  <th style={{ width: '110px' }}>RETURNED</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>CREDIT TOTAL</th>
                  <th style={{ width: '100px' }}>ISSUED DATE</th>
                </tr>
              </thead>
              <tbody>
                {filteredCredits.length ? (
                  filteredCredits.map(credit => (
                    <tr key={credit.id} className="sales-row">
                      <td>
                        <span className="sales-ref-badge">{credit.creditNumber}</span>
                      </td>
                      <td>
                        <div className="sales-customer-cell">
                          <span className="sales-customer-avatar">{getInitials(credit.supplierName)}</span>
                          <span className="sales-customer-name" title={credit.supplierName}>
                            {credit.supplierName}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="sales-sub-ref">{credit.billNumber}</span>
                      </td>
                      <td>
                        <span className="sales-sub-ref">{credit.orderNumber}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11.5px', color: 'var(--sp-text)', fontWeight: 500 }}>
                          {credit.reason || 'Supplier return'}
                        </span>
                      </td>
                      <td>
                        <span className="sales-item-tag">
                          {credit.creditedUnits} units
                        </span>
                      </td>
                      <td className="sales-amount-cell outstanding">
                        {money(credit.total)}
                      </td>
                      <td>
                        <span className="sales-date-cell">{formatDate(credit.issuedAt)}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <RotateCcw size={24} className="sales-empty-icon" />
                        <div className="sales-empty-title">No supplier credits recorded</div>
                        <div className="sales-empty-desc">
                          {query
                            ? 'No supplier credits match your search criteria.'
                            : 'When a supplier accepts goods return or issues an invoice adjustment, click "Credit" on the bill.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Linear Procurement Lifecycle Pipeline Guide */}
      <div className="sales-pipeline-banner">
        <div className="sales-pipeline-header">
          <div className="sales-pipeline-title">
            <span className="sales-pipeline-dot"></span>
            ERP Procurement Lifecycle Execution Standard
          </div>
          <div className="sales-pipeline-tag">Strict Double-Entry Stock & Accounting Invariants</div>
        </div>

        <div className="sales-pipeline-stages">
          <div className="sales-pipeline-step">
            <div className="sales-step-num">01</div>
            <div className="sales-step-content">
              <b>Requisition</b>
              <span>Item request by floor team with need-by date.</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">02</div>
            <div className="sales-step-content">
              <b>Approval & PO</b>
              <span>Manager approval converts requisition into binding PO.</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">03</div>
            <div className="sales-step-content">
              <b>Goods Receipt</b>
              <span>Stock-in posting updates inventory ledger movements.</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">04</div>
            <div className="sales-step-content">
              <b>Supplier Bill</b>
              <span>Payable recognized against accepted quantities.</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">05</div>
            <div className="sales-step-content">
              <b>Payment / Credit</b>
              <span>Cash payment or debit note reduces payable balance.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
