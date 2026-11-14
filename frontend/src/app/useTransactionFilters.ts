import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { API, apiFetch } from '../lib/api/client';
import type { TransactionRecord } from '../types/transaction';

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isTransaction(value: unknown): value is TransactionRecord { return isRecord(value) && typeof value.id === 'string' && typeof value.reference === 'string' && typeof value.counterparty === 'string' && typeof value.type === 'string' && typeof value.direction === 'string' && typeof value.occurredAt === 'string' && (typeof value.amount === 'number' || typeof value.amount === 'string') && typeof value.status === 'string'; }
function messageFrom(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export function useTransactionFilters(section: string, setTransactions: Dispatch<SetStateAction<TransactionRecord[]>>, notify: (message: string) => void) {
  const [transactionType, setTransactionType] = useState('ALL');
  const [transactionFrom, setTransactionFrom] = useState('');
  const [transactionTo, setTransactionTo] = useState('');
  useEffect(() => {
    if (section !== 'Transactions') return;
    const params = new URLSearchParams();
    if (transactionType !== 'ALL') params.set('type', transactionType);
    if (transactionFrom) params.set('from', transactionFrom);
    if (transactionTo) params.set('to', transactionTo);
    void apiFetch(`${API}/transactions?${params}`).then(async (response) => {
      if (!response.ok) throw new Error('Could not load transactions');
      const result: unknown = await response.json();
      if (!Array.isArray(result) || !result.every(isTransaction)) throw new Error('Invalid transactions response');
      setTransactions(result);
    }).catch((error: unknown) => notify(messageFrom(error)));
  }, [section, transactionType, transactionFrom, transactionTo]);
  return { transactionType, setTransactionType, transactionFrom, setTransactionFrom, transactionTo, setTransactionTo };
}
