import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import type { CsvImportPreview, ExportResource, ImportResource, PublishedCustomField } from '../../types/imports';

function isImportResource(value: string): value is ImportResource {
  return value === 'CUSTOMERS' || value === 'SUPPLIERS' || value === 'ITEMS';
}

function isExportResource(value: string): value is ExportResource {
  return ['CUSTOMERS', 'ITEMS', 'SUPPLIERS', 'PURCHASE_ORDERS', 'QUOTES', 'SALES_ORDERS', 'INVOICES', 'WORK_ORDERS'].includes(value);
}

interface ImportDataProps {
  resource: ImportResource;
  setResource: (resource: ImportResource) => void;
  file: File | null;
  onFile: (file: File | null) => void;
  preview: CsvImportPreview | null;
  saving: boolean;
  onPreview: () => void;
  onImport: () => void;
  onExport: (resource: ExportResource) => void;
}

export function ImportData({resource,setResource,file,onFile,preview,saving,onPreview,onImport,onExport }: ImportDataProps) {
  const [exportResource,setExportResource]=useState<ExportResource>('WORK_ORDERS');
  const headers=resource==='CUSTOMERS'?'code,name,email,status':resource==='SUPPLIERS'?'code,name,email':'sku,name,barcode,category,openingStock,unit,unitPrice,lowStockThreshold';
  const [customFields,setCustomFields]=useState<PublishedCustomField[]>([]);
  useEffect(()=>{let current=true;const customResource=resource==='CUSTOMERS'?'customers':resource==='SUPPLIERS'?'suppliers':'items';apiFetch(`${API}/custom-fields?resource=${customResource}`).then(response=>response.ok?response.json():[]).then((fields: PublishedCustomField[])=>{if(current)setCustomFields(fields.filter(field=>field.published));}).catch(()=>{if(current)setCustomFields([]);});return()=>{current=false;};},[resource]);
  const downloadErrors=()=>{if(!preview?.errors?.length)return;const cell=(value: string|number)=>{let text=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;return `"${text.replaceAll('"','""')}"`;};const csv=['row,error',...preview.errors.map(error=>`${cell(error.row)},${cell(error.message)}`)].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`spindl-${resource.toLowerCase()}-import-errors.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);};
  return <div className="import-layout"><section className="panel directory-panel import-panel"><div className="panel-header directory-top"><div><h2>Import data</h2><p>Preview and validate a CSV before committing all rows in one transaction.</p></div></div><div className="import-form"><label>Import type<select value={resource} onChange={event=>{if(isImportResource(event.target.value))setResource(event.target.value);}}><option value="CUSTOMERS">Customers</option><option value="SUPPLIERS">Suppliers</option><option value="ITEMS">Catalog items</option></select></label><label>CSV file<input type="file" accept=".csv,text/csv" onChange={event=>onFile(event.target.files?.[0]||null)}/></label><p className="form-note">Required header: <code>{headers}</code>. UTF-8 CSV, up to 500 rows and 2 MB. Quoted fields and commas are supported. Published custom fields can be included as extra columns using their field keys.</p>{customFields.length>0&&<div className="import-custom-fields"><b>Published custom fields</b>{customFields.map(field=><span key={field.id}><code>{field.fieldKey}</code> · {field.displayName} ({field.fieldType.toLowerCase()}{field.required?', required':''})</span>)}</div>}<div className="import-actions"><button className="button button-secondary" disabled={!file||saving} onClick={onPreview}>{saving?'Checking…':'Preview file'}</button><button className="button button-primary" disabled={!preview||preview.errors.length>0||saving} onClick={onImport}>{saving?'Importing…':'Import valid rows'}</button></div></div><div className="import-form import-export-form"><h3>Export records</h3><p className="form-note">Exports include published custom fields and are limited to 10,000 records.</p><label>Record type<select value={exportResource} onChange={event=>{if(isExportResource(event.target.value))setExportResource(event.target.value);}}><option value="CUSTOMERS">Customers</option><option value="ITEMS">Catalog items</option><option value="SUPPLIERS">Suppliers</option><option value="PURCHASE_ORDERS">Purchase orders</option><option value="QUOTES">Quotations</option><option value="SALES_ORDERS">Sales orders</option><option value="INVOICES">Invoices</option><option value="WORK_ORDERS">Work orders</option></select></label><button className="button button-secondary" disabled={saving} onClick={()=>onExport(exportResource)}><Download size={14}/>{saving?'Preparing…':'Download CSV'}</button></div></section>{preview&&<section className="panel directory-panel"><div className="panel-header directory-top"><div><h2>Preview <span className="record-count">{preview.validRows}/{preview.totalRows} valid</span></h2><p>{preview.errors.length?`${preview.errors.length} issue(s) must be fixed before importing.`:'No validation errors. Import will commit atomically.'}</p></div>{preview.errors.length>0&&<button className="button button-secondary" onClick={downloadErrors}><Download size={14}/>Download error CSV</button>}</div>{preview.errors.length>0&&<div className="import-errors">{preview.errors.map((error,index)=><div key={`${error.row}-${index}`}><b>Row {error.row}</b><span>{error.message}</span></div>)}</div>}<div className="table-scroll"><table><thead><tr>{Object.keys(preview.sampleRows[0]||{}).map(header=><th key={header}>{header.replaceAll('_',' ').toUpperCase()}</th>)}</tr></thead><tbody>{preview.sampleRows.length?preview.sampleRows.map((row,index)=><tr key={index}>{Object.keys(preview.sampleRows[0]||{}).map(header=><td key={header}>{row[header]}</td>)}</tr>):<tr><td className="empty-cell">No preview rows available.</td></tr>}</tbody></table></div></section>}</div>;
}
