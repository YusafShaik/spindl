import { useState, useMemo } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Filter,
  Package,
  Receipt,
  RotateCcw,
  Search,
  Send,
  ShoppingBag,
  TrendingUp,
  Truck,
  XCircle,
  X
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { CustomFieldEditor } from '../customers/CustomFieldEditor';
import type { CustomerCreditNote, SalesInvoice, SalesOrder, SalesQuote } from '../../types/sales';

type QuoteAction = 'send' | 'accept' | 'reject' | 'convert';
type SalesTab = 'quotes' | 'orders' | 'invoices' | 'credits';

type QuoteFilter = 'ALL' | 'DRAFT' | 'SENT' | 'ACCEPTED' | 'CONVERTED' | 'REJECTED';
type OrderFilter = 'ALL' | 'OPEN' | 'SHIPPED';
type InvoiceFilter = 'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
type CreditFilter = 'ALL' | 'REFUND_DUE' | 'REFUNDED';

interface SalesDirectoryProps {
  quotes: SalesQuote[];
  orders: SalesOrder[];
  invoices: SalesInvoice[];
  customerCredits: CustomerCreditNote[];
  query: string;
  setQuery: (query: string) => void;
  onQuoteAction: (quote: SalesQuote, action: QuoteAction) => void;
  onDispatch: (order: SalesOrder) => void;
  onInvoice: (order: SalesOrder) => void;
  onPayment: (invoice: SalesInvoice) => void;
  onCredit: (invoice: SalesInvoice) => void;
  onRefund: (credit: CustomerCreditNote) => void;
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

export function SalesDirectory({
  quotes,
  orders,
  invoices,
  customerCredits,
  query,
  setQuery,
  onQuoteAction,
  onDispatch,
  onInvoice,
  onPayment,
  onCredit,
  onRefund
}: SalesDirectoryProps) {
  const [activeTab, setActiveTab] = useState<SalesTab>('quotes');
  const [quoteFilter, setQuoteFilter] = useState<QuoteFilter>('ALL');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('ALL');
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('ALL');
  const [creditFilter, setCreditFilter] = useState<CreditFilter>('ALL');

  const orderByQuote = useMemo(() => new Map(orders.map(order => [order.quoteNumber, order])), [orders]);

  // Executive KPI Calculations
  const quotedPipelineValue = useMemo(() => {
    return quotes
      .filter(q => q.status !== 'rejected')
      .reduce((sum, q) => sum + Number(q.total || 0), 0);
  }, [quotes]);

  const activeQuotesCount = useMemo(() => {
    return quotes.filter(q => q.status === 'draft' || q.status === 'sent' || q.status === 'accepted').length;
  }, [quotes]);

  const openOrders = useMemo(() => {
    return orders.filter(o => o.status !== 'shipped');
  }, [orders]);

  const openOrdersValue = useMemo(() => {
    return openOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  }, [openOrders]);

  const invoicedRevenueTotal = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
  }, [invoices]);

  const outstandingReceivables = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
  }, [invoices]);

  const unpaidInvoicesCount = useMemo(() => {
    return invoices.filter(inv => inv.status !== 'paid').length;
  }, [invoices]);

  const totalRefundDue = useMemo(() => {
    return customerCredits.reduce((sum, c) => sum + Number(c.refundBalance || 0), 0);
  }, [customerCredits]);

  // Tab 1: Quotations Filtering
  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const qLower = query.toLowerCase().trim();
      const matchesSearch = !qLower || (
        quote.quoteNumber.toLowerCase().includes(qLower) ||
        quote.customerName.toLowerCase().includes(qLower) ||
        quote.status.toLowerCase().includes(qLower) ||
        (quote.notes && quote.notes.toLowerCase().includes(qLower)) ||
        quote.lines.some(l => l.sku.toLowerCase().includes(qLower) || l.itemName.toLowerCase().includes(qLower))
      );
      if (!matchesSearch) return false;

      const isConverted = orderByQuote.has(quote.quoteNumber);
      if (quoteFilter === 'DRAFT') return quote.status === 'draft';
      if (quoteFilter === 'SENT') return quote.status === 'sent';
      if (quoteFilter === 'ACCEPTED') return quote.status === 'accepted' && !isConverted;
      if (quoteFilter === 'CONVERTED') return isConverted;
      if (quoteFilter === 'REJECTED') return quote.status === 'rejected';
      return true;
    });
  }, [quotes, query, quoteFilter, orderByQuote]);

  // Tab 2: Sales Orders Filtering
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const qLower = query.toLowerCase().trim();
      const matchesSearch = !qLower || (
        order.orderNumber.toLowerCase().includes(qLower) ||
        order.customerName.toLowerCase().includes(qLower) ||
        order.status.toLowerCase().includes(qLower) ||
        order.quoteNumber.toLowerCase().includes(qLower) ||
        order.lines.some(l => l.sku.toLowerCase().includes(qLower) || l.itemName.toLowerCase().includes(qLower) || l.warehouseName.toLowerCase().includes(qLower))
      );
      if (!matchesSearch) return false;

      if (orderFilter === 'OPEN') return order.status !== 'shipped';
      if (orderFilter === 'SHIPPED') return order.status === 'shipped';
      return true;
    });
  }, [orders, query, orderFilter]);

  // Tab 3: Invoices Filtering
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const qLower = query.toLowerCase().trim();
      const matchesSearch = !qLower || (
        invoice.invoiceNumber.toLowerCase().includes(qLower) ||
        invoice.customerName.toLowerCase().includes(qLower) ||
        invoice.status.toLowerCase().includes(qLower) ||
        invoice.orderNumber.toLowerCase().includes(qLower) ||
        (invoice.lines && invoice.lines.some(l => l.sku.toLowerCase().includes(qLower) || l.itemName.toLowerCase().includes(qLower)))
      );
      if (!matchesSearch) return false;

      if (invoiceFilter === 'UNPAID') return invoice.status === 'unpaid';
      if (invoiceFilter === 'PARTIALLY_PAID') return invoice.status === 'partially_paid';
      if (invoiceFilter === 'PAID') return invoice.status === 'paid';
      return true;
    });
  }, [invoices, query, invoiceFilter]);

  // Tab 4: Customer Credits Filtering
  const filteredCredits = useMemo(() => {
    return customerCredits.filter(credit => {
      const qLower = query.toLowerCase().trim();
      const matchesSearch = !qLower || (
        credit.creditNumber.toLowerCase().includes(qLower) ||
        credit.customerName.toLowerCase().includes(qLower) ||
        credit.invoiceNumber.toLowerCase().includes(qLower) ||
        (credit.reason && credit.reason.toLowerCase().includes(qLower)) ||
        (credit.lines && credit.lines.some(l => l.sku.toLowerCase().includes(qLower) || l.itemName.toLowerCase().includes(qLower)))
      );
      if (!matchesSearch) return false;

      if (creditFilter === 'REFUND_DUE') return Number(credit.refundBalance) > 0;
      if (creditFilter === 'REFUNDED') return Number(credit.refundBalance) <= 0;
      return true;
    });
  }, [customerCredits, query, creditFilter]);

  return (
    <div className="sales-screen-layout">
      {/* 1. Executive Sales KPI Strip */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">QUOTED PIPELINE</span>
            <TrendingUp size={14} className="sales-metric-icon trend" />
          </div>
          <div className="sales-metric-val">{money(quotedPipelineValue)}</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{activeQuotesCount} active</span> across {quotes.length} total quotes
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">ACTIVE ORDERS</span>
            <ShoppingBag size={14} className="sales-metric-icon orders" />
          </div>
          <div className="sales-metric-val">{money(openOrdersValue)}</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{openOrders.length} pending dispatch</span> · {orders.length - openOrders.length} shipped
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">INVOICED RECEIVABLES</span>
            <Receipt size={14} className="sales-metric-icon invoices" />
          </div>
          <div className="sales-metric-val">{money(invoicedRevenueTotal)}</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-warning">{money(outstandingReceivables)} unpaid</span> across {unpaidInvoicesCount} invoices
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">CUSTOMER CREDITS</span>
            <RotateCcw size={14} className="sales-metric-icon credits" />
          </div>
          <div className="sales-metric-val">{money(totalRefundDue)}</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{customerCredits.length} credit notes</span> · pending customer refund
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'quotes' ? 'active' : ''}`}
            onClick={() => setActiveTab('quotes')}
          >
            <FileText size={14} />
            <span>Quotations</span>
            <span className="sales-subnav-badge">{quotes.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <ShoppingBag size={14} />
            <span>Sales Orders</span>
            <span className="sales-subnav-badge">{orders.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            <Receipt size={14} />
            <span>Invoices</span>
            <span className="sales-subnav-badge">{invoices.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'credits' ? 'active' : ''}`}
            onClick={() => setActiveTab('credits')}
          >
            <RotateCcw size={14} />
            <span>Credit Notes & Returns</span>
            <span className="sales-subnav-badge">{customerCredits.length}</span>
          </button>
        </div>
      </div>

      {/* 3. Toolbar: Search + Contextual Status Filter Pills */}
      <div className="sales-toolbar">
        <div className="sales-search-box">
          <Search size={14} className="sales-search-icon" />
          <input
            className="sales-search-input"
            placeholder={
              activeTab === 'quotes' ? 'Search quotations by ref #, customer, items, notes...'
              : activeTab === 'orders' ? 'Search sales orders by order #, customer, warehouse, sku...'
              : activeTab === 'invoices' ? 'Search invoices by invoice #, customer, order #...'
              : 'Search credit notes by credit #, customer, invoice #, reason...'
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

        {/* Tab-Specific Filter Pills */}
        <div className="sales-pill-group">
          {activeTab === 'quotes' && (
            <>
              <button
                type="button"
                className={`sales-pill-btn ${quoteFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setQuoteFilter('ALL')}
              >
                All <span className="sales-pill-count">{quotes.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${quoteFilter === 'DRAFT' ? 'active' : ''}`}
                onClick={() => setQuoteFilter('DRAFT')}
              >
                Draft <span className="sales-pill-count">{quotes.filter(q => q.status === 'draft').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${quoteFilter === 'SENT' ? 'active' : ''}`}
                onClick={() => setQuoteFilter('SENT')}
              >
                Sent <span className="sales-pill-count">{quotes.filter(q => q.status === 'sent').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${quoteFilter === 'ACCEPTED' ? 'active' : ''}`}
                onClick={() => setQuoteFilter('ACCEPTED')}
              >
                Accepted <span className="sales-pill-count">{quotes.filter(q => q.status === 'accepted' && !orderByQuote.has(q.quoteNumber)).length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${quoteFilter === 'CONVERTED' ? 'active' : ''}`}
                onClick={() => setQuoteFilter('CONVERTED')}
              >
                Converted <span className="sales-pill-count">{quotes.filter(q => orderByQuote.has(q.quoteNumber)).length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${quoteFilter === 'REJECTED' ? 'active' : ''}`}
                onClick={() => setQuoteFilter('REJECTED')}
              >
                Rejected <span className="sales-pill-count">{quotes.filter(q => q.status === 'rejected').length}</span>
              </button>
            </>
          )}

          {activeTab === 'orders' && (
            <>
              <button
                type="button"
                className={`sales-pill-btn ${orderFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setOrderFilter('ALL')}
              >
                All <span className="sales-pill-count">{orders.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${orderFilter === 'OPEN' ? 'active' : ''}`}
                onClick={() => setOrderFilter('OPEN')}
              >
                Open / Confirmed <span className="sales-pill-count">{orders.filter(o => o.status !== 'shipped').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${orderFilter === 'SHIPPED' ? 'active' : ''}`}
                onClick={() => setOrderFilter('SHIPPED')}
              >
                Shipped <span className="sales-pill-count">{orders.filter(o => o.status === 'shipped').length}</span>
              </button>
            </>
          )}

          {activeTab === 'invoices' && (
            <>
              <button
                type="button"
                className={`sales-pill-btn ${invoiceFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setInvoiceFilter('ALL')}
              >
                All <span className="sales-pill-count">{invoices.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${invoiceFilter === 'UNPAID' ? 'active' : ''}`}
                onClick={() => setInvoiceFilter('UNPAID')}
              >
                Unpaid <span className="sales-pill-count">{invoices.filter(i => i.status === 'unpaid').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${invoiceFilter === 'PARTIALLY_PAID' ? 'active' : ''}`}
                onClick={() => setInvoiceFilter('PARTIALLY_PAID')}
              >
                Partially Paid <span className="sales-pill-count">{invoices.filter(i => i.status === 'partially_paid').length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${invoiceFilter === 'PAID' ? 'active' : ''}`}
                onClick={() => setInvoiceFilter('PAID')}
              >
                Paid <span className="sales-pill-count">{invoices.filter(i => i.status === 'paid').length}</span>
              </button>
            </>
          )}

          {activeTab === 'credits' && (
            <>
              <button
                type="button"
                className={`sales-pill-btn ${creditFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setCreditFilter('ALL')}
              >
                All <span className="sales-pill-count">{customerCredits.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${creditFilter === 'REFUND_DUE' ? 'active' : ''}`}
                onClick={() => setCreditFilter('REFUND_DUE')}
              >
                Refund Due <span className="sales-pill-count">{customerCredits.filter(c => Number(c.refundBalance) > 0).length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${creditFilter === 'REFUNDED' ? 'active' : ''}`}
                onClick={() => setCreditFilter('REFUNDED')}
              >
                Refunded <span className="sales-pill-count">{customerCredits.filter(c => Number(c.refundBalance) <= 0).length}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4. Active Sub-Tab Table Panel */}
      <div className="sales-table-card">
        {/* SUB-TAB 1: QUOTATIONS */}
        {activeTab === 'quotes' && (
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>QUOTE #</th>
                  <th style={{ width: '170px' }}>CUSTOMER</th>
                  <th>ITEMS & SPECIFICATIONS</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>TOTAL</th>
                  <th style={{ width: '100px' }}>VALID UNTIL</th>
                  <th style={{ width: '90px' }}>STATUS</th>
                  <th style={{ width: '180px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.length ? (
                  filteredQuotes.map(quote => {
                    const converted = orderByQuote.has(quote.quoteNumber);
                    return (
                      <tr key={quote.id} className="sales-row">
                        <td>
                          <span className="sales-ref-badge">{quote.quoteNumber}</span>
                        </td>
                        <td>
                          <div className="sales-customer-cell">
                            <span className="sales-customer-avatar">{getInitials(quote.customerName)}</span>
                            <span className="sales-customer-name" title={quote.customerName}>
                              {quote.customerName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="sales-items-preview">
                            {quote.lines.map((line, idx) => (
                              <span key={line.id || idx} className="sales-item-tag">
                                <span className="sales-item-sku">{line.sku}</span>
                                <span className="sales-item-qty">× {line.quantity}</span>
                              </span>
                            ))}
                            {quote.notes && (
                              <span className="sales-quote-note" title={quote.notes}>
                                · {quote.notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="sales-amount-cell">
                          {money(quote.total)}
                        </td>
                        <td>
                          <span className="sales-date-cell">{formatDate(quote.validUntil)}</span>
                        </td>
                        <td>
                          <Status label={converted ? 'converted' : quote.status} />
                        </td>
                        <td>
                          <div className="sales-actions-cell">
                            <CustomFieldEditor resource="quotes" recordId={quote.id} />
                            {converted ? (
                              <span className="sales-status-chip converted">
                                <CheckCircle2 size={12} /> Converted
                              </span>
                            ) : quote.status === 'draft' ? (
                              <button
                                type="button"
                                className="sales-action-btn primary"
                                onClick={() => onQuoteAction(quote, 'send')}
                              >
                                <Send size={12} /> Send
                              </button>
                            ) : quote.status === 'sent' ? (
                              <>
                                <button
                                  type="button"
                                  className="sales-action-btn primary"
                                  onClick={() => onQuoteAction(quote, 'accept')}
                                >
                                  <Check size={12} /> Accept
                                </button>
                                <button
                                  type="button"
                                  className="sales-action-btn ghost"
                                  onClick={() => onQuoteAction(quote, 'reject')}
                                >
                                  <XCircle size={12} /> Reject
                                </button>
                              </>
                            ) : quote.status === 'accepted' ? (
                              <button
                                type="button"
                                className="sales-action-btn primary"
                                onClick={() => onQuoteAction(quote, 'convert')}
                              >
                                <ShoppingBag size={12} /> Convert to order
                              </button>
                            ) : (
                              <span className="sales-status-chip closed">Closed</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <FileText size={24} className="sales-empty-icon" />
                        <div className="sales-empty-title">No quotations found</div>
                        <div className="sales-empty-desc">
                          {query || quoteFilter !== 'ALL'
                            ? 'No quotes match your search or filter criteria. Try resetting filters.'
                            : 'Create a draft quotation using "New quote" in the workspace header to begin a sale.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUB-TAB 2: SALES ORDERS */}
        {activeTab === 'orders' && (
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>ORDER #</th>
                  <th style={{ width: '170px' }}>CUSTOMER</th>
                  <th style={{ width: '110px' }}>QUOTE REF</th>
                  <th>ITEMS · WAREHOUSE · FULFILLMENT</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>TOTAL</th>
                  <th style={{ width: '90px' }}>STATUS</th>
                  <th style={{ width: '180px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length ? (
                  filteredOrders.map(order => (
                    <tr key={order.id} className="sales-row">
                      <td>
                        <span className="sales-ref-badge">{order.orderNumber}</span>
                      </td>
                      <td>
                        <div className="sales-customer-cell">
                          <span className="sales-customer-avatar">{getInitials(order.customerName)}</span>
                          <span className="sales-customer-name" title={order.customerName}>
                            {order.customerName}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="sales-sub-ref">{order.quoteNumber || '—'}</span>
                      </td>
                      <td>
                        <div className="sales-order-lines-list">
                          {order.lines.map(line => {
                            const isShipped = line.shippedQuantity >= line.quantity;
                            return (
                              <div key={line.id} className="sales-order-line-item">
                                <span className="sales-item-sku">{line.sku}</span>
                                <span className="sales-warehouse-pill">{line.warehouseName || line.warehouseCode || 'Main'}</span>
                                <span className={`sales-fulfillment-tag ${isShipped ? 'shipped' : 'pending'}`}>
                                  {line.shippedQuantity}/{line.quantity} shipped
                                  {line.reservedQuantity > 0 && ` (${line.reservedQuantity} reserved)`}
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
                          <CustomFieldEditor resource="sales_orders" recordId={order.id} />
                          {order.status !== 'shipped' && order.lines.some(line => line.reservedQuantity > 0) && (
                            <button
                              type="button"
                              className="sales-action-btn primary"
                              onClick={() => onDispatch(order)}
                            >
                              <Truck size={12} /> Dispatch
                            </button>
                          )}
                          {order.lines.some(line => line.invoiceableQuantity > 0) && (
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              onClick={() => onInvoice(order)}
                            >
                              <Receipt size={12} /> Invoice
                            </button>
                          )}
                          {order.status === 'shipped' && !order.lines.some(line => line.invoiceableQuantity > 0) && (
                            <span className="sales-status-chip completed">
                              <CheckCircle2 size={12} /> Fulfilled
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <ShoppingBag size={24} className="sales-empty-icon" />
                        <div className="sales-empty-title">No sales orders found</div>
                        <div className="sales-empty-desc">
                          {query || orderFilter !== 'ALL'
                            ? 'No sales orders match your search or filter criteria.'
                            : 'Accept an open quote and convert it to reserve warehouse inventory and generate an order.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUB-TAB 3: INVOICES */}
        {activeTab === 'invoices' && (
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>INVOICE #</th>
                  <th style={{ width: '130px' }}>CUSTOMER</th>
                  <th style={{ width: '100px' }}>ORDER REF</th>
                  <th style={{ width: '90px' }}>DUE DATE</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>TOTAL</th>
                  <th style={{ width: '85px', textAlign: 'right' }}>PAID</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>BALANCE</th>
                  <th style={{ width: '85px' }}>STATUS</th>
                  <th style={{ width: '240px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length ? (
                  filteredInvoices.map(invoice => {
                    const balanceNum = Number(invoice.balance || 0);
                    const isDuePast = invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now() && balanceNum > 0;
                    return (
                      <tr key={invoice.id} className="sales-row">
                        <td>
                          <span className="sales-ref-badge">{invoice.invoiceNumber}</span>
                        </td>
                        <td>
                          <div className="sales-customer-cell">
                            <span className="sales-customer-avatar">{getInitials(invoice.customerName)}</span>
                            <span className="sales-customer-name" title={invoice.customerName}>
                              {invoice.customerName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="sales-sub-ref">{invoice.orderNumber || '—'}</span>
                        </td>
                        <td>
                          <span className={`sales-date-cell ${isDuePast ? 'overdue' : ''}`}>
                            {formatDate(invoice.dueDate)}
                          </span>
                        </td>
                        <td className="sales-amount-cell">
                          {money(invoice.total)}
                        </td>
                        <td className="sales-amount-cell muted">
                          {money(invoice.amountPaid)}
                        </td>
                        <td className={`sales-amount-cell ${balanceNum > 0 ? 'outstanding' : 'settled'}`}>
                          {money(invoice.balance)}
                        </td>
                        <td>
                          <Status label={invoice.status.replace('_', ' ')} />
                        </td>
                        <td>
                          <div className="sales-actions-cell">
                            <CustomFieldEditor resource="invoices" recordId={invoice.id} />
                            {balanceNum > 0 && (
                              <button
                                type="button"
                                className="sales-action-btn primary"
                                onClick={() => onPayment(invoice)}
                              >
                                <CreditCard size={12} /> Record payment
                              </button>
                            )}
                            {invoice.lines?.some(line => line.creditEligibleQuantity > 0) && (
                              <button
                                type="button"
                                className="sales-action-btn ghost"
                                onClick={() => onCredit(invoice)}
                              >
                                <RotateCcw size={12} /> Return / credit
                              </button>
                            )}
                            {balanceNum <= 0 && !invoice.lines?.some(line => line.creditEligibleQuantity > 0) && (
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
                        <div className="sales-empty-title">No invoices found</div>
                        <div className="sales-empty-desc">
                          {query || invoiceFilter !== 'ALL'
                            ? 'No invoices match your search or filter criteria.'
                            : 'Dispatch shipped items on confirmed sales orders to issue invoices and track balances.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUB-TAB 4: CUSTOMER CREDIT NOTES */}
        {activeTab === 'credits' && (
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>CREDIT #</th>
                  <th style={{ width: '160px' }}>CUSTOMER</th>
                  <th style={{ width: '110px' }}>INVOICE REF</th>
                  <th>REASON & RETURN DISPOSITION</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>CREDIT</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>REFUND DUE</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>REFUNDED</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredCredits.length ? (
                  filteredCredits.map(credit => {
                    const refundDue = Number(credit.refundBalance || 0);
                    return (
                      <tr key={credit.id} className="sales-row">
                        <td>
                          <span className="sales-ref-badge">{credit.creditNumber}</span>
                        </td>
                        <td>
                          <div className="sales-customer-cell">
                            <span className="sales-customer-avatar">{getInitials(credit.customerName)}</span>
                            <span className="sales-customer-name" title={credit.customerName}>
                              {credit.customerName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="sales-sub-ref">{credit.invoiceNumber || '—'}</span>
                        </td>
                        <td>
                          <div className="sales-credit-reason">
                            <span className="sales-reason-text">{credit.reason || 'Customer return'}</span>
                            <div className="sales-credit-lines">
                              {credit.lines?.map((line, idx) => (
                                <span key={line.id || idx} className="sales-disposition-pill">
                                  {line.sku} × {line.quantity} ({line.disposition.toLowerCase()})
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="sales-amount-cell">
                          {money(credit.total)}
                        </td>
                        <td className={`sales-amount-cell ${refundDue > 0 ? 'outstanding' : 'settled'}`}>
                          {money(credit.refundBalance)}
                        </td>
                        <td className="sales-amount-cell muted">
                          {money(credit.amountRefunded)}
                        </td>
                        <td>
                          <div className="sales-actions-cell">
                            {refundDue > 0 ? (
                              <button
                                type="button"
                                className="sales-action-btn primary"
                                onClick={() => onRefund(credit)}
                              >
                                <RotateCcw size={12} /> Record refund
                              </button>
                            ) : (
                              <span className="sales-status-chip completed">
                                <CheckCircle2 size={12} /> Refunded
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <RotateCcw size={24} className="sales-empty-icon" />
                        <div className="sales-empty-title">No customer credit notes recorded</div>
                        <div className="sales-empty-desc">
                          {query || creditFilter !== 'ALL'
                            ? 'No credit notes match your search or filter criteria.'
                            : 'When a customer returns invoiced goods, click "Return / credit" on the invoice to issue a credit note.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Linear Sales Lifecycle Pipeline Guide */}
      <div className="sales-pipeline-banner">
        <div className="sales-pipeline-header">
          <div className="sales-pipeline-title">
            <span className="sales-pipeline-dot"></span>
            ERP Sales Lifecycle Execution Standard
          </div>
          <div className="sales-pipeline-tag">Strict Double-Entry Stock & Accounting Invariants</div>
        </div>

        <div className="sales-pipeline-stages">
          <div className="sales-pipeline-step">
            <div className="sales-step-num">01</div>
            <div className="sales-step-content">
              <b>Quotation</b>
              <span>Commercial pricing agreement with validity expiry.</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">02</div>
            <div className="sales-step-content">
              <b>Sales Order</b>
              <span>Conversion automatically reserves warehouse stock.</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">03</div>
            <div className="sales-step-content">
              <b>Fulfillment Dispatch</b>
              <span>Physical shipment posts negative inventory ledger movements.</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">04</div>
            <div className="sales-step-content">
              <b>Invoice & Collection</b>
              <span>Invoiced strictly against shipped units; ledger payments apply to balance.</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">05</div>
            <div className="sales-step-content">
              <b>Return / Credit Note</b>
              <span>Invoice lines return to warehouse disposition with cash refund ledger.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
