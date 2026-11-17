import { useEffect, useState, type FormEvent } from 'react';
import { Download, FileText, Receipt, Save, SlidersHorizontal } from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';

interface InvoiceSettings {
  taxCode: string;
  taxRate: number | string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
}

interface TaxSummaryRow {
  period: string;
  taxCode: string;
  taxRate: number | string;
  subtotal: number | string;
  taxAmount: number | string;
  grossTotal: number | string;
}

interface InvoiceSettingsPanelProps {
  role?: string;
  notify: (message: string) => void;
}

export function InvoiceSettingsPanel({ role, notify }: InvoiceSettingsPanelProps) {
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [summary, setSummary] = useState<TaxSummaryRow[]>([]);
  const [saving, setSaving] = useState(false);
  const canEdit = role !== undefined && ['OWNER', 'ADMIN'].includes(role);

  useEffect(() => {
    let current = true;
    apiFetch(`${API}/invoices/settings`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Could not load invoice settings'))))
      .then((value: InvoiceSettings) => {
        if (current) setSettings(value);
      })
      .catch((error: unknown) => notify(error instanceof Error ? error.message : String(error)));
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    apiFetch(`${API}/invoices/tax-summary?${params}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Could not load tax summary'))))
      .then((rows: TaxSummaryRow[]) => {
        if (current) setSummary(rows);
      })
      .catch((error: unknown) => notify(error instanceof Error ? error.message : String(error)));
    return () => {
      current = false;
    };
  }, [from, to]);

  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/invoices/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxCode: form.get('taxCode'),
          taxRate: Number(form.get('taxRate')),
          invoicePrefix: form.get('invoicePrefix')
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.message || 'Could not save invoice settings');
      setSettings(body);
      notify('Tax and invoice numbering settings saved');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const response = await apiFetch(`${API}/invoices/tax-summary/export?${params}`);
      if (!response.ok) throw new Error('Could not export tax summary');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'spindl-tax-summary.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Invoice Numbering & Statutory Tax Configuration */}
      <div className="sales-table-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--sp-border)', paddingBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal size={15} style={{ color: '#6366f1' }} />
              <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                Invoice & Statutory Tax Configuration
              </h3>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
              Invoices snapshot these statutory parameters when issued. Numbering increments from a locked tenant sequence.
            </p>
          </div>

          {settings && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--sp-surface-subtle)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>NEXT INVOICE #</span>
              <span className="sales-ref-badge" style={{ color: '#6366f1', fontWeight: 700 }}>
                {settings.invoicePrefix}-{new Date().getFullYear()}-{String(settings.nextInvoiceNumber).padStart(6, '0')}
              </span>
            </div>
          )}
        </div>

        {settings && (
          <form onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: '14px', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text-muted)' }}>
              TAX CLASSIFICATION CODE
              <input
                name="taxCode"
                maxLength={24}
                pattern="[A-Za-z][A-Za-z0-9_-]{0,23}"
                defaultValue={settings.taxCode}
                disabled={!canEdit}
                required
                placeholder="e.g. GST18"
                style={{
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid var(--sp-border)',
                  padding: '0 8px',
                  background: 'var(--sp-surface)',
                  color: 'var(--sp-text)',
                  fontSize: '12.5px',
                  fontWeight: 500
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text-muted)' }}>
              TAX RATE (%)
              <input
                name="taxRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={settings.taxRate}
                disabled={!canEdit}
                required
                style={{
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid var(--sp-border)',
                  padding: '0 8px',
                  background: 'var(--sp-surface)',
                  color: 'var(--sp-text)',
                  fontSize: '12.5px',
                  fontWeight: 500
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text-muted)' }}>
              INVOICE PREFIX
              <input
                name="invoicePrefix"
                maxLength={8}
                pattern="[A-Za-z0-9]{2,8}"
                defaultValue={settings.invoicePrefix}
                disabled={!canEdit}
                required
                placeholder="e.g. INV"
                style={{
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid var(--sp-border)',
                  padding: '0 8px',
                  background: 'var(--sp-surface)',
                  color: 'var(--sp-text)',
                  fontSize: '12.5px',
                  fontWeight: 500
                }}
              />
            </label>

            {canEdit ? (
              <button
                type="submit"
                className="sales-action-btn primary"
                disabled={saving}
                style={{ height: '32px', padding: '0 14px', fontSize: '12px' }}
              >
                <Save size={13} />
                <span>{saving ? 'Saving…' : 'Save setup'}</span>
              </button>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', paddingBottom: '8px' }}>
                Admin access required to modify tax rules
              </span>
            )}
          </form>
        )}
      </div>

      {/* 2. Tax Liability & Inbound Period Summary */}
      <div className="sales-table-card">
        <div className="sales-toolbar" style={{ borderBottom: '1px solid var(--sp-border)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Receipt size={14} style={{ color: '#10b981' }} />
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--sp-text)' }}>
                Tax Accruals & Period Summary
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
              Issued sales invoices aggregated by billing period and statutory tax classification.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
              From:
              <input
                type="date"
                className="tx-date-input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
              To:
              <input
                type="date"
                className="tx-date-input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>

            <button
              type="button"
              className="sales-action-btn"
              onClick={download}
              style={{ height: '30px' }}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="sales-table-scroll">
          <table className="sales-table">
            <thead>
              <tr>
                <th style={{ width: '140px' }}>PERIOD</th>
                <th style={{ width: '160px' }}>TAX CODE</th>
                <th style={{ width: '110px' }}>STATUTORY RATE</th>
                <th style={{ textAlign: 'right' }}>TAXABLE SUBTOTAL</th>
                <th style={{ textAlign: 'right' }}>TAX AMOUNT</th>
                <th style={{ textAlign: 'right', width: '160px' }}>GROSS TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {summary.length ? (
                summary.map((row, index) => (
                  <tr key={`${row.period}-${row.taxCode}-${row.taxRate}-${index}`} className="sales-row">
                    <td>
                      <span className="sales-ref-badge">{row.period}</span>
                    </td>
                    <td>
                      <span className="tx-type-badge SALES_INVOICE">{row.taxCode}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                        {row.taxRate}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {formatCurrency(row.subtotal)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#d97706' }}>
                        {formatCurrency(row.taxAmount)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--sp-text)' }}>
                        {formatCurrency(row.grossTotal)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="sales-empty-cell">
                    <div className="sales-empty-state">
                      <div className="sales-empty-title">No tax data for selected period</div>
                      <div className="sales-empty-desc">No invoices were issued during this calendar window.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
