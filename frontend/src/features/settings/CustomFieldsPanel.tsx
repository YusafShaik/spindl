import { useEffect, useState, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';

export type CustomFieldResource = 'customers' | 'items' | 'suppliers' | 'purchase_orders' | 'quotes' | 'sales_orders' | 'invoices' | 'work_orders';
type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'REFERENCE';

interface CustomFieldValidation {
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
}

interface CustomFieldDefinition {
  id: string;
  fieldKey: string;
  displayName: string;
  fieldType: CustomFieldType;
  required: boolean;
  options: string[];
  validation: CustomFieldValidation;
  defaultValue: unknown;
  published: boolean;
}

interface CustomFieldImportPreview {
  totalRows: number;
  validRows: number;
  customFieldCount: number;
  errors: Array<{ row: number; message: string }>;
  sampleRows: Array<Record<string,string>>;
}

interface ApiErrorBody { detail?: string; message?: string; }

interface CustomFieldImportCommit {
  imported: boolean;
  rowsImported: number;
  errors: Array<{ row: number; message: string }>;
}

interface CustomFieldsPanelProps { role?: string; notify: (message: string) => void; }

function isCustomFieldResource(value: string): value is CustomFieldResource {
  return ['customers','items','suppliers','purchase_orders','quotes','sales_orders','invoices','work_orders'].includes(value);
}
function isCustomFieldType(value: string): value is CustomFieldType {
  return value === 'TEXT' || value === 'NUMBER' || value === 'DATE' || value === 'BOOLEAN' || value === 'SELECT' || value === 'REFERENCE';
}

export function CustomFieldsPanel({role,notify }: CustomFieldsPanelProps) {
  const [resource,setResource]=useState<CustomFieldResource>('customers');
  const [fields,setFields]=useState<CustomFieldDefinition[]>([]);
  const [saving,setSaving]=useState(false);
  const [fieldType,setFieldType]=useState<CustomFieldType>('TEXT');
  const [csvFile,setCsvFile]=useState<File|null>(null);const [csvPreview,setCsvPreview]=useState<CustomFieldImportPreview|null>(null);const [csvBusy,setCsvBusy]=useState(false);const [csvKey,setCsvKey]=useState('');
  const canEdit=role !== undefined && ['OWNER','ADMIN'].includes(role);
  const refresh=(): Promise<void> =>apiFetch(`${API}/custom-fields?resource=${resource}`).then(response=>response.ok?response.json():Promise.reject(new Error('Could not load custom fields'))).then((rows: CustomFieldDefinition[])=>setFields(rows)).catch((error: unknown)=>notify(error instanceof Error ? error.message : String(error)));
  useEffect(()=>{refresh();},[resource]);
  const create=async (event: FormEvent<HTMLFormElement>): Promise<void> =>{
    event.preventDefault();setSaving(true);const form=new FormData(event.currentTarget);
    const options=fieldType==='SELECT'?String(form.get('options')||'').split(/[,\n]/).map(value=>value.trim()).filter(Boolean):[];
    const validation: CustomFieldValidation={};
    if(fieldType==='TEXT'){if(form.get('minLength'))validation.minLength=Number(form.get('minLength'));if(form.get('maxLength'))validation.maxLength=Number(form.get('maxLength'));}
    if(fieldType==='NUMBER'){if(form.get('min'))validation.min=Number(form.get('min'));if(form.get('max'))validation.max=Number(form.get('max'));}
    const rawDefaultValue=form.get('defaultValue');let defaultValue: string|number|boolean|null=typeof rawDefaultValue==='string'&&rawDefaultValue?rawDefaultValue:null;
    if(defaultValue!==null&&fieldType==='NUMBER')defaultValue=Number(defaultValue);
    if(defaultValue!==null&&fieldType==='BOOLEAN')defaultValue=defaultValue==='true';
    try{
      const response=await apiFetch(`${API}/custom-fields`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resourceCode:resource,fieldKey:form.get('fieldKey'),displayName:form.get('displayName'),fieldType,required:form.get('required')==='on',options,validation,defaultValue})});
      const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not create custom field');
      await refresh();notify('Custom field created as a draft. Publish it to use it on records.');
    }catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setSaving(false);}
  };
  const publish=async(id: string): Promise<void> =>{setSaving(true);try{const response=await apiFetch(`${API}/custom-fields/${id}/publish`,{method:'POST'});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not publish custom field');await refresh();notify(`${body.displayName} is now available on ${resource.replaceAll('_',' ')} records`);}catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setSaving(false);}};
  const previewCsv=async(): Promise<void> =>{if(!csvFile)return;setCsvBusy(true);try{const form=new FormData();form.append('file',csvFile);const response=await apiFetch(`${API}/custom-fields/${resource}/import/preview`,{method:'POST',body:form});const body: CustomFieldImportPreview & ApiErrorBody=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not validate custom-field CSV');setCsvPreview(body);}catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setCsvBusy(false);}};
  const commitCsv=async(): Promise<void> =>{if(!csvFile||!csvPreview||csvPreview.errors.length)return;setCsvBusy(true);try{const form=new FormData();form.append('file',csvFile);const response=await apiFetch(`${API}/custom-fields/${resource}/import/commit`,{method:'POST',headers:{'Idempotency-Key':csvKey},body:form});const body: CustomFieldImportCommit & ApiErrorBody=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not import custom-field values');if(!body.imported){setCsvPreview(current=>current?({...current,errors:body.errors||[]}):current);notify('Resolve the row errors before importing');return;}setCsvPreview(null);setCsvFile(null);setCsvKey('');notify(`${body.rowsImported} ${resource.replaceAll('_',' ')} record(s) updated`);}catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setCsvBusy(false);}};
  const downloadCsvErrors=(): void =>{if(!csvPreview?.errors?.length)return;const cell=(value: string|number)=>{let text=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;return `"${text.replaceAll('"','""')}"`;};const csv=['row,error',...csvPreview.errors.map(error=>`${cell(error.row)},${cell(error.message)}`)].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`spindl-${resource}-custom-field-import-errors.csv`;link.click();URL.revokeObjectURL(url);};
  return <section className="panel tenant-settings-panel"><div className="panel-header"><div><h2>Custom fields</h2><p>Add typed fields to supported records. Published fields are validated server-side and stored separately from protected system fields.</p></div></div>
    <label>Record type<select value={resource} onChange={event=>{if(isCustomFieldResource(event.target.value))setResource(event.target.value);setCsvPreview(null);setCsvKey('');}}>{[['customers','Customers'],['items','Items'],['suppliers','Suppliers'],['purchase_orders','Purchase orders'],['quotes','Quotations'],['sales_orders','Sales orders'],['invoices','Invoices'],['work_orders','Work orders']].map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
    {canEdit&&<form className="tenant-settings-form" onSubmit={create}><label>Field key<input name="fieldKey" required maxLength={40} pattern="[a-z][a-z0-9_]*" placeholder="customer_segment"/></label><label>Display name<input name="displayName" required maxLength={100} placeholder="Customer segment"/></label><label>Field type<select value={fieldType} onChange={event=>{if(isCustomFieldType(event.target.value))setFieldType(event.target.value);}}>{['TEXT','NUMBER','DATE','BOOLEAN','SELECT','REFERENCE'].map(type=><option key={type} value={type}>{type.toLowerCase()}</option>)}</select></label>{fieldType==='SELECT'&&<label>Options<input name="options" required placeholder="Retail, Wholesale, Partner"/></label>}{fieldType==='TEXT'&&<><label>Minimum length<input name="minLength" type="number" min="0"/></label><label>Maximum length<input name="maxLength" type="number" min="1" max="10000"/></label></>}{fieldType==='NUMBER'&&<><label>Minimum value<input name="min" type="number" step="any"/></label><label>Maximum value<input name="max" type="number" step="any"/></label></>}<label>Default value<input name="defaultValue" type={fieldType==='DATE'?'date':fieldType==='NUMBER'?'number':'text'} step={fieldType==='NUMBER'?'any':undefined}/></label><label className="checkbox-label"><input name="required" type="checkbox"/>Required on records</label><button className="button button-primary" disabled={saving}>{saving?'Saving…':'Add draft field'}</button></form>}
    <div className="table-scroll"><table><thead><tr><th>FIELD</th><th>KEY</th><th>TYPE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{fields.length?fields.map(field=><tr key={field.id}><td><b>{field.displayName}</b>{field.required&&<small className="production-subline">Required</small>}</td><td><code>{field.fieldKey}</code></td><td>{field.fieldType.toLowerCase()}</td><td><Status label={field.published?'Published':'Draft'}/></td><td>{!field.published&&canEdit&&<button className="mini-action" disabled={saving} onClick={()=>publish(field.id)}>Publish</button>}</td></tr>):<tr><td className="empty-cell" colSpan={5}>No custom fields for this record type yet.</td></tr>}</tbody></table></div>
    <div className="import-form"><h3>Import values for existing records</h3><p className="form-note">CSV needs an <code>id</code> column and one or more published field keys. Record IDs are checked against this workspace. Unlisted fields keep their current values. Limit: 500 rows and 2 MB.</p><label>CSV file<input type="file" accept=".csv,text/csv" onChange={event=>{const next=event.target.files?.[0]||null;setCsvFile(next);setCsvPreview(null);setCsvKey(next?crypto.randomUUID():'');}}/></label><div className="import-actions"><button className="button button-secondary" disabled={!csvFile||csvBusy} onClick={previewCsv}>{csvBusy?'Checking…':'Preview values'}</button><button className="button button-primary" disabled={!csvPreview||csvPreview.errors.length>0||csvBusy} onClick={commitCsv}>{csvBusy?'Importing…':'Import values'}</button></div>{csvPreview&&<><p className="form-note">{csvPreview.validRows}/{csvPreview.totalRows} rows valid · {csvPreview.customFieldCount} custom field(s)</p>{csvPreview.errors.length>0&&<div className="panel-header"><span className="form-note">Fix all row errors before importing.</span><button className="button button-secondary" onClick={downloadCsvErrors}><Download size={14}/>Download error CSV</button></div>}{csvPreview.errors.length>0&&<div className="import-errors">{csvPreview.errors.map((error,index)=><div key={`${error.row}-${index}`}><b>Row {error.row}</b><span>{error.message}</span></div>)}</div>}{csvPreview.sampleRows?.length>0&&<div className="table-scroll"><table><thead><tr>{Object.keys(csvPreview.sampleRows[0]).map(header=><th key={header}>{header.toUpperCase()}</th>)}</tr></thead><tbody>{csvPreview.sampleRows.map((row,index)=><tr key={index}>{Object.keys(csvPreview.sampleRows[0]).map(header=><td key={header}>{row[header]}</td>)}</tr>)}</tbody></table></div>}</>}</div>
    {!canEdit&&<p className="form-note">Only workspace owners and admins can manage custom fields.</p>}
  </section>;
}
