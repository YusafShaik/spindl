import { ArrowDownLeft, ArrowUpRight, RotateCcw } from 'lucide-react';
import { Status } from './Status.tsx';
import { formatCurrency } from '../../lib/utils/currency.ts';
import type { TransactionRecord } from '../../types/transaction';

interface TransactionTableProps {
  query?: string;
  transactions?: TransactionRecord[];
  typeFilter?: string;
}

function getCounterpartyTone(name: string): string {
  const tones = ['lavender', 'peach', 'blue', 'green'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return tones[Math.abs(hash) % tones.length];
}

function getInitials(name: string): string {
  if (!name) return 'TX';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function truncateRef(ref: string): string {
  if (!ref) return '—';
  if (ref.length <= 22) return ref;
  return `${ref.slice(0, 10)}…${ref.slice(-8)}`;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}

function formatType(type: string): string {
  switch (type) {
    case 'SALES_INVOICE': return 'Sales Invoice';
    case 'CUSTOMER_PAYMENT': return 'Customer Payment';
    case 'CUSTOMER_CREDIT': return 'Customer Credit';
    case 'CUSTOMER_REFUND': return 'Customer Refund';
    case 'SUPPLIER_BILL': return 'Supplier Bill';
    case 'SUPPLIER_PAYMENT': return 'Supplier Payment';
    case 'SUPPLIER_CREDIT': return 'Supplier Credit';
    default: return type.replaceAll('_', ' ');
  }
}

export function TransactionTable({ query = '', transactions = [], typeFilter = 'ALL' }: TransactionTableProps) {
  const filtered = transactions.filter((row) => {
    const matchesQuery = `${row.reference} ${row.counterparty} ${row.type} ${row.method || ''} ${row.direction}`
      .toLowerCase()
      .includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (typeFilter === 'ALL') return true;
    if (typeFilter === 'INVOICE') return row.type.toLowerCase().includes('invoice') || row.direction === 'RECEIVABLE' || row.direction === 'IN';
    if (typeFilter === 'BILL') return row.type.toLowerCase().includes('bill') || row.type.toLowerCase().includes('purchase') || row.direction === 'PAYABLE' || row.direction === 'OUT';
    if (typeFilter === 'PAYMENT') return row.type.toLowerCase().includes('payment') || Boolean(row.method);
    if (typeFilter === 'CREDIT') return row.type.toLowerCase().includes('credit') || row.direction === 'CREDIT';
    return true;
  });

  return (
    <div className="sales-table-scroll">
      <table className="sales-table">
        <thead>
          <tr>
            <th style={{ width: '170px' }}>REFERENCE</th>
            <th>CUSTOMER / SUPPLIER</th>
            <th style={{ width: '160px' }}>TYPE</th>
            <th style={{ width: '170px' }}>DATE & TIME</th>
            <th style={{ textAlign: 'right', width: '140px' }}>AMOUNT</th>
            <th style={{ width: '130px' }}>STATUS</th>
            <th style={{ textAlign: 'right', width: '120px' }}>FLOW</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length ? (
            filtered.map((row) => {
              const dir = (row.direction || '').toUpperCase();
              const isInflow = dir === 'IN' || dir === 'INFLOW' || dir === 'RECEIVABLE' || dir === 'CASH_IN';
              const isCredit = dir === 'CREDIT';
              const isOutflow = !isInflow && !isCredit;
              const tone = getCounterpartyTone(row.counterparty || 'Company');
              const initials = getInitials(row.counterparty || 'TX');

              return (
                <tr key={`${row.type}-${row.id}`} className="sales-row">
                  <td>
                    <span className="sales-ref-badge" title={row.reference}>
                      {truncateRef(row.reference)}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`party-avatar ${tone}`}>{initials}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                          {row.counterparty}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                          {row.method ? row.method.replaceAll('_', ' ') : 'Standard ledger'}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className={`tx-type-badge ${row.type}`}>
                      {formatType(row.type)}
                    </span>
                  </td>

                  <td>
                    <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDateTime(row.occurredAt)}
                    </span>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: '12.5px',
                        color: isInflow ? '#059669' : isCredit ? '#7c3aed' : '#dc2626'
                      }}
                    >
                      {isInflow ? '+' : isCredit ? '⟲ ' : '-'}{formatCurrency(row.amount)}
                    </span>
                  </td>

                  <td>
                    <Status label={row.status.replaceAll('_', ' ')} />
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    {isInflow ? (
                      <span className="tx-flow-pill inflow">
                        <ArrowUpRight size={11} aria-hidden="true" />
                        <span>Inflow</span>
                      </span>
                    ) : isCredit ? (
                      <span className="tx-flow-pill credit">
                        <RotateCcw size={11} aria-hidden="true" />
                        <span>Credit</span>
                      </span>
                    ) : (
                      <span className="tx-flow-pill outflow">
                        <ArrowDownLeft size={11} aria-hidden="true" />
                        <span>Outflow</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td className="sales-empty-cell" colSpan={7}>
                <div className="sales-empty-state">
                  <div className="sales-empty-title">No transactions found</div>
                  <div className="sales-empty-desc">
                    {query ? `No transactions match "${query}".` : 'No financial transaction events recorded yet.'}
                  </div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
