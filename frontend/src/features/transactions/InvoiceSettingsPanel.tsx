import { useEffect, useState, type FormEvent } from 'react';
import { Download } from 'lucide-react';
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

export function InvoiceSettingsPanel({role,notify }: InvoiceSettingsPanelProps) {
  const [settings,setSettings]=useState<InvoiceSettings|null>(null);const [from,setFrom]=useState('');const [to,setTo]=useState('');const [summary,setSummary]=useState<TaxSummaryRow[]>([]);const [saving,setSaving]=useState(false);const canEdit=role !== undefined && ['OWNER','ADMIN'].includes(role);
  useEffect(()=>{let current=true;apiFetch(`${API}/invoices/settings`).then(response=>response.ok?response.json():Promise.reject(new Error('Could not load invoice settings'))).then((value: InvoiceSettings)=>{if(current)setSettings(value);}).catch((error: unknown)=>notify(error instanceof Error ? error.message : String(error)));return()=>{current=false;};},[]);
  useEffect(()=>{let current=true;const params=new URLSearchParams();if(from)params.set('from',from);if(to)params.set('to',to);apiFetch(`${API}/invoices/tax-summary?${params}`).then(response=>response.ok?response.json():Promise.reject(new Error('Could not load tax summary'))).then((rows: TaxSummaryRow[])=>{if(current)setSummary(rows);}).catch((error: unknown)=>notify(error instanceof Error ? error.message : String(error)));return()=>{current=false;};},[from,to]);
  const save=async (event: FormEvent<HTMLFormElement>): Promise<void> =>{event.preventDefault();const form=new FormData(event.currentTarget);setSaving(true);try{const response=await apiFetch(`${API}/invoices/settings`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({taxCode:form.get('taxCode'),taxRate:Number(form.get('taxRate')),invoicePrefix:form.get('invoicePrefix')})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not save invoice settings');setSettings(body);notify('Tax and invoice numbering settings saved');}catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setSaving(false);}};
  const download=async()=>{try{const params=new URLSearchParams();if(from)params.set('from',from);if(to)params.set('to',to);const response=await apiFetch(`${API}/invoices/tax-summary/export?${params}`);if(!response.ok)throw new Error('Could not export tax summary');const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download='spindl-tax-summary.csv';link.click();URL.revokeObjectURL(url);}catch(error){notify(error instanceof Error ? error.message : String(error));}};
  return <section className="panel finance-settings-panel"><div className="panel-header directory-top"><div><h2>Invoice & tax setup</h2><p>Invoices snapshot this rate when issued. Numbering uses a locked tenant sequence.</p></div></div>{settings&&<><form className="finance-settings-form" onSubmit={save}><label>Tax code<input name="taxCode" maxLength={24} pattern="[A-Za-z][A-Za-z0-9_-]{0,23}" defaultValue={settings.taxCode} disabled={!canEdit} required/></label><label>Tax rate (%)<input name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.taxRate} disabled={!canEdit} required/></label><label>Invoice prefix<input name="invoicePrefix" maxLength={8} pattern="[A-Za-z0-9]{2,8}" defaultValue={settings.invoicePrefix} disabled={!canEdit} required/></label><div className="finance-settings-sequence"><small>NEXT INVOICE</small><b>{settings.invoicePrefix}-{new Date().getFullYear()}-{String(settings.nextInvoiceNumber).padStart(6,'0')}</b></div>{canEdit&&<button className="button button-primary" disabled={saving}>{saving?'Saving…':'Save setup'}</button>}</form><div className="tax-summary-tools"><div><b>Tax summary</b><small>Issued invoices grouped by month and tax code.</small></div><label>From<input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>To<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><button className="button button-secondary" onClick={download}><Download size={14}/>Export CSV</button></div><div className="table-scroll"><table><thead><tr><th>PERIOD</th><th>TAX CODE</th><th>RATE</th><th>SUBTOTAL</th><th>TAX</th><th>GROSS</th></tr></thead><tbody>{summary.length?summary.map((row,index)=><tr key={`${row.period}-${row.taxCode}-${row.taxRate}-${index}`}><td>{row.period}</td><td>{row.taxCode}</td><td>{row.taxRate}%</td><td>{formatCurrency(row.subtotal)}</td><td>{formatCurrency(row.taxAmount)}</td><td>{formatCurrency(row.grossTotal)}</td></tr>):<tr><td colSpan={6} className="empty-cell">No invoices in this period.</td></tr>}</tbody></table></div></>}</section>;
}
