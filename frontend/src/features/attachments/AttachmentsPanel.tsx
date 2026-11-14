import { useState, type FormEvent } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import { formatBytes } from '../../lib/utils/currency';

export type AttachmentResource = 'customers' | 'items' | 'suppliers' | 'purchase_orders' | 'quotes' | 'sales_orders' | 'invoices' | 'work_orders' | 'leads';

interface AttachmentRecord {
  id: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  scanStatus: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface AttachmentsPanelProps { notify: (message: string) => void; }

function isAttachmentResource(value: string): value is AttachmentResource {
  return ['customers','items','suppliers','purchase_orders','quotes','sales_orders','invoices','work_orders','leads'].includes(value);
}

export function AttachmentsPanel({notify }: AttachmentsPanelProps) {
  const [resource,setResource]=useState<AttachmentResource>('customers');const [recordId,setRecordId]=useState('');const [files,setFiles]=useState<AttachmentRecord[]>([]);const [busy,setBusy]=useState(false);
  const resourceOptions: Array<[AttachmentResource,string]>=[['customers','Customer'],['items','Item'],['suppliers','Supplier'],['purchase_orders','Purchase order'],['quotes','Quote'],['sales_orders','Sales order'],['invoices','Invoice'],['work_orders','Work order'],['leads','Lead']];
  const endpoint=`${API}/attachments/${resource}/${recordId.trim()}`;
  const load=async(): Promise<void> =>{if(!recordId.trim())return;const response=await apiFetch(endpoint);const body=await response.json().catch(()=>[]);if(!response.ok)throw new Error(body.detail||body.message||'Could not load files');setFiles(body);};
  const upload=async (event: FormEvent<HTMLFormElement>): Promise<void> =>{event.preventDefault();const formElement=event.currentTarget;const file=formElement.querySelector<HTMLInputElement>('input[name="file"]')?.files?.[0];if(!file||!recordId.trim())return;setBusy(true);try{const form=new FormData();form.append('file',file);const response=await apiFetch(endpoint,{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:form});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not upload file');formElement.reset();await load();notify('File uploaded and passed the security scan');}catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setBusy(false);}};
  const download=async(file: AttachmentRecord): Promise<void> =>{try{const response=await apiFetch(`${endpoint}/${file.id}/download`);if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.detail||body.message||'Could not download file');}const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=file.filename;anchor.click();URL.revokeObjectURL(url);}catch(error){notify(error instanceof Error ? error.message : String(error));}};
  const remove=async(file: AttachmentRecord): Promise<void> =>{if(!window.confirm(`Delete “${file.filename}”?`))return;setBusy(true);try{const response=await apiFetch(`${endpoint}/${file.id}`,{method:'DELETE'});if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.detail||body.message||'Could not delete file');}await load();notify('File deleted');}catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setBusy(false);}};
  return <section className="panel tenant-settings-panel"><div className="panel-header"><div><h2>Record files</h2><p>Upload scanned PDFs, images, and text files to a workspace record. Files are private to this workspace and count toward its storage limit.</p></div></div><div className="tenant-settings-form"><label>Record type<select value={resource} onChange={event=>{if(isAttachmentResource(event.target.value))setResource(event.target.value);setFiles([]);}}>{resourceOptions.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label><label>Record ID<input value={recordId} onChange={event=>{setRecordId(event.target.value);setFiles([]);}} placeholder="Paste record UUID"/></label><button className="button button-secondary" disabled={!recordId.trim()||busy} onClick={()=>load().catch((error: unknown)=>notify(error instanceof Error ? error.message : String(error)))}>Load files</button></div><form className="team-invite-form" onSubmit={upload}><label>Choose file<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" required/></label><button className="button button-primary" disabled={!recordId.trim()||busy}>{busy?'Working…':'Upload file'}</button></form><div className="team-invite-list">{files.map(file=><div className="team-invite-link" key={file.id}><div><b>{file.filename}</b><small>{formatBytes(file.sizeBytes)} · {file.mediaType} · security scan passed · {new Date(file.uploadedAt).toLocaleString()}</small></div><button className="mini-action" onClick={()=>download(file)}>Download</button><button className="mini-action muted" disabled={busy} onClick={()=>remove(file)}>Delete</button></div>)}{recordId&&files.length===0&&<p className="empty-cell">No files loaded for this record.</p>}</div></section>;
}
