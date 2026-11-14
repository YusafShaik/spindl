import { useEffect, useState, type FormEvent } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import type { ItemSummary } from '../../types/inventory';

export type RecordKind = 'Customer' | 'Supplier' | 'Purchase order' | 'Quotation' | 'Product';
export type CustomFieldResource = 'customers' | 'suppliers' | 'purchase_orders' | 'quotes' | 'items';

export interface CustomFieldDefinition {
  id: string;
  fieldKey: string;
  displayName: string;
  fieldType: string;
  required: boolean;
  options: string[];
  validation: {
    maxLength?: number;
    minLength?: number;
    min?: number;
    max?: number;
  };
  defaultValue: unknown;
  published: boolean;
}

interface SelectableParty {
  id: string;
  code: string;
  name: string;
  email?: string | null;
}

interface CustomerDuplicate {
  code: string;
  name: string;
  email?: string | null;
}

interface RecordModalProps {
  kind: RecordKind;
  suppliers: SelectableParty[];
  customers: SelectableParty[];
  items: ItemSummary[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, fields: CustomFieldDefinition[], resource: CustomFieldResource) => void;
}

export function RecordModal({ kind, suppliers, customers, items, saving, onClose, onSubmit }: RecordModalProps) {
  const isCustomer = kind === 'Customer'; const isSupplier = kind === 'Supplier'; const isOrder = kind === 'Purchase order'; const isQuote = kind === 'Quotation';
  const customResource=isCustomer?'customers':isSupplier?'suppliers':isOrder?'purchase_orders':isQuote?'quotes':'items';
  const [customDefinitions,setCustomDefinitions]=useState<CustomFieldDefinition[]>([]);
  const [loadingCustomFields,setLoadingCustomFields]=useState(true);
  const [possibleDuplicates,setPossibleDuplicates]=useState<CustomerDuplicate[]>([]);
  useEffect(()=>{let current=true;setLoadingCustomFields(true);apiFetch(`${API}/custom-fields?resource=${customResource}`).then(response=>response.ok?response.json():[]).then((fields: CustomFieldDefinition[])=>{if(current)setCustomDefinitions(fields.filter(field=>field.published));}).catch(()=>{if(current)setCustomDefinitions([]);}).finally(()=>{if(current)setLoadingCustomFields(false);});return()=>{current=false;};},[customResource]);
  const codeLabel = isCustomer ? 'Customer code' : isSupplier ? 'Supplier code' : 'SKU';
  const codeExample = isCustomer ? 'CUS-005' : isSupplier ? 'SUP-003' : 'PRD-1005';
  return <div className="modal-backdrop" onMouseDown={event => { if(event.target === event.currentTarget && !saving) onClose(); }}><form className="record-modal" onSubmit={(event: FormEvent<HTMLFormElement>)=>onSubmit(event,customDefinitions,customResource)}>
    <div className="modal-title"><div><h2>New {kind.toLowerCase()}</h2><p>This record will be saved to the current development tenant.</p></div><button type="button" disabled={saving} onClick={onClose}>×</button></div>
    {isOrder ? <>{suppliers.length ? <label>Supplier<select name="supplierId" required defaultValue=""><option value="" disabled>Select supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</select></label> : <p className="form-note">Add a supplier before creating a purchase order.</p>}{items.length ? <label>Item<select name="itemId" required defaultValue=""><option value="" disabled>Select catalog item</option>{items.map(i => <option key={i.id} value={i.id}>{i.sku} · {i.name}</option>)}</select></label> : <p className="form-note">Add an item before creating a purchase order.</p>}<div className="form-row"><label>Quantity<input name="quantity" type="number" min="1" defaultValue="1" required/></label><label>Unit cost (₹)<input name="price" type="number" min="0" step="0.01" defaultValue={items[0]?.unitPrice ?? 0} required/></label></div><label>Notes <input name="notes" maxLength={1000} placeholder="Optional delivery or purchasing notes"/></label></>
    : isQuote ? <>{customers.length ? <label>Customer<select name="customerId" required defaultValue=""><option value="" disabled>Select customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}</select></label> : <p className="form-note">Add a customer before creating a quotation.</p>}{items.length ? <label>Item<select name="itemId" required defaultValue=""><option value="" disabled>Select catalog item</option>{items.map(i => <option key={i.id} value={i.id}>{i.sku} · {i.name}</option>)}</select></label> : <p className="form-note">Add an item before creating a quotation.</p>}<div className="form-row"><label>Quantity<input name="quantity" type="number" min="1" defaultValue="1" required/></label><label>Unit price (₹)<input name="price" type="number" min="0" step="0.01" defaultValue={items[0]?.unitPrice ?? 0} required/></label></div><label>Valid until<input name="validUntil" type="date"/></label><label>Notes<input name="notes" maxLength={1000} placeholder="Optional quote terms"/></label></>
    : <><label>{codeLabel}<input name="code" required maxLength={64} placeholder={codeExample}/></label><label>Name<input name="name" required maxLength={180} placeholder={isCustomer ? 'Business name' : isSupplier ? 'Supplier business name' : 'Item name'}/></label>{!isCustomer&&!isSupplier&&<label>Barcode <span className="form-note">Optional · unique within this workspace</span><input name="barcode" maxLength={64} placeholder="Scan or enter barcode" autoComplete="off"/></label>}{isCustomer || isSupplier ? <><label>Email<input name="email" type="email" required placeholder="contact@business.in" onBlur={async event=>{if(!isCustomer||!event.target.value)return;try{const response=await apiFetch(`${API}/customers?email=${encodeURIComponent(event.target.value)}`);if(response.ok){const matches: CustomerDuplicate[]=await response.json();setPossibleDuplicates(matches.filter(customer=>customer.email?.toLowerCase()===event.target.value.toLowerCase()));}}catch{setPossibleDuplicates([]);}}}/></label>{isCustomer&&possibleDuplicates.length>0&&<p className="form-note duplicate-hint">Possible match{possibleDuplicates.length>1?'es':''}: {possibleDuplicates.map(customer=>`${customer.name} (${customer.code})`).join(', ')}. Check this record before adding another.</p>}<div className="form-row"><label>Contact person<input name="contactName" maxLength={180} placeholder="Primary contact"/></label><label>Phone<input name="phone" maxLength={40} placeholder="+91…"/></label></div><div className="form-row"><label>Address line 1<input name="addressLine1" maxLength={180}/></label><label>Address line 2<input name="addressLine2" maxLength={180}/></label></div><div className="form-row"><label>City<input name="city" maxLength={100}/></label><label>State / region<input name="region" maxLength={100}/></label><label>Postal code<input name="postalCode" maxLength={24}/></label><label>Country code<input name="countryCode" maxLength={2} pattern="[A-Za-z]{2}" placeholder="IN"/></label></div><div className="form-row"><label>Tax ID<input name="taxId" maxLength={80}/></label><label>Payment terms (days)<input name="paymentTermsDays" type="number" min="0" max="365" defaultValue="0"/></label>{isCustomer?<label>Customer type<select name="customerType"><option value="COMPANY">Company</option><option value="INDIVIDUAL">Individual</option></select></label>:<label>Lead time (days)<input name="leadTimeDays" type="number" min="0" max="3650" defaultValue="0"/></label>}</div>{isCustomer?<><div className="form-row"><label>Credit limit (₹)<input name="creditLimit" type="number" min="0" step="0.01" defaultValue="0"/></label><label>Tags<input name="tags" maxLength={1000} placeholder="Retail, wholesale"/></label></div><label className="checkbox-label"><input name="creditHold" type="checkbox"/>Place on credit hold</label></>:<><div className="form-row"><label>Supplier rating (0–5)<input name="rating" type="number" min="0" max="5" step="0.1"/></label><label>Notes<input name="notes" maxLength={1000}/></label></div></>}</> : <><div className="form-row"><label>Category<input name="category" required placeholder="Components"/></label><label>Item type<select name="itemType" defaultValue="FINISHED"><option value="RAW">Raw material</option><option value="WIP">Work in progress</option><option value="FINISHED">Finished good</option><option value="SERVICE">Service</option></select></label></div><div className="form-row"><label>Opening stock<input name="stock" type="number" min="0" defaultValue="0" required/></label><label>Unit<input name="unit" required defaultValue="pcs"/></label></div><div className="form-row"><label>Unit price (₹)<input name="price" type="number" min="0" step="0.01" required/></label><label>Low-stock threshold<input name="lowStockThreshold" type="number" min="0" defaultValue="10" required/></label></div></>}</>}
    {customDefinitions.length>0&&<div className="custom-field-form"><h3>Additional details</h3>{customDefinitions.map(field=>{const initial=field.defaultValue===null||field.defaultValue===undefined?'':String(field.defaultValue);return <label key={field.id}>{field.displayName}{field.fieldType==='SELECT'?<select name={`custom_${field.fieldKey}`} defaultValue={initial} required={field.required}><option value="">Choose {field.displayName.toLowerCase()}</option>{field.options.map(option=><option key={option} value={option}>{option}</option>)}</select>:field.fieldType==='BOOLEAN'?<select name={`custom_${field.fieldKey}`} defaultValue={initial} required={field.required}><option value="">Choose</option><option value="true">Yes</option><option value="false">No</option></select>:<input name={`custom_${field.fieldKey}`} type={field.fieldType==='NUMBER'?'number':field.fieldType==='DATE'?'date':'text'} step={field.fieldType==='NUMBER'?'any':undefined} defaultValue={initial} required={field.required} maxLength={field.fieldType==='TEXT'?field.validation.maxLength:undefined} minLength={field.fieldType==='TEXT'?field.validation.minLength:undefined} min={field.fieldType==='NUMBER'?field.validation.min:undefined} max={field.fieldType==='NUMBER'?field.validation.max:undefined} placeholder={field.fieldType==='REFERENCE'?'Record UUID':''}/>}</label>;})}</div>}
    {loadingCustomFields&&<p className="form-note">Loading workspace fields…</p>}<div className="modal-actions"><button className="button button-secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving||loadingCustomFields || ((isOrder || isQuote) && (!items.length || (isOrder ? !suppliers.length : !customers.length)))}>{saving ? 'Saving…' : isOrder ? 'Create draft order' : isQuote ? 'Create draft quotation' : 'Save to database'}</button></div>
  </form></div>;
}
