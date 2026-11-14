import type { ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { CustomFieldEditor } from '../customers/CustomFieldEditor';
import type { PurchaseOrder, SupplierBill, SupplierCreditNote, SupplierSummary } from '../../types/purchasing';

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
  requisitionSection: ReactNode;
  reorderSection: ReactNode;
}

export function PurchaseDirectory({ orders, bills, credits, payables, suppliers, query, setQuery, onApprove, onReceive, onReturn, onBill, onPayment, onCredit, onNewSupplier, requisitionSection, reorderSection }: PurchaseDirectoryProps) {
  const format = (amount: number|string|null|undefined) => `₹ ${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return <div className="purchase-layout">
    <section className="panel directory-panel"><div className="panel-header directory-top"><div><h2>Purchase orders <span className="record-count">{orders.length}</span></h2><p>Create orders, approve them, and record receipts, supplier bills, or returns.</p></div><button className="filter-button" onClick={onNewSupplier}><Plus size={14}/> New supplier</button></div><div className="table-controls"><div className="search-box"><Search size={15}/><input className="search-input" placeholder="Search orders or suppliers..." value={query} onChange={e => setQuery(e.target.value)}/><kbd>/</kbd></div><span className="purchase-supplier-count">{suppliers.length} active suppliers</span></div><div className="table-scroll"><table><thead><tr><th>ORDER</th><th>SUPPLIER</th><th>LINES</th><th>ORDER TOTAL</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{orders.length ? orders.map(order => <tr key={order.id}><td className="ref-cell">{order.orderNumber}</td><td>{order.supplierName}</td><td>{order.lines.map(line => `${line.sku} · ${line.receivedQuantity}/${line.orderedQuantity}`).join(', ')}</td><td className="amount-cell">{format(order.total)}</td><td><Status label={order.status.replace('_', ' ')}/></td><td><div className="action-inline"><CustomFieldEditor resource="purchase_orders" recordId={order.id}/>{['draft','pending_approval'].includes(order.status) ? <button className="mini-action" onClick={() => onApprove(order)}>{order.status==='draft'?'Approve':'Add approval'}</button> : ['approved','partially_received'].includes(order.status) ? <button className="mini-action" onClick={() => onReceive(order)}>Receive</button> : null}{order.lines.some(line=>line.returnableQuantity>0)&&<button className="mini-action muted" onClick={()=>onReturn(order)}>Return goods</button>}{order.lines.some(line=>line.billableQuantity>0)&&<button className="mini-action" onClick={()=>onBill(order)}>Record bill</button>}</div></td></tr>) : <tr><td className="empty-cell" colSpan={6}>{query ? 'No purchase orders match your search.' : 'No purchase orders yet. Start by creating a supplier, then create an order.'}</td></tr>}</tbody></table></div></section>
    {requisitionSection}
    {reorderSection}
    <section className="panel suppliers-panel"><div className="panel-header"><div><h2>Suppliers <span className="record-count">{suppliers.length}</span></h2><p>{format(payables)} total unpaid bills</p></div></div><div className="supplier-list">{suppliers.length ? suppliers.map(supplier => <div className="supplier-row" key={supplier.id}><span className="party-avatar peach">{supplier.name.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()}</span><span className="party-name"><b>{supplier.name}</b><small>{supplier.code} · {supplier.email}</small></span><Status label={supplier.status}/><CustomFieldEditor resource="suppliers" recordId={supplier.id}/></div>) : <div className="empty-cell">No suppliers added yet.</div>}</div></section>
    <section className="panel directory-panel"><div className="panel-header directory-top"><div><h2>Supplier bills <span className="record-count">{bills.length}</span></h2><p>Record payments and supplier credits against open balances.</p></div><b className="payables-total">{format(payables)} payable</b></div><div className="table-scroll"><table><thead><tr><th>BILL</th><th>SUPPLIER</th><th>PURCHASE ORDER</th><th>DUE</th><th>TOTAL</th><th>PAID</th><th>CREDITED</th><th>BALANCE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{bills.length?bills.map(bill=><tr key={bill.id}><td className="ref-cell">{bill.billNumber}</td><td>{bill.supplierName}</td><td>{bill.orderNumber}</td><td className="date-cell">{bill.dueDate}</td><td className="amount-cell">{format(bill.total)}</td><td>{format(bill.amountPaid)}</td><td>{format(bill.amountCredited)}</td><td className="amount-cell">{format(bill.balance)}</td><td><Status label={bill.status.replace('_',' ')}/></td><td><div className="action-inline">{Number(bill.balance)>0&&<button className="mini-action" onClick={()=>onPayment(bill)}>Pay</button>}{bill.lines.some(line=>line.creditableQuantity>0)&&<button className="mini-action muted" onClick={()=>onCredit(bill)}>Credit</button>}</div></td></tr>):<tr><td className="empty-cell" colSpan={10}>No supplier bills yet. Receive a purchase order, then record its bill.</td></tr>}</tbody></table></div></section>
    <section className="panel directory-panel"><div className="panel-header directory-top"><div><h2>Supplier credit notes <span className="record-count">{credits.length}</span></h2><p>Credit notes return billed goods and reduce the supplier payable balance.</p></div></div><div className="table-scroll"><table><thead><tr><th>CREDIT NOTE</th><th>SUPPLIER</th><th>BILL</th><th>PURCHASE ORDER</th><th>REASON</th><th>UNITS</th><th>CREDIT</th><th>DATE</th></tr></thead><tbody>{credits.length?credits.map(credit=><tr key={credit.id}><td className="ref-cell">{credit.creditNumber}</td><td>{credit.supplierName}</td><td>{credit.billNumber}</td><td>{credit.orderNumber}</td><td>{credit.reason}</td><td>{credit.creditedUnits}</td><td className="amount-cell">{format(credit.total)}</td><td className="date-cell">{new Date(credit.issuedAt).toLocaleDateString()}</td></tr>):<tr><td className="empty-cell" colSpan={8}>No supplier credits recorded yet.</td></tr>}</tbody></table></div></section>
    <div className="purchase-footnote">Supplier credits are capped by both uncredited billed quantities and the bill’s balance after payments. They post the return and stock movement atomically.</div>
  </div>;
}
