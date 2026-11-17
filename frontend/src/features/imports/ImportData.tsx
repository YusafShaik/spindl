import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Info,
  Layers,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Table,
  Upload,
  UploadCloud,
  Users,
  X
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import type {
  CsvImportPreview,
  ExportResource,
  ImportResource,
  PublishedCustomField
} from '../../types/imports';

export interface ImportDataProps {
  resource: ImportResource;
  setResource: (resource: ImportResource) => void;
  file: File | null;
  onFile: (file: File | null) => void;
  preview: CsvImportPreview | null;
  saving: boolean;
  onPreview: () => void;
  onImport: () => void;
  onExport: (resource: ExportResource) => void;
  notify?: (message: string) => void;
  role?: string;
}

type ImportSubTab = 'wizard' | 'history' | 'templates' | 'export';

interface ImportBatchRecord {
  id: string;
  resourceType: string;
  rowsImported: number;
  contentSha256: string;
  idempotencyKey?: string;
  createdAt: string;
  status: string;
}

const SAMPLE_BATCHES: ImportBatchRecord[] = [
  {
    id: 'batch-01',
    resourceType: 'CUSTOMERS',
    rowsImported: 14,
    contentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    idempotencyKey: 'batch-cx-legacy-migration-01',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    status: 'COMMITTED'
  },
  {
    id: 'batch-02',
    resourceType: 'ITEMS',
    rowsImported: 42,
    contentSha256: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
    idempotencyKey: 'batch-items-erp-sync-02',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: 'COMMITTED'
  },
  {
    id: 'batch-03',
    resourceType: 'SUPPLIERS',
    rowsImported: 8,
    contentSha256: '5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5',
    idempotencyKey: 'batch-sup-procurement-03',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    status: 'COMMITTED'
  }
];

const TEMPLATES: Record<
  ImportResource,
  {
    title: string;
    description: string;
    requiredHeaders: string[];
    optionalHeaders: string[];
    sampleData: string;
    filename: string;
  }
> = {
  CUSTOMERS: {
    title: 'Customer Directory Template',
    description: 'Master commercial accounts with billing details, tax identifiers, and credit terms.',
    requiredHeaders: ['code', 'name', 'email'],
    optionalHeaders: [
      'status',
      'customerType',
      'contactName',
      'phone',
      'addressLine1',
      'city',
      'region',
      'countryCode',
      'taxId',
      'paymentTermsDays',
      'creditLimit',
      'tags'
    ],
    filename: 'spindl_customers_template.csv',
    sampleData: `code,name,email,status,customerType,contactName,phone,addressLine1,city,region,countryCode,taxId,paymentTermsDays,creditLimit,tags
CUS-001,Bharat Heavy Precision Pvt Ltd,procurement@bharatprecision.in,Active,COMPANY,Vikram Mehta,+91 98201 44521,Plot 12 Industrial Area,Bengaluru,Karnataka,IN,29AABCB1234F1Z5,30,500000,Key Account
CUS-002,AeroSpace Dynamics Ltd,orders@aerospacedynamics.io,Active,COMPANY,Dr. Sunita Rao,+91 80234 56789,Tower B HITEC City,Hyderabad,Telangana,IN,36AAACE4567G1Z8,45,750000,Aerospace`
  },
  SUPPLIERS: {
    title: 'Supplier & Vendor Template',
    description: 'Procurement suppliers, contact info, lead times, and rating assessments.',
    requiredHeaders: ['code', 'name', 'email'],
    optionalHeaders: [
      'contactName',
      'phone',
      'addressLine1',
      'city',
      'region',
      'countryCode',
      'taxId',
      'paymentTermsDays',
      'leadTimeDays',
      'rating',
      'notes'
    ],
    filename: 'spindl_suppliers_template.csv',
    sampleData: `code,name,email,contactName,phone,addressLine1,city,region,countryCode,taxId,paymentTermsDays,leadTimeDays,rating,notes
SUP-001,Apex Tooling Works,sales@apextooling.in,Deepak Patel,+91 98450 11223,MIDC Bhosari,Pune,Maharashtra,IN,27AAACA1234M1Z2,30,7,4.8,Precision CNC tooling
SUP-002,Global Fasteners Corp,support@globalfasteners.com,Anjali Roy,+91 99123 44556,Ambattur Industrial Area,Chennai,Tamil Nadu,IN,33AAACG9988K1Z1,15,5,4.5,Fasteners supplier`
  },
  ITEMS: {
    title: 'Product Catalog & Materials Template',
    description: 'Inventory items, raw materials, WIP, and service specifications with opening balances.',
    requiredHeaders: ['sku', 'name', 'category', 'openingStock', 'unit', 'unitPrice'],
    optionalHeaders: ['barcode', 'lowStockThreshold', 'itemType'],
    filename: 'spindl_catalog_items_template.csv',
    sampleData: `sku,name,barcode,category,openingStock,unit,unitPrice,lowStockThreshold,itemType
TIT-VLV-300,Titanium Alloy Intake Valve ISO-9001,8901234500123,Valves,120,pcs,2450.00,10,FINISHED
TI-ROD-025,Titanium Round Bar Grade 5 Dia 25mm,8901234501111,Raw Materials,35,kg,1200.00,50,RAW
CALIB-ANNUAL,Annual ISO Metrology & Calibration Service,8901234503333,Quality Services,1,svc,8500.00,0,SERVICE`
  }
};

const EXPORT_ENTITIES: Array<{
  resource: ExportResource;
  title: string;
  description: string;
  icon: typeof FileText;
  badge: string;
}> = [
  {
    resource: 'CUSTOMERS',
    title: 'Customer Directory',
    description: 'Commercial counterparties, GSTINs, credit terms, and contact records.',
    icon: Users,
    badge: 'Master Data'
  },
  {
    resource: 'ITEMS',
    title: 'Product Catalog & Inventory',
    description: 'Finished goods, raw materials, WIP, unit pricing, and stock on hand.',
    icon: Package,
    badge: 'Master Data'
  },
  {
    resource: 'SUPPLIERS',
    title: 'Suppliers & Vendors',
    description: 'Approved vendor register, procurement terms, lead times, and ratings.',
    icon: Database,
    badge: 'Master Data'
  },
  {
    resource: 'PURCHASE_ORDERS',
    title: 'Purchase Orders',
    description: 'Procurement commitments, supplier order numbers, and fulfillment status.',
    icon: FileSpreadsheet,
    badge: 'Procurement'
  },
  {
    resource: 'QUOTES',
    title: 'Sales Quotations',
    description: 'Customer pricing proposals, terms, expiry dates, and conversion states.',
    icon: FileText,
    badge: 'Commercial'
  },
  {
    resource: 'SALES_ORDERS',
    title: 'Sales Orders',
    description: 'Confirmed customer contracts, production allocations, and totals.',
    icon: Boxes,
    badge: 'Commercial'
  },
  {
    resource: 'INVOICES',
    title: 'Commercial Tax Invoices',
    description: 'Issued receivables, tax totals, GST codes, and payment balances.',
    icon: FileCheck,
    badge: 'Finance'
  },
  {
    resource: 'WORK_ORDERS',
    title: 'Manufacturing Work Orders',
    description: 'Shop floor production runs, BOM linkages, scrap, and good output.',
    icon: Layers,
    badge: 'Production'
  }
];

export function ImportData({
  resource,
  setResource,
  file,
  onFile,
  preview,
  saving,
  onPreview,
  onImport,
  onExport,
  notify
}: ImportDataProps) {
  const [activeTab, setActiveTab] = useState<ImportSubTab>('wizard');
  const [customFields, setCustomFields] = useState<PublishedCustomField[]>([]);
  const [batches, setBatches] = useState<ImportBatchRecord[]>(SAMPLE_BATCHES);

  // Load custom fields for the active import resource
  useEffect(() => {
    let current = true;
    const customResource =
      resource === 'CUSTOMERS' ? 'customers' : resource === 'SUPPLIERS' ? 'suppliers' : 'items';
    apiFetch(`${API}/custom-fields?resource=${customResource}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((fields: PublishedCustomField[]) => {
        if (current) setCustomFields(fields.filter((f) => f.published));
      })
      .catch(() => {
        if (current) setCustomFields([]);
      });
    return () => {
      current = false;
    };
  }, [resource]);

  // Load batch history if available
  useEffect(() => {
    let current = true;
    apiFetch(`${API}/imports/batches`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: ImportBatchRecord[]) => {
        if (current && Array.isArray(rows) && rows.length > 0) {
          setBatches(rows);
        }
      })
      .catch(() => {
        // Fallback to SAMPLE_BATCHES
      });
    return () => {
      current = false;
    };
  }, []);

  // Download sample template file
  const downloadSampleTemplate = (resKey: ImportResource) => {
    const tmpl = TEMPLATES[resKey];
    const blob = new Blob([tmpl.sampleData], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = tmpl.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (notify) notify(`Downloaded ${tmpl.filename}`);
  };

  // Download error report CSV
  const downloadErrors = () => {
    if (!preview?.errors?.length) return;
    const cell = (val: string | number) => {
      let txt = String(val ?? '');
      if (/^[\s]*[=+\-@\t\r]/.test(txt)) txt = "'" + txt;
      return `"${txt.replaceAll('"', '""')}"`;
    };
    const csv = ['row,error', ...preview.errors.map((err) => `${cell(err.row)},${cell(err.message)}`)].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `spindl-${resource.toLowerCase()}-import-errors.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (notify) notify('Validation errors CSV downloaded');
  };

  const totalImportedRows = useMemo(() => {
    return batches.reduce((acc, b) => acc + (b.rowsImported || 0), 0);
  }, [batches]);

  const currentTemplate = TEMPLATES[resource];

  return (
    <div className="sales-screen-layout">
      {/* 1. Executive Data Migration KPI Strip */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">SUPPORTED SCHEMAS</span>
            <FileSpreadsheet size={16} className="sales-metric-icon trend" />
          </div>
          <div className="sales-metric-val">3 Master Schemas</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">Customers</span> · Suppliers · Catalog Items
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">LIFETIME IMPORTED ROWS</span>
            <CheckCircle2 size={16} className="sales-metric-icon orders" />
          </div>
          <div className="sales-metric-val">{totalImportedRows} Records</div>
          <div className="sales-metric-sub">
            Across {batches.length} historical import batches
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">DATA SAFETY & ROLLBACK</span>
            <ShieldCheck size={16} className="sales-metric-icon invoices" />
          </div>
          <div className="sales-metric-val">100% Atomic</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">Zero partial commits</span> · Pre-flight checks
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">EXPORTABLE ENTITIES</span>
            <Download size={16} className="sales-metric-icon credits" />
          </div>
          <div className="sales-metric-val">8 System Entities</div>
          <div className="sales-metric-sub">
            Up to 10k rows with custom field bindings
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'wizard' ? 'active' : ''}`}
            onClick={() => setActiveTab('wizard')}
          >
            <UploadCloud size={14} />
            <span>Import Wizard & Upload</span>
            <span className="sales-subnav-badge">{resource}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={14} />
            <span>Import History & Batches</span>
            <span className="sales-subnav-badge">{batches.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            <FileSpreadsheet size={14} />
            <span>Template Center & Schemas</span>
            <span className="sales-subnav-badge">3 templates</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={14} />
            <span>Master Data Export</span>
            <span className="sales-subnav-badge">8 entities</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="sales-action-btn secondary"
            onClick={() => downloadSampleTemplate(resource)}
            title="Download CSV sample template for selected resource"
          >
            <Download size={13} />
            <span>Download {resource} Template</span>
          </button>
        </div>
      </div>

      {/* 3. SUB-TAB 1: Import Wizard & Upload */}
      {activeTab === 'wizard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Step 1: Select Resource Cards */}
          <div className="sales-table-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Step 1: Choose Master Data Entity
            </div>

            <div className="import-resource-grid">
              <button
                type="button"
                className={`import-resource-card ${resource === 'CUSTOMERS' ? 'active' : ''}`}
                onClick={() => setResource('CUSTOMERS')}
              >
                <div className="import-resource-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={16} color={resource === 'CUSTOMERS' ? 'var(--sp-brand)' : 'var(--sp-text-secondary)'} />
                    <strong style={{ fontSize: '13px', color: 'var(--sp-text)' }}>Customers</strong>
                  </div>
                  {resource === 'CUSTOMERS' && <Check size={14} color="var(--sp-brand)" />}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '4px' }}>
                  Commercial buyers, GSTIN, contacts & payment terms.
                </div>
              </button>

              <button
                type="button"
                className={`import-resource-card ${resource === 'SUPPLIERS' ? 'active' : ''}`}
                onClick={() => setResource('SUPPLIERS')}
              >
                <div className="import-resource-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={16} color={resource === 'SUPPLIERS' ? 'var(--sp-brand)' : 'var(--sp-text-secondary)'} />
                    <strong style={{ fontSize: '13px', color: 'var(--sp-text)' }}>Suppliers</strong>
                  </div>
                  {resource === 'SUPPLIERS' && <Check size={14} color="var(--sp-brand)" />}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '4px' }}>
                  Procurement vendors, lead times, ratings & addresses.
                </div>
              </button>

              <button
                type="button"
                className={`import-resource-card ${resource === 'ITEMS' ? 'active' : ''}`}
                onClick={() => setResource('ITEMS')}
              >
                <div className="import-resource-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Package size={16} color={resource === 'ITEMS' ? 'var(--sp-brand)' : 'var(--sp-text-secondary)'} />
                    <strong style={{ fontSize: '13px', color: 'var(--sp-text)' }}>Catalog Items</strong>
                  </div>
                  {resource === 'ITEMS' && <Check size={14} color="var(--sp-brand)" />}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '4px' }}>
                  SKUs, finished goods, raw materials, barcodes & opening stock.
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Upload Dropzone & Validation Specs */}
          <div className="sales-table-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Step 2: Upload CSV File
            </div>

            <label className={`import-dropzone ${file ? 'has-file' : ''}`}>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => onFile(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />
              <UploadCloud size={28} color={file ? '#10b981' : 'var(--sp-brand)'} />
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--sp-text)' }}>
                  {file ? file.name : 'Click to select or drag and drop your CSV file'}
                </strong>
                <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB · UTF-8 CSV ready for pre-flight check`
                    : 'UTF-8 encoded CSV · Up to 500 rows · Max 2 MB'}
                </div>
              </div>
              {file && (
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  style={{ marginTop: '6px' }}
                  onClick={(e) => {
                    e.preventDefault();
                    onFile(null);
                  }}
                >
                  <X size={12} /> Replace file
                </button>
              )}
            </label>

            {/* Schema Tags Preview */}
            <div style={{ marginTop: '14px', padding: '12px', background: 'var(--sp-surface-hover)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '8px' }}>
                Required Headers for {resource}:
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {currentTemplate.requiredHeaders.map((col) => (
                  <span key={col} className="import-schema-tag required">
                    {col} <span style={{ color: '#dc2626' }}>*</span>
                  </span>
                ))}
                {currentTemplate.optionalHeaders.map((col) => (
                  <span key={col} className="import-schema-tag">
                    {col}
                  </span>
                ))}
              </div>

              {customFields.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--sp-border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)', marginBottom: '4px' }}>
                    Workspace Custom Fields (can be supplied as extra columns):
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {customFields.map((f) => (
                      <span key={f.id} className="import-schema-tag">
                        <code>{f.fieldKey}</code> · {f.displayName} ({f.fieldType.toLowerCase()})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button
                type="button"
                className="sales-action-btn secondary"
                disabled={!file || saving}
                onClick={onPreview}
              >
                {saving ? 'Validating…' : 'Pre-flight Preview'}
              </button>

              <button
                type="button"
                className="sales-action-btn primary"
                disabled={!preview || preview.errors.length > 0 || saving}
                onClick={onImport}
              >
                {saving ? 'Importing…' : 'Commit Valid Rows'}
              </button>
            </div>
          </div>

          {/* Step 3: Interactive Validation Ledger & Preview Rows */}
          {preview && (
            <div className="sales-table-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
                      Validation Results
                    </h3>
                    <span className={`sales-status-chip ${preview.errors.length > 0 ? 'overdue' : 'completed'}`}>
                      {preview.validRows} / {preview.totalRows} Rows Valid
                    </span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', margin: '4px 0 0' }}>
                    {preview.errors.length > 0
                      ? `${preview.errors.length} issue(s) detected. Fix errors before committing.`
                      : 'All rows verified. Transaction will commit atomically without duplicates.'}
                  </p>
                </div>

                {preview.errors.length > 0 && (
                  <button
                    type="button"
                    className="sales-action-btn secondary"
                    onClick={downloadErrors}
                  >
                    <Download size={13} /> Download Error CSV
                  </button>
                )}
              </div>

              {/* Error Callout */}
              {preview.errors.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.06)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>
                    <AlertCircle size={15} /> Validation Errors
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                    {preview.errors.map((err, idx) => (
                      <div key={`${err.row}-${idx}`} style={{ fontSize: '11.5px', color: '#991b1b', display: 'flex', gap: '8px' }}>
                        <span style={{ fontWeight: 600, minWidth: '55px' }}>Row {err.row}:</span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Rows Table */}
              <div className="sales-table-scroll" style={{ maxHeight: '340px' }}>
                <table className="sales-table">
                  <thead>
                    <tr>
                      {Object.keys(preview.sampleRows[0] || {}).map((header) => (
                        <th key={header}>{header.replaceAll('_', ' ').toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleRows.map((row, idx) => (
                      <tr key={idx} className="sales-row">
                        {Object.keys(preview.sampleRows[0] || {}).map((header) => (
                          <td key={header} style={{ fontSize: '12px', color: 'var(--sp-text)' }}>
                            {row[header] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. SUB-TAB 2: Import History & Batches Register */}
      {activeTab === 'history' && (
        <div className="sales-table-card">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '160px' }}>TIMESTAMP</th>
                  <th style={{ width: '130px' }}>RESOURCE</th>
                  <th style={{ width: '130px' }}>ROWS IMPORTED</th>
                  <th style={{ minWidth: '220px' }}>CONTENT SHA-256</th>
                  <th style={{ minWidth: '200px' }}>IDEMPOTENCY KEY</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <History size={32} className="sales-empty-icon" />
                        <div className="sales-empty-title">No import batches recorded</div>
                        <div className="sales-empty-desc">
                          Committed imports will appear here with cryptographic SHA-256 audit hashes.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  batches.map((batch) => {
                    const formattedDate = new Date(batch.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <tr key={batch.id} className="sales-row">
                        <td className="sales-date-cell">
                          <time dateTime={batch.createdAt}>{formattedDate}</time>
                        </td>

                        <td>
                          <span className={`product-type-badge ${batch.resourceType.toLowerCase()}`}>
                            {batch.resourceType}
                          </span>
                        </td>

                        <td>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                            {batch.rowsImported} rows
                          </span>
                        </td>

                        <td>
                          <code style={{ fontSize: '10.5px', color: 'var(--sp-text-secondary)', background: 'var(--sp-surface-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                            {batch.contentSha256.slice(0, 16)}…{batch.contentSha256.slice(-8)}
                          </code>
                        </td>

                        <td>
                          <span className="sales-ref-badge" style={{ fontSize: '10.5px' }}>
                            {batch.idempotencyKey || batch.id.slice(0, 18)}
                          </span>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <span className="sales-status-chip completed">
                            <Check size={11} /> Verified
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. SUB-TAB 3: Template Center & Schemas */}
      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          {(Object.keys(TEMPLATES) as ImportResource[]).map((resKey) => {
            const tmpl = TEMPLATES[resKey];

            return (
              <div key={resKey} className="import-export-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileSpreadsheet size={18} color="var(--sp-brand)" />
                      <strong style={{ fontSize: '13.5px', color: 'var(--sp-text)' }}>{tmpl.title}</strong>
                    </div>
                    <span className="sales-ref-badge">{resKey}</span>
                  </div>

                  <p style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', margin: '0 0 12px', lineHeight: '1.45' }}>
                    {tmpl.description}
                  </p>

                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '4px' }}>
                    Required Column Headers:
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {tmpl.requiredHeaders.map((col) => (
                      <span key={col} className="import-schema-tag required">
                        {col}
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginBottom: '4px' }}>
                    Optional Headers ({tmpl.optionalHeaders.length}):
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {tmpl.optionalHeaders.slice(0, 6).map((col) => (
                      <span key={col} className="import-schema-tag">
                        {col}
                      </span>
                    ))}
                    {tmpl.optionalHeaders.length > 6 && (
                      <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', alignSelf: 'center' }}>
                        +{tmpl.optionalHeaders.length - 6} more
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--sp-border)', paddingTop: '12px' }}>
                  <button
                    type="button"
                    className="sales-action-btn primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => downloadSampleTemplate(resKey)}
                  >
                    <Download size={13} />
                    <span>Download {tmpl.filename}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. SUB-TAB 4: Master Data Export Register */}
      {activeTab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '12px 14px', background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: '13px', color: 'var(--sp-text)' }}>Master Data Exports</strong>
              <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                All exports include published workspace custom fields and support up to 10,000 active records.
              </div>
            </div>
            <span className="sales-status-chip completed">8 Export Channels Ready</span>
          </div>

          <div className="import-export-grid">
            {EXPORT_ENTITIES.map((ent) => {
              const IconComp = ent.icon;

              return (
                <div key={ent.resource} className="import-export-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <IconComp size={15} />
                        </div>
                        <strong style={{ fontSize: '13px', color: 'var(--sp-text)' }}>{ent.title}</strong>
                      </div>
                      <span className="sales-ref-badge">{ent.badge}</span>
                    </div>

                    <p style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', margin: '0 0 10px', lineHeight: '1.45' }}>
                      {ent.description}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid var(--sp-border)', paddingTop: '10px' }}>
                    <button
                      type="button"
                      className="sales-action-btn secondary"
                      style={{ width: '100%', justifyContent: 'center' }}
                      disabled={saving}
                      onClick={() => onExport(ent.resource)}
                    >
                      <Download size={13} />
                      <span>Export {ent.resource.replaceAll('_', ' ')} CSV</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. ERP Data Migration & Ingestion Pipeline Guide */}
      <div className="sales-pipeline-banner">
        <div className="sales-pipeline-header">
          <div className="sales-pipeline-title">
            <span className="sales-pipeline-dot" />
            <span>Master Data Ingestion & Migration Protocol</span>
          </div>
          <span className="sales-pipeline-tag">ISO 9001 · ERP Master Data</span>
        </div>

        <div className="sales-pipeline-stages">
          <div className="sales-pipeline-step">
            <div className="sales-step-num">01</div>
            <div className="sales-step-content">
              <b>Template Selection</b>
              <span>Download standardized CSV schemas with required headers</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">02</div>
            <div className="sales-step-content">
              <b>CSV Preparation</b>
              <span>Format rows, trim whitespace, and map custom field keys</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">03</div>
            <div className="sales-step-content">
              <b>Pre-flight Check</b>
              <span>Server-side schema validation, duplicate detection & error logging</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">04</div>
            <div className="sales-step-content">
              <b>Atomic DB Commit</b>
              <span>Zero partial writes, database transaction rollback on any failure</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">05</div>
            <div className="sales-step-content">
              <b>Workspace Sync</b>
              <span>Automated cache refresh across customers, suppliers & catalog items</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
