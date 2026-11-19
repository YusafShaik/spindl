type CurrencyInput = number | string | null | undefined;

/** INR formatting shared by dashboard, sales, purchasing, and POS views. */
export function formatCurrency(value: CurrencyInput): string {
  const num = Number(value || 0);
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact dashboard format, retaining the existing lakh conversion. */
export function formatCompactRupees(value: CurrencyInput): string {
  return `₹ ${(Number(value || 0) / 100000).toFixed(2)}L`;
}

export function formatBytes(bytes: number | string | null | undefined): string {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
