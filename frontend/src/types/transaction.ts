export interface TransactionRecord {
  id: string;
  reference: string;
  counterparty: string;
  type: string;
  method?: string | null;
  direction: string;
  occurredAt: string;
  amount: number | string;
  status: string;
}
