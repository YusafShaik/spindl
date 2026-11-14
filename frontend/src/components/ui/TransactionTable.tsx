import { Status } from './Status.tsx';
import { formatCurrency } from '../../lib/utils/currency.ts';
import type { TransactionRecord } from '../../types/transaction';

interface TransactionTableProps { query?: string; transactions?: TransactionRecord[]; }

export function TransactionTable({ query = '', transactions = [] }: TransactionTableProps) {
  const filtered = transactions.filter((row) =>
    `${row.reference} ${row.counterparty} ${row.type} ${row.method || ''} ${row.direction}`.toLowerCase().includes(query.toLowerCase()),
  );

  return <div className="table-scroll"><table>
    <thead><tr><th>REFERENCE</th><th>CUSTOMER / SUPPLIER</th><th>TYPE</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th><th>DIRECTION</th></tr></thead>
    <tbody>{filtered.length ? filtered.map((row) => (
      <tr key={`${row.type}-${row.id}`}>
        <td className="ref-cell">{row.reference}</td>
        <td>{row.counterparty}</td>
        <td><span className="type-cell">{row.type.replaceAll('_', ' ')}</span>{row.method && <small className="transaction-method"> · {row.method.replaceAll('_', ' ')}</small>}</td>
        <td className="date-cell">{new Date(row.occurredAt).toLocaleString()}</td>
        <td className="amount-cell">{formatCurrency(row.amount)}</td>
        <td><Status label={row.status.replaceAll('_', ' ')} /></td>
        <td>{row.direction.replaceAll('_', ' ')}</td>
      </tr>
    )) : <tr><td className="empty-cell" colSpan={7}>{query ? `No transactions match “${query}”` : 'No transactions recorded yet'}</td></tr>}</tbody>
  </table></div>;
}
