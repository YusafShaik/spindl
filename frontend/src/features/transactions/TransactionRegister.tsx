import type { ReactNode } from 'react';
import { TransactionTable } from '../../components/ui/TransactionTable';
import type { TransactionRecord } from '../../types/transaction';

interface TransactionRegisterProps {
  data: TransactionRecord[];
  type: string;
  setType: (type: string) => void;
  from: string;
  setFrom: (date: string) => void;
  to: string;
  setTo: (date: string) => void;
  invoiceSettings: ReactNode;
}

const transactionTypes = [
  ['ALL', 'All activity'],
  ['SALES_INVOICE', 'Sales invoices'],
  ['CUSTOMER_PAYMENT', 'Customer payments'],
  ['CUSTOMER_CREDIT', 'Customer credits'],
  ['CUSTOMER_REFUND', 'Customer refunds'],
  ['SUPPLIER_BILL', 'Supplier bills'],
  ['SUPPLIER_PAYMENT', 'Supplier payments'],
  ['SUPPLIER_CREDIT', 'Supplier credits'],
] as const;

export function TransactionRegister({ data, type, setType, from, setFrom, to, setTo, invoiceSettings }: TransactionRegisterProps) {
  return <div className="transaction-register-layout">
    {invoiceSettings}
    <section className="panel directory-panel">
      <div className="panel-header directory-top"><div><h2>Financial transactions <span className="record-count">{data.length}</span></h2><p>Latest 500 events across sales receivables and supplier payables.</p></div></div>
      <div className="transaction-filters">
        <label>Type<select value={type} onChange={(event) => setType(event.target.value)}>{transactionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button className="filter-button" onClick={() => { setType('ALL'); setFrom(''); setTo(''); }}>Reset filters</button>
      </div>
      <TransactionTable transactions={data} />
    </section>
  </div>;
}
