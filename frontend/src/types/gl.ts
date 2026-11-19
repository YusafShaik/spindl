export type GlAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type GlNormalBalance = 'DEBIT' | 'CREDIT';
export type GlJournalSourceType = 'MANUAL' | 'INVOICE' | 'SUPPLIER_BILL' | 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT' | 'POS_SALE' | 'PERIOD_CLOSE';
export type GlJournalStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

export interface GlAccount {
  id: string;
  tenantId: string;
  accountCode: string;
  accountName: string;
  accountType: GlAccountType;
  subType: string;
  normalBalance: GlNormalBalance;
  parentAccountId?: string | null;
  currency: string;
  isActive: boolean;
  isSystem: boolean;
  description?: string | null;
  currentBalance: number;
  createdAt: string;
}

export interface CreateGlAccountPayload {
  accountCode: string;
  accountName: string;
  accountType: GlAccountType;
  subType: string;
  normalBalance: GlNormalBalance;
  parentAccountId?: string | null;
  description?: string;
}

export interface GlJournalLine {
  id: string;
  lineNumber: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: GlAccountType;
  debitAmount: number;
  creditAmount: number;
  description?: string | null;
  partyName?: string | null;
}

export interface GlJournalEntry {
  id: string;
  tenantId: string;
  entryNumber: string;
  postingDate: string;
  sourceType: GlJournalSourceType;
  sourceReferenceId?: string | null;
  sourceReferenceNumber?: string | null;
  memo: string;
  status: GlJournalStatus;
  totalDebit: number;
  totalCredit: number;
  createdByUserId?: string | null;
  createdAt: string;
  postedAt: string;
  lines: GlJournalLine[];
}

export interface CreateJournalLinePayload {
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  partyName?: string;
}

export interface CreateJournalEntryPayload {
  postingDate: string;
  sourceType: GlJournalSourceType;
  sourceReferenceId?: string | null;
  sourceReferenceNumber?: string | null;
  memo: string;
  lines: CreateJournalLinePayload[];
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: GlAccountType;
  subType: string;
  totalDebit: number;
  totalCredit: number;
  netDebit: number;
  netCredit: number;
}

export interface TrialBalanceReport {
  asOfDate: string;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  outOfBalanceAmount: number;
}

export interface AccountSummaryRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  subType: string;
  amount: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  currentAssets: AccountSummaryRow[];
  totalCurrentAssets: number;
  fixedAssets: AccountSummaryRow[];
  totalFixedAssets: number;
  totalAssets: number;
  currentLiabilities: AccountSummaryRow[];
  totalCurrentLiabilities: number;
  longTermLiabilities: AccountSummaryRow[];
  totalLongTermLiabilities: number;
  totalLiabilities: number;
  equityItems: AccountSummaryRow[];
  retainedEarnings: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface ProfitLossReport {
  fromDate: string;
  toDate: string;
  operatingRevenue: AccountSummaryRow[];
  totalRevenue: number;
  costOfGoodsSold: AccountSummaryRow[];
  totalCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  operatingExpenses: AccountSummaryRow[];
  totalExpenses: number;
  netOperatingIncome: number;
  netMarginPercent: number;
}

export interface FinancialSummaryCards {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  periodRevenue: number;
  netProfit: number;
  journalEntriesCount: number;
  isGlBalanced: boolean;
}

export interface SyncSubledgersResult {
  invoicesProcessed: number;
  billsProcessed: number;
  posSalesProcessed: number;
  totalJournalsCreated: number;
}
